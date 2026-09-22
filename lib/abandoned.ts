import { HOLD_MINUTES } from '@/lib/booking';
import { prisma } from '@/lib/db';

// How long after the hold lets go before the guest hears from us. Soon enough
// that the trip is still in mind, late enough that someone still on the bank's
// page is not emailed mid-payment.
export const ABANDONED_AFTER_MINUTES = 60;

// Past this a booking is not abandoned, it is history. Without it, switching the
// cron on for the first time would email everyone who ever failed to pay.
export const ABANDONED_MAX_AGE_DAYS = 7;

const MINUTE = 60_000;

export interface AbandonedBooking {
  id: string;
  reference: string;
  viewToken: string;
  hotelSlug: string;
  roomName: string;
  checkIn: Date;
  checkOut: Date;
  rooms: number;
  guestName: string;
  guestEmail: string;
}

// Unpaid, past its hold by ABANDONED_AFTER_MINUTES, not yet written to. The
// `abandonedEmailSentAt: null` is what makes a second email impossible rather
// than merely unlikely — it is the same condition the update then clears.
export async function abandonedBookings(now: Date = new Date()): Promise<AbandonedBooking[]> {
  const holdExpiredBefore = new Date(
    now.getTime() - (HOLD_MINUTES + ABANDONED_AFTER_MINUTES) * MINUTE,
  );
  const notBefore = new Date(now.getTime() - ABANDONED_MAX_AGE_DAYS * 24 * 60 * MINUTE);

  return prisma.booking.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      abandonedEmailSentAt: null,
      createdAt: { lt: holdExpiredBefore, gte: notBefore },
    },
    select: {
      id: true,
      reference: true,
      viewToken: true,
      hotelSlug: true,
      roomName: true,
      checkIn: true,
      checkOut: true,
      rooms: true,
      guestName: true,
      guestEmail: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

// Claims the row before the mail is sent. A send that then fails costs one
// guest one email; marking afterwards would risk a crash between send and
// write turning into a second email on the next run, which is the one thing
// this is not allowed to do.
export async function markAbandonedEmailSent(id: string, now: Date = new Date()): Promise<boolean> {
  const claimed = await prisma.booking.updateMany({
    where: { id, abandonedEmailSentAt: null },
    data: { abandonedEmailSentAt: now },
  });
  return claimed.count === 1;
}
