import { todayInIndia } from '@/lib/booking';
import { withinFreeCancellation } from '@/lib/cancellation';
import { publicSiteUrl } from '@/lib/site-url';
import type { Booking } from '@prisma/client';

// The "Cancel this booking" link a guest gets in their confirmation email and
// on their voucher.
//
// The token is stored on the booking rather than signed with a secret. Both
// are unforgeable; a stored one is also withdrawable — it is cleared the
// moment it is used — needs no key to rotate or keep out of a log, and cannot
// be used to forge a cancellation for every booking at once if that key ever
// leaks. What it costs is a column.

export function cancelLinkFor(booking: Pick<Booking, 'cancelToken'>): string | null {
  return booking.cancelToken ? `${publicSiteUrl}/booking/cancel/${booking.cancelToken}` : null;
}

export type CancelLinkState =
  | { usable: true; refundable: boolean }
  | { usable: false; reason: 'expired' | 'stay-started' | 'already-cancelled' | 'not-confirmed' };

type CancellableBooking = Pick<
  Booking,
  'status' | 'checkIn' | 'rateType' | 'cancellationDeadline' | 'cancelledAt'
>;

// Valid until check-in, and only for a booking that is actually on. Past that
// the link says so rather than failing at the button: a guest who has already
// travelled needs the desk, not a form.
export function cancelLinkState(
  booking: CancellableBooking,
  now: Date = new Date(),
): CancelLinkState {
  if (booking.cancelledAt || booking.status === 'CANCELLED' || booking.status === 'REFUND_DUE') {
    return { usable: false, reason: 'already-cancelled' };
  }
  if (booking.status !== 'CONFIRMED') return { usable: false, reason: 'not-confirmed' };
  if (todayInIndia(now) >= booking.checkIn) return { usable: false, reason: 'stay-started' };

  return {
    usable: true,
    // What the guest gets back, decided by the terms the booking was taken on
    // rather than the property's current ones.
    refundable: withinFreeCancellation(booking.rateType, booking.cancellationDeadline, now),
  };
}
