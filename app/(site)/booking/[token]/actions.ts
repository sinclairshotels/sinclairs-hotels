'use server';

import { getHotelBySlug } from '@/content/hotels';
import { formatInr, formatReference } from '@/lib/booking';
import { cancellationSentence, withinFreeCancellation } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import { bookingCancelledHtml } from '@/lib/email-templates/booking-cancelled';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import { cancellationRecipients, notificationRecipients } from '@/lib/notification-emails';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { publicSiteUrl } from '@/lib/site-url';
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

  // REFUND_DUE rather than CANCELLED when money is owed. Both release the
  // rooms; only REFUND_DUE shows on Payments as a task, and the refund itself
  // is still a person pressing a button against ICICI.
  const status = refundable ? 'REFUND_DUE' : 'CANCELLED';

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status, cancelledAt: new Date() },
  });

  log.info('booking.cancelled_by_guest', {
    reference: updated.reference,
    hotel: updated.hotelSlug,
    rate_type: updated.rateType,
    refundable,
    amount: updated.total.toNumber(),
  });

  const hotel = getHotelBySlug(updated.hotelSlug);
  const viewUrl = `${publicSiteUrl}/booking/${updated.viewToken}`;

  await sendMail({
    to: updated.guestEmail,
    kind: 'booking-cancelled-guest',
    subject: `Cancelled: ${hotel?.name ?? updated.hotelSlug} — ${formatReference(updated.reference)}`,
    html: bookingCancelledHtml({ booking: updated, hotel, viewUrl, refundable }),
  });

  // Finance is copied only where money is owed — a cancellation that refunds
  // nothing is not their work.
  await sendMail({
    to: refundable
      ? [...(await notificationRecipients(updated.hotelSlug)), ...(await cancellationRecipients())]
      : await notificationRecipients(updated.hotelSlug),
    kind: 'booking-cancelled-staff',
    subject: refundable
      ? `REFUND DUE: ${formatReference(updated.reference)} cancelled by guest — ${formatInr(updated.total.toNumber())}`
      : `Cancelled by guest: ${formatReference(updated.reference)} — no refund due`,
    html: bookingCancelledHtml({ booking: updated, hotel, viewUrl, refundable, forStaff: true }),
  });

  await prisma.auditEvent.create({
    data: {
      // No actorUserId: this was the guest, not a member of staff. The label
      // says so rather than leaving the log looking like nobody did it.
      actorLabel: 'Guest (via booking link)',
      action: 'booking.cancelled_by_guest',
      entity: 'Booking',
      entityId: updated.id,
      hotelSlug: updated.hotelSlug,
      summary: `${updated.reference} cancelled by the guest — ${
        refundable ? 'full refund due' : 'no refund due'
      }`,
      before: { status: booking.status },
      after: { status, refundable },
      ip,
    },
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
