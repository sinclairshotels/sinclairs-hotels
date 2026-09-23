import { stayTimes } from '@/content/site';

// The terms a guest agreed to, in one place because four surfaces state them:
// the confirmation page, the confirmation email, the voucher and the hotel's
// copy. Four hand-written lists would become four slightly different policies,
// which is the whole problem a guest points at when they argue at the desk.
//
// This is the short, booking-specific set. content/legal.ts holds the full
// Terms and Conditions carried on the voucher; where the two speak about the
// same thing they have to agree, so check-in and check-out are read from
// content/site.ts rather than written out again here.

export const FULL_TERMS_PATH = '/terms';

export function bookingTerms(hotelSlug: string): string[] {
  // A property with no row would be a slug the content files do not have, so
  // there is nothing honest to print. Falling back to the commonest pair would
  // state a time nobody published.
  const times = stayTimes[hotelSlug];
  const timing = times
    ? `Check-in from 12 noon on the arrival date — early check-in is included because you booked direct. Check-out by ${times.checkOut}. Late check-out is subject to availability and may be charged.`
    : 'Check-in from 12 noon on the arrival date — early check-in is included because you booked direct. Check-out time is confirmed by the property. Late check-out is subject to availability and may be charged.';

  return [
    'This booking is non-refundable and non-transferable. No refund is made for cancellation, no-show or early departure.',
    timing,
    'A government-issued photo ID is required for every adult guest at check-in. Foreign nationals must present a passport and valid visa.',
    'GST is charged at the rate in force on the booking date and shown separately on your receipt. Extra guests beyond the booked occupancy are charged at the hotel’s published rate.',
    'Transfers are provided by the hotel’s appointed operator. Waiting time beyond 60 minutes after the stated arrival, or changes made within 24 hours, may be charged.',
    'The hotel may decline or end a stay for conduct that disturbs other guests, without refund.',
  ];
}
