'use server';

import { formatInr } from '@/lib/booking';
import { cancelBookingForGuest } from '@/lib/cancel-booking';
import { cancelLinkState } from '@/lib/cancel-link';
import { cancellationSentence } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type CancelLinkActionState = { status: 'idle' | 'success' | 'error'; message?: string };

// The link's own credential is the only thing this needs, and it is checked
// again here rather than trusted from the page that rendered the button: the
// booking can have been cancelled, or check-in arrived, between the page load
// and the click.
export async function cancelFromLink(
  _prev: CancelLinkActionState,
  formData: FormData,
): Promise<CancelLinkActionState> {
  const token = String(formData.get('token') ?? '');
  if (!token) return { status: 'error', message: 'This link is incomplete.' };

  const ip = clientIp(await headers());
  if (isRateLimited(`cancel-link:${ip}`)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const booking = await prisma.booking.findUnique({ where: { cancelToken: token } });
  if (!booking) {
    return {
      status: 'error',
      message: 'This link has already been used, or it is no longer valid.',
    };
  }

  const state = cancelLinkState(booking);
  if (!state.usable) {
    return {
      status: 'error',
      message:
        state.reason === 'stay-started'
          ? 'Your stay has started, so this can no longer be cancelled online. Please speak to the property.'
          : 'This booking can no longer be cancelled online. Please call reservations.',
    };
  }

  const { booking: updated } = await cancelBookingForGuest({
    booking,
    refundable: state.refundable,
    actorLabel: 'Guest (via email link)',
    ip,
  });

  revalidatePath(`/booking/${updated.viewToken}`);
  revalidatePath('/admin/bookings');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/dashboard');

  return {
    status: 'success',
    message: state.refundable
      ? `Cancelled. ${formatInr(updated.total.toNumber())} is being refunded to your original payment method — it reaches you within 5–7 working days.`
      : `Cancelled. ${cancellationSentence(updated.rateType, updated.cancellationDeadline)}`,
  };
}
