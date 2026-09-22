import { directBookingPerk } from '@/content/site';
import type { Hotel } from '@/content/types';
import type { AbandonedBooking } from '@/lib/abandoned';
import { formatStayDate, nightsBetween } from '@/lib/booking';
import { buttonHtml, emailLayout, escapeHtml, fieldRowsHtml } from './layout';

// The one email a guest gets when they reached the payment page and never came
// back. It does not quote a price: the rate is re-read when they return, and a
// figure here that the engine then disagrees with is worse than no figure.
export function bookingAbandonedHtml({
  booking,
  hotel,
  resumeUrl,
}: {
  booking: AbandonedBooking;
  hotel?: Hotel;
  resumeUrl: string;
}): string {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);

  const bodyHtml = `
    <p style="font-size:14px; margin:0 0 16px;">Dear ${escapeHtml(booking.guestName)},</p>
    <p style="font-size:14px; margin:0 0 20px;">You were a step away from booking ${escapeHtml(
      hotel?.name ?? booking.hotelSlug,
    )} and the payment didn't go through. Your dates are still here — pick up where you left off.</p>
    ${fieldRowsHtml([
      ['Property', hotel?.name ?? booking.hotelSlug],
      ['Room', booking.roomName],
      ['Check In', formatStayDate(booking.checkIn)],
      ['Check Out', formatStayDate(booking.checkOut)],
      ['Nights', String(nights)],
      ['Rooms', String(booking.rooms)],
    ])}
    <p style="font-size:13px; margin:16px 0; color:#16352a;"><strong>${escapeHtml(
      directBookingPerk.short,
    )}</strong> — on every booking made here.</p>
    <div style="margin:20px 0;">
      ${buttonHtml(resumeUrl, 'Finish Your Booking')}
    </div>
    <p style="font-size:12px; color:#404040; margin:0;">The room is not held until payment clears, so we check it is still free when you come back. This is the only reminder we will send about this booking.</p>
  `;

  return emailLayout({
    title: `Your ${escapeHtml(hotel?.name ?? 'Sinclairs')} booking is waiting`,
    bodyHtml,
  });
}
