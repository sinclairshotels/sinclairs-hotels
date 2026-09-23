import { BookingPurchaseTracking } from '@/components/booking-purchase-tracking';
import { CancelBookingForm } from '@/components/cancel-booking-form';
import { getHotelBySlug } from '@/content/hotels';
import { contactNumbers, directBookingPerk, stayTimes } from '@/content/site';
import {
  breakfastLine,
  formatInr,
  formatReference,
  formatStayDate,
  nightsBetween,
} from '@/lib/booking';
import { FULL_TERMS_PATH, bookingTerms } from '@/lib/booking-terms';
import { withinFreeCancellation } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Addressed by an unguessable token and shows a named guest's booking, so it
// is kept out of the index here as well as in robots.ts.
export const metadata: Metadata = {
  title: 'Your Booking',
  robots: { index: false, follow: false },
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;
  const booking = await prisma.booking.findUnique({ where: { viewToken: token } });
  if (!booking) notFound();

  const hotel = getHotelBySlug(booking.hotelSlug);
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const checkInTime = stayTimes[booking.hotelSlug]?.checkIn;
  const checkOutTime = stayTimes[booking.hotelSlug]?.checkOut;
  const terms = bookingTerms(booking.hotelSlug, booking.rateType, booking.cancellationDeadline);
  const refundableNow = withinFreeCancellation(booking.rateType, booking.cancellationDeadline);

  const heading = {
    CONFIRMED: 'Your stay is confirmed',
    PENDING_PAYMENT: 'Waiting for your payment',
    PAYMENT_FAILED: 'Payment did not go through',
    CANCELLED: 'This booking was cancelled',
    REFUND_DUE: booking.cancelledAt
      ? 'This booking was cancelled'
      : 'We could not confirm this booking',
  }[booking.status];

  const blurb = {
    CONFIRMED: 'A confirmation is on its way to your inbox. We look forward to welcoming you.',
    PENDING_PAYMENT:
      'We have not had confirmation from the bank yet. If you have just paid, refresh this page in a moment.',
    PAYMENT_FAILED:
      'Nothing has been charged and no room is held. You are welcome to try again — please search for your dates afresh.',
    CANCELLED: 'No room is held against this reference.',
    REFUND_DUE: booking.cancelledAt
      ? 'No room is held against this reference. Your refund is being processed and reaches your original payment method within 5–7 working days.'
      : 'Your payment went through, but the last room was taken before it reached us, so we could not hold your stay. We are refunding you in full and our reservations team will be in touch to find you another room.',
  }[booking.status];

  const totalLabel = {
    CONFIRMED: 'Total paid',
    PENDING_PAYMENT: 'Total',
    PAYMENT_FAILED: 'Total',
    CANCELLED: 'Total',
    REFUND_DUE: 'Amount being refunded',
  }[booking.status];

  return (
    <section className="bg-forest/5 px-6 py-16 sm:py-24">
      {paid === '1' && booking.status === 'CONFIRMED' && hotel && (
        <BookingPurchaseTracking
          reference={booking.reference}
          amount={booking.total.toNumber()}
          hotelSlug={booking.hotelSlug}
          hotelName={hotel.name}
          roomName={booking.roomName}
          nights={nights}
          rooms={booking.rooms}
        />
      )}
      <div className="mx-auto max-w-xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="bg-forest px-8 py-8 text-cream">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-light">
              {booking.status === 'CONFIRMED' ? 'Booking Confirmed' : 'Booking'}
            </p>
            <p className="font-display text-lg tracking-wide text-gold-light">
              {formatReference(booking.reference)}
            </p>
          </div>
          <h1 className="mt-3 font-display text-3xl">{heading}</h1>
          <p className="mt-2 text-sm text-cream/80">
            {hotel?.name ?? booking.hotelSlug} · {formatStayDate(booking.checkIn)} to{' '}
            {formatStayDate(booking.checkOut)} · {nights} {nights === 1 ? 'night' : 'nights'}
          </p>
        </div>

        <div className="p-8">
          <p className="text-sm leading-relaxed text-ink/70">{blurb}</p>

          {/* This page is what a guest prints or shows at the desk, so the perk
              has to be on it rather than only in the email that brought them
              here. */}
          {booking.status === 'CONFIRMED' && (
            <p className="mt-6 rounded border border-gold/50 bg-gold/10 px-4 py-3 text-sm font-medium text-forest">
              {directBookingPerk.short}
            </p>
          )}

          <dl className="mt-6 space-y-2 border-t border-ink/10 pt-6 text-sm">
            <Row label="Room" value={booking.roomName} />
            {booking.planName && <Row label="Rate" value={booking.planName} />}
            {booking.breakfastGuests > 0 && (
              <Row label="Includes" value={breakfastLine(booking.breakfastGuests)} />
            )}
            <Row
              label="Guests"
              value={`${booking.adults} ${booking.adults === 1 ? 'adult' : 'adults'}${
                booking.children > 0
                  ? `, ${booking.children} ${booking.children === 1 ? 'child' : 'children'}`
                  : ''
              }`}
            />
            <Row label="Rooms" value={String(booking.rooms)} />
            <Row
              label="Check in"
              value={`${formatStayDate(booking.checkIn)}${checkInTime ? ` from ${checkInTime}` : ''}`}
            />
            <Row
              label="Check out"
              value={`${formatStayDate(booking.checkOut)}${
                checkOutTime ? ` by ${checkOutTime}` : ''
              }`}
            />
            <Row label="Booked for" value={booking.guestName} />
          </dl>

          <div className="mt-6 rounded border border-ink/10 bg-forest/5 p-5">
            <p className="text-xs uppercase tracking-wider text-ink/50">
              {booking.status === 'CONFIRMED' ? 'Payment received' : 'Amount'}
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Room charges" value={formatInr(booking.roomTotal.toNumber())} />
              <Row label="GST" value={formatInr(booking.taxTotal.toNumber())} />
            </dl>
            <div className="mt-3 flex items-baseline justify-between border-t border-ink/15 pt-3">
              <span className="text-sm font-medium text-ink">{totalLabel}</span>
              <span className="font-display text-2xl text-forest">
                {formatInr(booking.total.toNumber())}
              </span>
            </div>
          </div>

          {hotel?.contact && (
            <p className="mt-6 text-xs leading-relaxed text-ink/60">
              Need to change something? Call reservations on {contactNumbers.tollFree}, or{' '}
              <Link href="/contact" className="underline hover:text-forest">
                send us an enquiry
              </Link>
              , quoting {formatReference(booking.reference)}.
            </p>
          )}

          {booking.status === 'CONFIRMED' && (
            <CancelBookingForm
              token={token}
              refundable={refundableNow}
              amount={formatInr(booking.total.toNumber())}
            />
          )}

          {booking.status !== 'CONFIRMED' && (
            <Link
              href={`/book/${booking.hotelSlug}`}
              className="mt-6 inline-block rounded bg-forest px-6 py-2.5 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark"
            >
              Search Again
            </Link>
          )}

          <div className="mt-8 border-t border-ink/10 pt-6">
            <p className="text-xs uppercase tracking-wider text-ink/50">Terms of your booking</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-ink/60">
              {terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-ink/50">
              Full terms:{' '}
              <Link href={FULL_TERMS_PATH} className="underline hover:text-forest">
                sinclairshotels.com{FULL_TERMS_PATH}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink/60">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
