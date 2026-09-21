'use client';

import { hotelItem, pushEcommerceEvent } from '@/lib/analytics';
import { useEffect } from 'react';

// Same reasoning as ipay-result-tracking: the duplicate arrives as a fresh page
// load, which a ref does not survive, and a browser that throws on storage
// should still report the sale.
function alreadyReported(reference: string): boolean {
  try {
    const key = `sncl:booking-reported:${reference}`;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
    return false;
  } catch {
    return false;
  }
}

// The direct booking funnel used to end at begin_checkout, because checkout
// happened on Staah and there was nothing of ours to report. Now the sale
// completes here, so without this GA4 shows every direct booking entering
// checkout and none ever converting — the whole channel reads as zero revenue.
//
// Only rendered when the guest arrives from the bank (?paid=1), because this
// page is also the permanent link in their confirmation email.
export function BookingPurchaseTracking({
  reference,
  amount,
  hotelSlug,
  hotelName,
  roomName,
  nights,
  rooms,
}: {
  reference: string;
  amount: number;
  hotelSlug: string;
  hotelName: string;
  roomName: string;
  nights: number;
  rooms: number;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once per arrival, not on every render
  useEffect(() => {
    if (alreadyReported(reference)) return;

    // transaction_id is the booking reference, not the order id: it is what
    // staff and the guest both quote, and it survives a retried payment.
    pushEcommerceEvent(
      'purchase',
      {
        transaction_id: reference,
        value: amount,
        currency: 'INR',
        items: [
          hotelItem(hotelSlug, hotelName, {
            item_variant: roomName,
            price: amount,
            quantity: rooms,
          }),
        ],
      },
      { hotel: hotelSlug, nights, rooms },
    );
  }, []);

  return null;
}
