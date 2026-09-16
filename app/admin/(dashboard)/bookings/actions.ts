'use server';

import { ADMIN_COOKIE_NAME, verifySessionCookieValue } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export type CancelBookingState = { status: 'idle' | 'success' | 'error'; message?: string };

export async function cancelBooking(
  _prevState: CancelBookingState,
  formData: FormData,
): Promise<CancelBookingState> {
  const authed = await verifySessionCookieValue((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
  if (!authed) return { status: 'error', message: 'Session expired, please sign in again.' };

  const id = String(formData.get('id') ?? '');
  if (!id) return { status: 'error', message: 'No booking selected.' };

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return { status: 'error', message: 'Booking not found.' };
  if (booking.status === 'CANCELLED') {
    return { status: 'error', message: 'That booking is already cancelled.' };
  }

  // Cancelling releases the rooms; it deliberately does not touch the
  // payment. A confirmed booking was paid for, and the money is refunded
  // from the Payments page against ICICI — doing it implicitly here would
  // move real money from a button labelled "cancel".
  await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } });

  log.info('booking.cancelled', {
    reference: booking.reference,
    hotel: booking.hotelSlug,
    was: booking.status,
    amount: booking.total.toNumber(),
  });

  revalidatePath('/admin/bookings');

  return {
    status: 'success',
    message:
      booking.status === 'CONFIRMED'
        ? `${booking.reference} cancelled. Refund it from Payments if money is owed.`
        : `${booking.reference} cancelled.`,
  };
}
