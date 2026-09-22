import { getHotelBySlug } from '@/content/hotels';
import { prisma } from '@/lib/db';
import { STAFF_NOTIFY_EMAIL } from '@/lib/mail';

// Where enquiry and booking notifications go. Staff set these at
// /admin/enquiries without a deploy; content/hotels/*.ts and STAFF_NOTIFY_EMAIL
// remain the fallback, so an empty table behaves exactly as the site did
// before and the addresses can be filled in one property at a time.
//
// A property's own addresses and the central one are both used — the central
// address is an addition, not a default that a property replaces. Someone
// watching everything should not stop seeing Gangtok's enquiries the moment
// Gangtok gets an address of its own.
export async function notificationRecipients(hotelSlug?: string | null): Promise<string[]> {
  const rows = await prisma.notificationEmail.findMany({
    where: { OR: [{ hotelSlug: null }, ...(hotelSlug ? [{ hotelSlug }] : [])] },
    select: { address: true, hotelSlug: true },
  });

  const configured = new Set(rows.map((row) => row.address));
  if (configured.size > 0) {
    const hasHotelRow = rows.some((row) => row.hotelSlug !== null);
    // A property with no address of its own still wants its content address,
    // or the central team would silently become its only recipient.
    if (hotelSlug && !hasHotelRow) {
      const fallback = getHotelBySlug(hotelSlug)?.contact?.notificationEmail;
      if (fallback) configured.add(fallback);
    }
    return [...configured];
  }

  const fallback = hotelSlug ? getHotelBySlug(hotelSlug)?.contact?.notificationEmail : null;
  return [fallback ?? STAFF_NOTIFY_EMAIL];
}
