'use server';

import { recordAudit } from '@/lib/audit';
import { authorize } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export type CancelBookingState = { status: 'idle' | 'success' | 'error'; message?: string };

export async function cancelBooking(
  _prevState: CancelBookingState,
  formData: FormData,
): Promise<CancelBookingState> {
  const auth = await authorize('bookings:write');
  if (!auth.ok) return { status: 'error', message: auth.message };

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

  await recordAudit({
    user: auth.user,
    action: 'booking.cancelled',
    entity: 'Booking',
    entityId: booking.id,
    hotelSlug: booking.hotelSlug,
    summary: `${booking.reference} cancelled — the rooms are released, the money is not`,
    before: { status: booking.status },
    after: { status: 'CANCELLED' },
  });

  log.info('booking.cancelled', {
    reference: booking.reference,
    hotel: booking.hotelSlug,
    was: booking.status,
    amount: booking.total.toNumber(),
  });

  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${booking.id}`);
  revalidatePath('/admin/dashboard');

  return {
    status: 'success',
    message:
      booking.status === 'CONFIRMED'
        ? `${booking.reference} cancelled. Refund it from Payments if money is owed.`
        : `${booking.reference} cancelled.`,
  };
}
