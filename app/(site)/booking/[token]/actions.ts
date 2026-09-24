'use server';

import { formatInr } from '@/lib/booking';
import { cancelBookingForGuest } from '@/lib/cancel-booking';
import { cancellationSentence, withinFreeCancellation } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type CancelState = { status: 'idle' | 'success' | 'error'; message?: string };

// The guest cancels from the same unguessable link that shows them the booking.
// That token is already the only credential the page has, so cancelling with it
// grants nothing that viewing did not — but it moves money, so it is rate
// limited and the UI asks twice.
export async function cancelOwnBooking(
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const token = String(formData.get('token') ?? '');
  if (!token) return { status: 'error', message: 'No booking selected.' };

  const ip = clientIp(await headers());
  if (isRateLimited(`cancel:${ip}`)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const booking = await prisma.booking.findUnique({ where: { viewToken: token } });
  if (!booking) return { status: 'error', message: 'Booking not found.' };

  if (booking.status !== 'CONFIRMED') {
    return {
      status: 'error',
      message: 'Only a confirmed booking can be cancelled here. Please call reservations.',
    };
  }

  // The booking's own stored terms decide this, never the property's current
  // ones: staff changing the policy must not change what somebody already
  // agreed to, in either direction.
  const refundable = withinFreeCancellation(booking.rateType, booking.cancellationDeadline);

  const { booking: updated } = await cancelBookingForGuest({
    booking,
    refundable,
    actorLabel: 'Guest (via booking page)',
    ip,
  });

  revalidatePath(`/booking/${token}`);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/dashboard');

  return {
    status: 'success',
    message: refundable
      ? `Cancelled. ${formatInr(updated.total.toNumber())} is being refunded to your original payment method — it reaches you within 5–7 working days.`
      : `Cancelled. ${cancellationSentence(updated.rateType, updated.cancellationDeadline)}`,
  };
}
