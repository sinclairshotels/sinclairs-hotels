import { CancelLinkForm } from '@/components/cancel-link-form';
import { getHotelBySlug } from '@/content/hotels';
import { contactNumbers } from '@/content/site';
import { formatInr, formatReference, formatStayDate, nightsBetween } from '@/lib/booking';
import { cancelLinkState } from '@/lib/cancel-link';
import { cancellationSentence, rateTypeLabel } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Addressed by an unguessable token and shows a named guest's booking.
export const metadata: Metadata = {
  title: 'Cancel Your Booking',
  robots: { index: false, follow: false },
};

export default async function CancelBookingPage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await prisma.booking.findUnique({ where: { cancelToken: token } });
  if (!booking) notFound();

  const hotel = getHotelBySlug(booking.hotelSlug);
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const state = cancelLinkState(booking);

  return (
    <section className="bg-forest/5 px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="bg-forest px-8 py-8 text-cream">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-light">Cancel booking</p>
            <p className="font-display text-lg tracking-wide text-gold-light">
              {formatReference(booking.reference)}
            </p>
          </div>
          <h1 className="mt-3 font-display text-3xl">
            {state.usable ? 'Cancel this booking?' : 'This booking cannot be cancelled here'}
          </h1>
          <p className="mt-2 text-sm text-cream/80">
            {hotel?.name ?? booking.hotelSlug} · {formatStayDate(booking.checkIn)} to{' '}
            {formatStayDate(booking.checkOut)} · {nights} {nights === 1 ? 'night' : 'nights'}
          </p>
        </div>

        <div className="p-8">
          <dl className="space-y-2 text-sm">
            <Row label="Room" value={`${booking.rooms} × ${booking.roomName}`} />
            <Row label="Guest" value={booking.guestName} />
            <Row label="Rate" value={rateTypeLabel(booking.rateType)} />
            <Row
              label="Cancellation terms"
              value={cancellationSentence(booking.rateType, booking.cancellationDeadline)}
            />
            <Row label="Total paid" value={formatInr(booking.total.toNumber())} />
          </dl>

          {/* What they get back, in money, before they press anything. The
              terms sentence above says the rule; this says the amount. */}
          {state.usable && (
            <p
              className={`mt-6 rounded border px-4 py-3 text-sm ${
                state.refundable
                  ? 'border-forest/30 bg-forest/5 text-forest'
                  : 'border-gold/50 bg-gold/10 text-ink/80'
              }`}
            >
              {state.refundable
                ? `If you cancel now, ${formatInr(booking.total.toNumber())} is refunded in full to your original payment method.`
                : 'If you cancel now, no refund is due — this booking was taken on non-refundable terms, or its free-cancellation date has passed.'}
            </p>
          )}

          {state.usable ? (
            <CancelLinkForm token={token} refundable={state.refundable} />
          ) : (
            <p className="mt-6 text-sm leading-relaxed text-ink/70">
              {state.reason === 'already-cancelled'
                ? 'This booking has already been cancelled. Nothing further is needed.'
                : state.reason === 'stay-started'
                  ? 'Your stay has started, so a cancellation is something the property handles directly.'
                  : 'This booking is not currently confirmed, so there is nothing to cancel.'}{' '}
              Call us on{' '}
              <a href={contactNumbers.tollFreeHref} className="text-forest underline">
                {contactNumbers.tollFree}
              </a>{' '}
              if you need help.
            </p>
          )}

          <p className="mt-8 border-t border-ink/10 pt-6 text-xs text-ink/50">
            Changed your mind?{' '}
            <Link href={`/booking/${booking.viewToken}`} className="text-forest underline">
              Go back to your booking
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-ink/5 pb-2">
      <dt className="text-ink/55">{label}</dt>
      <dd className="text-right font-medium text-ink/85">{value}</dd>
    </div>
  );
}
