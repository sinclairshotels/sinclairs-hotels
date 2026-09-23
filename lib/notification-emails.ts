import { getHotelBySlug } from '@/content/hotels';
import { prisma } from '@/lib/db';
import { STAFF_NOTIFY_EMAIL } from '@/lib/mail';
import type { NotificationKind } from '@prisma/client';

// Where each kind of staff mail goes. Set per admin page at /admin, without a
// deploy, and split into To, CC and BCC because a finance address copied on a
// refund is not the same thing as the property that has to act on it.

export interface Recipients {
  to: string[];
  cc: string[];
  bcc: string[];
}

// The pages that send mail, in sidebar order. `perProperty` is whether the
// panel offers a list per property as well as a central one: a booking belongs
// to a hotel, a job application does not.
// Every list is per property as well as central, because every one of these
// belongs to a hotel somewhere — a job application included, since a position
// is posted against a property.
//
// `fallback` is whether an empty To still reaches somebody. Bookings, vouchers,
// payments and enquiries must arrive, so they fall through to the property's
// own address and then STAFF_NOTIFY_EMAIL. The three that do not are
// deliberate: an unset cancellations or careers list means nobody asked for
// the copy, and inventing a recipient for money news or somebody's CV is worse
// than sending none.
export const NOTIFICATION_PAGES = [
  { kind: 'BOOKING', label: 'Bookings', fallback: true },
  { kind: 'VOUCHER', label: 'Vouchers', fallback: true },
  { kind: 'VOUCHER_CANCELLATION', label: 'Voucher cancellations', fallback: false },
  { kind: 'PAYMENT', label: 'Payments', fallback: true },
  { kind: 'CANCELLATION', label: 'Booking cancellations', fallback: false },
  { kind: 'ENQUIRY', label: 'Enquiries', fallback: true },
  { kind: 'CAREERS', label: 'Careers', fallback: false },
] as const satisfies ReadonlyArray<{
  kind: NotificationKind;
  label: string;
  fallback: boolean;
}>;

export type NotificationPageKind = (typeof NOTIFICATION_PAGES)[number]['kind'];

export function notificationPage(kind: string) {
  return NOTIFICATION_PAGES.find((page) => page.kind === kind);
}

// A property's own addresses and the central ones are used together — the
// central address is an addition, not a default a property replaces. Someone
// watching everything should not stop seeing Gangtok's mail the moment Gangtok
// gets an address of its own.
export async function recipientsFor(
  kind: NotificationKind,
  hotelSlug?: string | null,
): Promise<Recipients> {
  const rows = await prisma.notificationEmail.findMany({
    where: {
      kind,
      OR: [{ hotelSlug: null }, ...(hotelSlug ? [{ hotelSlug }] : [])],
    },
    select: { address: true, field: true, hotelSlug: true },
  });

  const pick = (field: 'TO' | 'CC' | 'BCC') => [
    ...new Set(rows.filter((row) => row.field === field).map((row) => row.address)),
  ];

  return { to: pick('TO'), cc: pick('CC'), bcc: pick('BCC') };
}

// Mail that must reach somebody: a guest enquiry, a booking, a payment. An
// unconfigured list falls back to the property's own address from the content
// files and then to STAFF_NOTIFY_EMAIL, so an empty table behaves exactly as
// the site did before any of this existed.
export async function guaranteedRecipients(
  kind: NotificationKind,
  hotelSlug?: string | null,
): Promise<Recipients> {
  const configured = await recipientsFor(kind, hotelSlug);
  if (configured.to.length > 0) {
    // A property with no address of its own still wants its content address,
    // or the central team would silently become its only recipient.
    const hasHotelRow = hotelSlug
      ? await prisma.notificationEmail.count({ where: { kind, field: 'TO', hotelSlug } })
      : 1;
    if (hotelSlug && hasHotelRow === 0) {
      const fallback = getHotelBySlug(hotelSlug)?.contact?.notificationEmail;
      if (fallback && !configured.to.includes(fallback)) configured.to.push(fallback);
    }
    return configured;
  }

  const fallback = hotelSlug ? getHotelBySlug(hotelSlug)?.contact?.notificationEmail : null;
  return { ...configured, to: [fallback ?? STAFF_NOTIFY_EMAIL] };
}

// Everything the recipients page needs: every list, in one query, plus what
// each falls back to while its To is empty.
export async function allRecipients(hotelSlugs: string[]) {
  const rows = await prisma.notificationEmail.findMany({
    where: { kind: { in: NOTIFICATION_PAGES.map((page) => page.kind) } },
    select: { id: true, kind: true, hotelSlug: true, field: true, address: true },
    orderBy: { createdAt: 'asc' },
  });

  return NOTIFICATION_PAGES.map((page) => ({
    kind: page.kind as NotificationKind,
    label: page.label,
    rows: rows.filter((row) => row.kind === page.kind),
    fallback: page.fallback ? STAFF_NOTIFY_EMAIL : null,
    // Per property, so the page can name the address a property falls back to
    // rather than only the central one.
    hotelFallbacks: Object.fromEntries(
      hotelSlugs.flatMap((slug) => {
        const address = getHotelBySlug(slug)?.contact?.notificationEmail;
        return page.fallback && address ? [[slug, address]] : [];
      }),
    ),
  }));
}
