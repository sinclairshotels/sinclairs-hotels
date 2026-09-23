import { stayTimes } from '@/content/site';
import { CANCELLATION_TERM, cancellationSentence } from '@/lib/cancellation';
import type { BookingRateType } from '@prisma/client';

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

export function bookingTerms(
  hotelSlug: string,
  rateType: BookingRateType = 'NON_REFUNDABLE',
  cancellationDeadline: Date | null = null,
): string[] {
  // A property with no row would be a slug the content files do not have, so
  // there is nothing honest to print. Falling back to the commonest pair would
  // state a time nobody published.
  const times = stayTimes[hotelSlug];
  const timing = times
    ? `Check-in from ${times.checkIn} on the arrival date; check-out by ${times.checkOut}. As a direct booking this stay includes late check-out until 1 pm, subject to availability on the day.`
    : 'Check-in and check-out times are confirmed by the property. As a direct booking this stay includes late check-out until 1 pm, subject to availability on the day.';

  return [
    // The published policy first, stating both rates, then this booking's own
    // terms with its actual date. One without the other leaves a guest either
    // reading a rule that is not theirs or a date with no rule behind it.
    CANCELLATION_TERM,
    cancellationSentence(rateType, cancellationDeadline),
    timing,
    'A government-issued photo ID is required for every adult guest at check-in. Foreign nationals must present a passport and valid visa.',
    'GST is charged at the rate in force on the booking date and shown separately on your receipt. Extra guests beyond the booked occupancy are charged at the hotel’s published rate.',
    'Transfers are provided by the hotel’s appointed operator. Waiting time beyond 60 minutes after the stated arrival, or changes made within 24 hours, may be charged.',
    'The hotel may decline or end a stay for conduct that disturbs other guests, without refund.',
  ];
}
