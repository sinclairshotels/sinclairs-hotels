import { RateCalendarGrid } from '@/components/admin/rate-calendar-grid';
import { RatesTabs } from '@/components/admin/rates-tabs';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { formatDate, formatTime } from '@/lib/admin-format';
import { can, canAccessHotel, getSession } from '@/lib/auth';
import { addDays, dateKey, parseDateOnly, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import {
  CALENDAR_VIEWS,
  COVERAGE_WARNING_DAYS,
  coverageWarnings,
  parseCalendarView,
  rateCalendar,
} from '@/lib/rate-calendar';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const RECENT_CHANGES = 10;

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ hotel?: string; from?: string; days?: string }>;
}) {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'rates:read')) notFound();

  const { hotel: hotelParam, from: fromParam, days: daysParam } = await searchParams;
  const today = todayUtc();
  const view = parseCalendarView(daysParam);

  // A Hotel user sees only their own properties, so the picker cannot offer a
  // property whose calendar they would then be refused.
  const visibleHotels = hotels.filter((hotel) => canAccessHotel(viewer, hotel.slug));
  if (visibleHotels.length === 0) notFound();

  const requested = getHotelBySlug(hotelParam ?? '')?.slug;
  const selectedHotel =
    requested && canAccessHotel(viewer, requested) ? requested : (visibleHotels[0]?.slug ?? '');

  // Clamped to today: the grid is a selling tool, and there is nothing to load
  // into last week.
  const requestedFrom = parseDateOnly(fromParam ?? '') ?? today;
  const calendarFrom = requestedFrom < today ? today : requestedFrom;

  const [calendar, allWarnings, changes] = await Promise.all([
    rateCalendar({ hotelSlug: selectedHotel, from: calendarFrom, days: view }),
    coverageWarnings(),
    prisma.auditEvent.findMany({
      where: {
        action: { startsWith: 'rates.' },
        ...(viewer.restrictedToHotels ? { hotelSlug: { in: viewer.restrictedToHotels } } : {}),
      },
      orderBy: { at: 'desc' },
      take: RECENT_CHANGES,
    }),
  ]);

  const warnings = allWarnings.filter((warning) => canAccessHotel(viewer, warning.hotelSlug));
  const missing = warnings.filter((w) => w.lastNight === null);
  const expiring = warnings.filter((w) => w.lastNight !== null);

  const href = (overrides: Record<string, string>) =>
    `/admin/rates?${new URLSearchParams({
      hotel: selectedHotel,
      from: dateKey(calendarFrom),
      days: String(view),
      ...overrides,
    })}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Inventory &amp; Rates</p>
        <p className="mt-1 text-sm text-ink/60">
          What this website may sell direct. Rooms on sale is the allotment this site holds for a
          night; availability counts the bookings against it rather than decrementing a counter.
        </p>
        <RatesTabs active="/admin/rates" />
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
        {warnings.length > 0 && (
          <section className="rounded-lg border border-gold/50 bg-gold/10 p-5">
            <p className="font-display text-base text-forest">
              {missing.length > 0 && (
                <>
                  {missing.length} room {missing.length === 1 ? 'type has' : 'types have'} no rates
                  loaded
                </>
              )}
              {missing.length > 0 && expiring.length > 0 && ' · '}
              {expiring.length > 0 && (
                <>
                  {expiring.length} {expiring.length === 1 ? 'runs' : 'run'} out within{' '}
                  {COVERAGE_WARNING_DAYS} days
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-ink/60">
              A calendar running out has no symptom — the room simply stops being offered.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {warnings.slice(0, 10).map((warning) => (
                <li key={`${warning.hotelSlug}-${warning.roomName}`}>
                  <Link
                    href={href({ hotel: warning.hotelSlug })}
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
              {warnings.length > 10 && (
                <li className="self-center text-xs text-ink/50">and {warnings.length - 10} more</li>
              )}
            </ul>
          </section>
        )}

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-lg text-forest">Calendar</p>
            <form method="get" className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              <input type="hidden" name="from" value={dateKey(calendarFrom)} />
              <select
                name="hotel"
                defaultValue={selectedHotel}
                className="select w-auto shrink-0 py-1.5 text-sm"
              >
                {visibleHotels.map((hotel) => (
                  <option key={hotel.slug} value={hotel.slug}>
                    {hotel.name}
                  </option>
                ))}
              </select>
              <select
                name="days"
                defaultValue={String(view)}
                className="select w-auto shrink-0 py-1.5 text-sm"
              >
                {CALENDAR_VIEWS.map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="shrink-0 whitespace-nowrap rounded bg-forest px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-forest-dark"
              >
                Show
              </button>
            </form>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <Link
              href={href({ from: dateKey(addDays(calendarFrom, -view)) })}
              className="rounded border border-ink/15 px-3 py-1.5 text-xs uppercase tracking-wider text-ink/60 transition hover:border-forest hover:text-forest"
            >
              &larr; Earlier
            </Link>
            <p className="text-xs uppercase tracking-wider text-ink/50">
              {formatDate(calendarFrom)} &ndash; {formatDate(addDays(calendarFrom, view - 1))}
            </p>
            <Link
              href={href({ from: dateKey(addDays(calendarFrom, view)) })}
              className="rounded border border-ink/15 px-3 py-1.5 text-xs uppercase tracking-wider text-ink/60 transition hover:border-forest hover:text-forest"
            >
              Later &rarr;
            </Link>
          </div>

          <div className="mt-3">
            {calendar && calendar.rows.length > 0 ? (
              <RateCalendarGrid calendar={calendar} />
            ) : (
              <p className="rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
                This property has no active room types yet. Run <code>pnpm sync:rooms</code> or add
                them in Setup.
              </p>
            )}
          </div>
        </section>

        <section className="max-w-4xl pb-4">
          <p className="font-display text-lg text-forest">Change log</p>
          <p className="mt-1 text-xs text-ink/50">Every rate write, newest first.</p>
          {changes.length === 0 ? (
            <p className="mt-3 rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
              No rate changes recorded yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {changes.map((change) => (
                <li key={change.id} className="rounded-lg border border-ink/10 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {change.hotelSlug
                        ? (getHotelBySlug(change.hotelSlug)?.name ?? change.hotelSlug)
                        : 'All properties'}
                    </p>
                    <p className="text-xs text-ink/50">
                      {formatDate(change.at)} {formatTime(change.at)} · {change.actorLabel}
                    </p>
                  </div>
                  {change.summary && <p className="mt-1 text-xs text-ink/70">{change.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
