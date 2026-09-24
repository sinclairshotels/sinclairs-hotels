import { getHotelBySlug } from '@/content/hotels';
import { formatInr, formatReference } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { bookingCancelledHtml } from '@/lib/email-templates/booking-cancelled';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import { guaranteedRecipients, recipientsFor } from '@/lib/notification-emails';
import { publicSiteUrl } from '@/lib/site-url';
import type { Booking } from '@prisma/client';

// Everything a guest cancellation does, in one place, because there are two
// doors into it: the booking page a guest already has open, and the "Cancel
// this booking" link in their confirmation email. Two copies of this would be
// two cancellation policies within a month.

export interface GuestCancellation {
  refundable: boolean;
  booking: Booking;
}

export async function cancelBookingForGuest({
  booking,
  refundable,
  actorLabel,
  ip,
}: {
  booking: Booking;
  refundable: boolean;
  // Which door: the log has to say which, because one of them is a link that
  // travels in an inbox and the other needs the page open.
  actorLabel: string;
  ip: string | null;
}): Promise<GuestCancellation> {
  // REFUND_DUE rather than CANCELLED when money is owed. Both release the
  // rooms — availability counts held bookings and neither status is held — and
  // only REFUND_DUE puts the booking in front of somebody on Payments, because
  // the refund itself is still a person pressing a button against ICICI.
  const status = refundable ? 'REFUND_DUE' : 'CANCELLED';

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status,
      cancelledAt: new Date(),
      // The link is spent. It cannot cancel a second time, and it cannot be
      // replayed out of an inbox by anyone the email was forwarded to.
      cancelToken: null,
    },
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
  // nothing is not their work. Their own To, CC and BCC are merged into this
  // message's rather than flattened into To, so a finance address configured
  // as a copy stays a copy.
  const property = await guaranteedRecipients('BOOKING', updated.hotelSlug);
  const finance = refundable ? await recipientsFor('CANCELLATION') : { to: [], cc: [], bcc: [] };

  await sendMail({
    to: [...new Set([...property.to, ...finance.to])],
    cc: [...new Set([...property.cc, ...finance.cc])],
    bcc: [...new Set([...property.bcc, ...finance.bcc])],
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
      actorLabel,
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

  return { refundable, booking: updated };
}
