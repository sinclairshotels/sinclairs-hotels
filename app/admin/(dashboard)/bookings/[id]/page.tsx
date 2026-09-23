import { BackLink } from '@/components/admin/back-link';
import { CancelBookingButton } from '@/components/admin/cancel-booking-button';
import { getHotelBySlug } from '@/content/hotels';
import { formatDate, formatTime } from '@/lib/admin-format';
import { can, canAccessHotel, getSession } from '@/lib/auth';
import {
  breakfastLine,
  formatInr,
  formatReference,
  formatStayDate,
  nightsBetween,
} from '@/lib/booking';
import { cancellationSentence } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import type { BookingStatus } from '@prisma/client';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: 'Confirmed',
  PENDING_PAYMENT: 'Awaiting payment',
  PAYMENT_FAILED: 'Payment failed',
  CANCELLED: 'Cancelled',
  REFUND_DUE: 'Refund due',
};

const STATUS_STYLE: Record<BookingStatus, string> = {
  CONFIRMED: 'bg-forest/10 text-forest',
  PENDING_PAYMENT: 'bg-gold/20 text-gold-dark',
  PAYMENT_FAILED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-ink/10 text-ink/60',
  REFUND_DUE: 'bg-red-700 text-white',
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'bookings:read')) notFound();

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payment: { include: { refunds: { orderBy: { createdAt: 'desc' } } } } },
  });

  // notFound() rather than a refusal: someone typing a URL for a property they
  // cannot see should learn nothing about whether it exists.
  if (!booking || !canAccessHotel(viewer, booking.hotelSlug)) notFound();

  const history = await prisma.auditEvent.findMany({
    where: { entity: 'Booking', entityId: booking.id },
    orderBy: { at: 'desc' },
    take: 20,
  });

  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const hotel = getHotelBySlug(booking.hotelSlug);

  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const publicHost = host.replace(/^staff\./, '');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (publicHost.startsWith('localhost') ? 'http' : 'https');
  const guestUrl = `${protocol}://${publicHost}/booking/${booking.viewToken}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <BackLink href="/admin/bookings" label="All bookings" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="font-display text-xl text-forest">{formatReference(booking.reference)}</p>
          <span
            className={`rounded px-2 py-0.5 text-xs uppercase tracking-wider ${STATUS_STYLE[booking.status]}`}
          >
            {STATUS_LABEL[booking.status]}
          </span>
          {can(viewer, 'bookings:write') && booking.status !== 'CANCELLED' && (
            <CancelBookingButton id={booking.id} reference={booking.reference} />
          )}
        </div>
        <p className="mt-1 text-sm text-ink/60">
          Taken {formatDate(booking.createdAt)} at {formatTime(booking.createdAt)}.{' '}
          {cancellationSentence(booking.rateType, booking.cancellationDeadline)} Cancelling here
          releases the room; the money is refunded from Payments.
        </p>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid max-w-5xl grid-cols-1 gap-6 pb-6 lg:grid-cols-2">
          <Panel title="The stay">
            <Row label="Property" value={hotel?.name ?? booking.hotelSlug} />
            <Row
              label="Room"
              value={`${booking.roomName}${booking.rooms > 1 ? ` ×${booking.rooms}` : ''}`}
            />
            {booking.planName && <Row label="Rate" value={booking.planName} />}
            {booking.breakfastGuests > 0 && (
              <Row label="Includes" value={breakfastLine(booking.breakfastGuests)} />
            )}
            <Row label="Check in" value={formatStayDate(booking.checkIn)} />
            <Row label="Check out" value={formatStayDate(booking.checkOut)} />
            <Row label="Nights" value={String(nights)} />
            <Row
              label="Guests"
              value={`${booking.adults} ${booking.adults === 1 ? 'adult' : 'adults'}${
                booking.children > 0
                  ? `, ${booking.children} ${booking.children === 1 ? 'child' : 'children'}`
                  : ''
              }`}
            />
          </Panel>

          <Panel title="The guest">
            <Row label="Name" value={booking.guestName} />
            <Row label="Email" value={booking.guestEmail} />
            <Row label="Phone" value={booking.guestPhone} />
            <Row label="Billing" value={booking.billingAddress} />
            {booking.specialRequests && <Row label="Requests" value={booking.specialRequests} />}
            <div className="pt-2">
              <a
                href={guestUrl}
                className="text-xs text-forest underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                Open the guest&rsquo;s own page
              </a>
            </div>
          </Panel>

          <Panel title="The money">
            <Row label="Room charges" value={formatInr(booking.roomTotal.toNumber())} />
            <Row label="Taxes (GST)" value={formatInr(booking.taxTotal.toNumber())} />
            <Row label="Total" value={formatInr(booking.total.toNumber())} emphasis />
            {booking.payment ? (
              <>
                <Row label="Payment" value={booking.payment.status} />
                <Row label="Order" value={booking.payment.orderId} />
                {booking.payment.trackingId && (
                  <Row label="Gateway ref" value={booking.payment.trackingId} />
                )}
                {booking.payment.paymentMode && (
                  <Row label="Paid by" value={booking.payment.paymentMode} />
                )}
                {booking.payment.refunds.length > 0 && (
                  <Row
                    label="Refunds"
                    value={booking.payment.refunds
                      .map((refund) => `${formatInr(refund.amount.toNumber())} ${refund.status}`)
                      .join(', ')}
                  />
                )}
              </>
            ) : (
              <Row label="Payment" value="No payment recorded" />
            )}
          </Panel>

          <Panel title="History">
            {history.length === 0 ? (
              <p className="text-sm text-ink/60">
                Nothing has been changed since this booking was taken.
              </p>
            ) : (
              <ul className="space-y-2">
                {history.map((event) => (
                  <li key={event.id} className="border-b border-ink/5 pb-2 last:border-0">
                    <p className="text-sm text-ink">{event.summary ?? event.action}</p>
                    <p className="text-xs text-ink/50">
                      {formatDate(event.at)} {formatTime(event.at)} · {event.actorLabel}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5">
      <p className="font-display text-lg text-forest">{title}</p>
      <div className="mt-3 space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
      <span className="text-ink/50">{label}</span>
      <span className={emphasis ? 'font-medium text-forest' : 'text-ink'}>{value}</span>
    </div>
  );
}
