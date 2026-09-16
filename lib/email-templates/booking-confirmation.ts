import type { Hotel } from '@/content/types';
import { formatInr, formatStayDate, nightsBetween } from '@/lib/booking';
import type { Booking } from '@prisma/client';
import { buttonHtml, emailLayout, escapeHtml, fieldRowsHtml } from './layout';

export function bookingFields(booking: Booking, hotel?: Hotel): Array<[string, string]> {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);

  return [
    ['Booking Reference', booking.reference],
    ['Property', hotel?.name ?? booking.hotelSlug],
    ['Room', booking.roomName],
    ['Check In', formatStayDate(booking.checkIn)],
    ['Check Out', formatStayDate(booking.checkOut)],
    ['Nights', String(nights)],
    ['Rooms', String(booking.rooms)],
    [
      'Guests',
      `${booking.adults} ${booking.adults === 1 ? 'adult' : 'adults'}${
        booking.children > 0
          ? `, ${booking.children} ${booking.children === 1 ? 'child' : 'children'}`
          : ''
      }`,
    ],
    ['Guest Name', booking.guestName],
    ['Phone', booking.guestPhone],
    ['Email', booking.guestEmail],
    ...(booking.specialRequests
      ? ([['Special Requests', booking.specialRequests]] as Array<[string, string]>)
      : []),
    ['Room Charges', formatInr(booking.roomTotal.toNumber())],
    ['Taxes (GST)', formatInr(booking.taxTotal.toNumber())],
    [
      booking.status === 'REFUND_DUE' ? 'Amount To Refund' : 'Total Paid',
      formatInr(booking.total.toNumber()),
    ],
  ];
}

export function bookingConfirmationHtml({
  booking,
  hotel,
  viewUrl,
  forStaff = false,
}: {
  booking: Booking;
  hotel?: Hotel;
  viewUrl: string;
  forStaff?: boolean;
}): string {
  const contactHtml = hotel?.contact
    ? `<p style="font-size:12px; color:#404040; margin:16px 0;">
        <strong>${escapeHtml(hotel.name)}</strong><br>
        ${escapeHtml(hotel.contact.address)}<br>
        Phone: ${escapeHtml(hotel.contact.phone)} &middot; Email: ${escapeHtml(hotel.contact.email)}
      </p>`
    : '';

  const intro = forStaff
    ? `<p style="font-size:14px; margin:0 0 20px;">A direct booking was taken on the website and paid in full. It is confirmed and holding inventory.</p>`
    : `<p style="font-size:14px; margin:0 0 16px;">Dear ${escapeHtml(booking.guestName)},</p>
       <p style="font-size:14px; margin:0 0 20px;">Thank you for booking with us &mdash; your payment has cleared and your room is confirmed. Please quote your reference on arrival.</p>`;

  const bodyHtml = `
    ${intro}
    ${fieldRowsHtml(bookingFields(booking, hotel))}
    ${forStaff ? '' : contactHtml}
    <div style="margin:20px 0;">
      ${buttonHtml(viewUrl, 'View This Booking Online')}
    </div>
  `;

  return emailLayout({
    title: `Booking ${booking.reference} — ${hotel?.name ?? booking.hotelSlug}`,
    bodyHtml,
  });
}

// Sent instead of a confirmation when a payment cleared but the room had
// already gone — see app/api/ipay/callback/route.ts. The guest is out of
// pocket with nothing held, so this says so plainly rather than dressing it
// up, and the staff copy is a task, not a notification.
export function bookingOversoldHtml({
  booking,
  hotel,
  viewUrl,
  forStaff = false,
}: {
  booking: Booking;
  hotel?: Hotel;
  viewUrl: string;
  forStaff?: boolean;
}): string {
  const amount = formatInr(booking.total.toNumber());

  const bodyHtml = forStaff
    ? `<p style="font-size:14px; margin:0 0 8px;"><strong>Action needed: refund ${escapeHtml(amount)}.</strong></p>
       <p style="font-size:14px; margin:0 0 20px;">A guest completed payment for ${escapeHtml(
         hotel?.name ?? booking.hotelSlug,
       )}, but the room was no longer available when the bank's confirmation arrived, so the booking was not confirmed. It is holding no inventory. Refund this payment from the Payments page in the admin dashboard, and contact the guest.</p>
       ${fieldRowsHtml(bookingFields(booking, hotel))}`
    : `<p style="font-size:14px; margin:0 0 16px;">Dear ${escapeHtml(booking.guestName)},</p>
       <p style="font-size:14px; margin:0 0 20px;">We are very sorry. Your payment of ${escapeHtml(
         amount,
       )} went through, but the last room was taken before your payment reached us, so we could not confirm your stay. We are refunding you in full, and our reservations team will be in touch shortly to help you find another room.</p>
       ${fieldRowsHtml(bookingFields(booking, hotel))}
       <div style="margin:20px 0;">
         ${buttonHtml(viewUrl, 'View This Booking Online')}
       </div>`;

  return emailLayout({
    title: `Booking ${booking.reference} — refund due`,
    bodyHtml,
  });
}
