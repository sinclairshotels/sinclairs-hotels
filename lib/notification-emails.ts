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
export const NOTIFICATION_PAGES = [
  { kind: 'BOOKING', label: 'Bookings', perProperty: true },
  { kind: 'VOUCHER', label: 'Vouchers', perProperty: true },
  { kind: 'PAYMENT', label: 'Payments', perProperty: true },
  { kind: 'ENQUIRY', label: 'Enquiries', perProperty: true },
  { kind: 'CANCELLATION', label: 'Cancellations', perProperty: false },
  { kind: 'CAREERS', label: 'Careers', perProperty: false },
] as const satisfies ReadonlyArray<{
  kind: NotificationKind;
  label: string;
  perProperty: boolean;
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

// Everything the panel on an admin page needs, in one call: the addresses
// already set, the properties this person may see, and what the list falls
// back to while To is empty.
export async function recipientPanel(
  kind: NotificationPageKind,
  visibleHotels: Array<{ slug: string; name: string }>,
) {
  const page = notificationPage(kind);
  const rows = await prisma.notificationEmail.findMany({
    where: { kind },
    select: { id: true, hotelSlug: true, field: true, address: true },
    orderBy: { createdAt: 'asc' },
  });

  return {
    kind,
    label: page?.label ?? kind,
    perProperty: page?.perProperty ?? false,
    properties: visibleHotels,
    rows,
    // Cancellations and Careers have no fallback by design; the rest must
    // reach somebody, so they fall through to STAFF_NOTIFY_EMAIL.
    fallback: page?.perProperty ? STAFF_NOTIFY_EMAIL : null,
  };
}
