import { FunnelPanel } from '@/components/admin/funnel-panel';
import { StatTiles } from '@/components/admin/stat-tiles';
import { getHotelBySlug } from '@/content/hotels';
import { formatDate } from '@/lib/admin-format';
import { can, getSession } from '@/lib/auth';
import { formatInr, formatStayDate, nightsBetween } from '@/lib/booking';
import { dashboardToday } from '@/lib/dashboard';
import { FUNNEL_STEPS, type Funnel, type FunnelStep, funnelCounts, toRows } from '@/lib/funnel';
import { COVERAGE_WARNING_DAYS, coverageWarnings } from '@/lib/rate-calendar';
import type { Booking } from '@prisma/client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ funnel?: string }>;
}) {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'bookings:read')) notFound();

  const { funnel: funnelParam } = await searchParams;
  const funnelDays = funnelParam === '30' ? 30 : 7;

  const [today, warnings, funnelCountsByHotel] = await Promise.all([
    dashboardToday(viewer),
    can(viewer, 'rates:read') ? coverageWarnings() : Promise.resolve([]),
    funnelCounts(viewer, funnelDays),
  ]);

  const funnels: Funnel[] = [
    {
      hotelSlug: null,
      hotelName: 'All properties',
      rows: toRows(funnelCountsByHotel.get(null) ?? blankCounts()),
    },
    ...[...funnelCountsByHotel.entries()]
      .flatMap(([slug, counts]) => (slug === null ? [] : [{ slug, counts }]))
      .sort((a, b) =>
        (getHotelBySlug(a.slug)?.name ?? a.slug).localeCompare(
          getHotelBySlug(b.slug)?.name ?? b.slug,
        ),
      )
      .map(({ slug, counts }) => ({
        hotelSlug: slug,
        hotelName: getHotelBySlug(slug)?.name ?? slug,
        rows: toRows(counts),
      })),
  ];

  const visibleWarnings = warnings.filter(
    (warning) =>
      !viewer.restrictedToHotels || viewer.restrictedToHotels.includes(warning.hotelSlug),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Today</p>
        <p className="mt-1 text-sm text-ink/60">
          {formatDate(new Date())} — arrivals, departures and anything owing an answer.
        </p>
        <div className="mt-4">
          <StatTiles
            tiles={[
              { label: 'Arriving', value: today.arrivals.length },
              { label: 'Departing', value: today.departures.length },
              { label: 'In house', value: today.inHouse },
              { label: 'Next 7 days', value: today.nextSeven },
              { label: 'Taken today', value: today.takenToday },
              { label: 'Value today', value: formatInr(today.revenueToday) },
            ]}
          />
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
        {today.refundsDue.length > 0 && (
          <section className="rounded-lg border border-red-300 bg-red-50 p-5">
            <p className="font-display text-base text-red-800">
              {today.refundsDue.length}{' '}
              {today.refundsDue.length === 1 ? 'booking is' : 'bookings are'} owed a refund
            </p>
            <p className="mt-1 text-xs text-red-700/80">
              Paid, but the room was gone by the time the bank confirmed. Refund from Payments —
              nothing here moves money on its own.
            </p>
            <ul className="mt-3 space-y-2">
              {today.refundsDue.map((booking) => (
                <li key={booking.id}>
                  <BookingLine booking={booking} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {today.awaitingPayment > 0 && (
          <p className="rounded border border-gold/50 bg-gold/10 px-4 py-3 text-sm text-ink/70">
            {today.awaitingPayment} {today.awaitingPayment === 1 ? 'booking is' : 'bookings are'}{' '}
            mid-payment and holding rooms. They release themselves if the payment never clears.
          </p>
        )}

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <StayList
            title="Arriving today"
            empty="Nobody is due to arrive today."
            bookings={today.arrivals}
          />
          <StayList
            title="Departing today"
            empty="Nobody is due to check out today."
            bookings={today.departures}
          />
        </section>

        <section className="pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-display text-lg text-forest">Funnel</p>
              <p className="mt-1 text-xs text-ink/50">
                Home views, searches and room views come from the browser, so an ad blocker costs us
                the count — the three steps below them are rows, and cannot be blocked.
              </p>
            </div>
            <div className="flex gap-1 text-xs">
              {[7, 30].map((days) => (
                <Link
                  key={days}
                  href={`/admin/dashboard?funnel=${days}`}
                  className={`rounded px-3 py-1.5 transition ${
                    funnelDays === days
                      ? 'bg-forest text-cream'
                      : 'border border-ink/15 text-ink/60 hover:border-forest hover:text-forest'
                  }`}
                >
                  {days} days
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {funnels.map((funnel) => (
              <FunnelPanel key={funnel.hotelSlug ?? 'all'} funnel={funnel} />
            ))}
          </div>
        </section>

        {visibleWarnings.length > 0 && (
          <section className="max-w-4xl pb-4">
            <p className="font-display text-lg text-forest">Rates running out</p>
            <p className="mt-1 text-xs text-ink/50">
              A calendar that runs out has no symptom — the room simply stops being offered.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {visibleWarnings.slice(0, 10).map((warning) => (
                <li key={`${warning.hotelSlug}-${warning.roomName}`}>
                  <Link
                    href={`/admin/rates?hotel=${warning.hotelSlug}`}
                    className="inline-block rounded border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink/70 transition hover:border-forest hover:text-forest"
                  >
                    <span className="font-medium text-ink">{warning.hotelName}</span> ·{' '}
                    {warning.roomName} ·{' '}
                    <span className={warning.lastNight ? 'text-gold-dark' : 'text-red-700'}>
                      {warning.lastNight ? `${warning.daysLeft}d left` : 'none loaded'}
                    </span>
                  </Link>
                </li>
              ))}
              {visibleWarnings.length > 10 && (
                <li className="self-center text-xs text-ink/50">
                  and {visibleWarnings.length - 10} more, within {COVERAGE_WARNING_DAYS} days
                </li>
              )}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function StayList({
  title,
  empty,
  bookings,
}: {
  title: string;
  empty: string;
  bookings: Booking[];
}) {
  return (
    <div>
      <p className="font-display text-lg text-forest">{title}</p>
      {bookings.length === 0 ? (
        <p className="mt-3 rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
          {empty}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <BookingLine booking={booking} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BookingLine({ booking }: { booking: Booking }) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="block rounded-lg border border-ink/10 bg-white p-4 transition hover:border-forest hover:shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">
          {booking.guestName} <span className="font-normal text-ink/50">· {booking.reference}</span>
        </p>
        <p className="text-xs text-ink/50">{formatInr(booking.total.toNumber())}</p>
      </div>
      <p className="mt-1 text-xs text-ink/60">
        {getHotelBySlug(booking.hotelSlug)?.name ?? booking.hotelSlug} · {booking.roomName}
        {booking.rooms > 1 ? ` ×${booking.rooms}` : ''} · {formatStayDate(booking.checkIn)} –{' '}
        {formatStayDate(booking.checkOut)} · {nights} {nights === 1 ? 'night' : 'nights'}
      </p>
    </Link>
  );
}

const blankCounts = (): Record<FunnelStep, number> =>
  Object.fromEntries(FUNNEL_STEPS.map((step) => [step, 0])) as Record<FunnelStep, number>;
