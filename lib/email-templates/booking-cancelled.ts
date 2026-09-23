import type { Hotel } from '@/content/types';
import { formatInr, formatReference } from '@/lib/booking';
import { cancellationSentence, rateTypeLabel } from '@/lib/cancellation';
import { bookingFields } from '@/lib/email-templates/booking-confirmation';
import type { Booking } from '@prisma/client';
import { buttonHtml, emailLayout, escapeHtml, fieldRowsHtml } from './layout';

// Sent when a guest cancels from their own booking link. Two versions of the
// same facts: the guest's says what happens to their money, and staff's is
// shaped as a task where there is one.
//
// "Refunds within 5–7 working days" is stated here and nowhere else, because
// it is the one promise this email makes that nothing in the code enforces —
// the refund is a person pressing a button on /admin/payments.
export function bookingCancelledHtml({
  booking,
  hotel,
  viewUrl,
  refundable,
  forStaff = false,
}: {
  booking: Booking;
  hotel?: Hotel;
  viewUrl: string;
  refundable: boolean;
  forStaff?: boolean;
}): string {
  const amount = formatInr(booking.total.toNumber());
  const hotelName = hotel?.name ?? booking.hotelSlug;

  const termsHtml = `<p style="font-size:13px; margin:0 0 20px; color:#404040;">
      <strong>${escapeHtml(rateTypeLabel(booking.rateType))} rate.</strong>
      ${escapeHtml(cancellationSentence(booking.rateType, booking.cancellationDeadline))}
    </p>`;

  const bodyHtml = forStaff
    ? `<p style="font-size:14px; margin:0 0 8px;"><strong>${
        refundable
          ? `Action needed: refund ${escapeHtml(amount)}.`
          : 'Cancelled by the guest. No refund is due.'
      }</strong></p>
       <p style="font-size:14px; margin:0 0 20px;">The guest cancelled ${escapeHtml(
         hotelName,
       )} from their booking link. The rooms are released.${
         refundable
           ? ' Refund this payment from the Payments page in the admin dashboard.'
           : ' Nothing is owed, so there is nothing to refund.'
       }</p>
       ${termsHtml}
       ${fieldRowsHtml(bookingFields(booking, hotel))}`
    : `<p style="font-size:14px; margin:0 0 16px;">Dear ${escapeHtml(booking.guestName)},</p>
       <p style="font-size:14px; margin:0 0 20px;">Your booking at ${escapeHtml(
         hotelName,
       )} has been cancelled, and ${escapeHtml(formatReference(booking.reference))} no longer holds a room.</p>
       ${termsHtml}
       ${
         refundable
           ? `<p style="font-size:14px; margin:0 0 20px;"><strong>${escapeHtml(
               amount,
             )} is being refunded in full</strong> to your original payment method. It reaches you within 5&ndash;7 working days.</p>`
           : `<p style="font-size:14px; margin:0 0 20px;">No refund is due on this booking, so nothing will be returned to your payment method.</p>`
       }
       ${fieldRowsHtml(bookingFields(booking, hotel))}
       <div style="margin:20px 0;">
         ${buttonHtml(viewUrl, 'View This Booking Online')}
       </div>`;

  return emailLayout({
    title: `Booking ${formatReference(booking.reference)} cancelled`,
    bodyHtml,
  });
}
