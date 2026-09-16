import { RateCalendarGrid } from '@/components/admin/rate-calendar-grid';
import { type LoadableProperty, RateGridForm } from '@/components/admin/rate-grid-form';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { formatDate, formatTime } from '@/lib/admin-format';
import { addDays, dateKey, parseDateOnly, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { COVERAGE_WARNING_DAYS, coverageWarnings, rateCalendar } from '@/lib/rate-calendar';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const LOOKAHEAD_DAYS = 120;
const CALENDAR_DAYS = 14;
const RECENT_CHANGES = 12;

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ hotel?: string; from?: string }>;
}) {
  const { hotel: hotelParam, from: fromParam } = await searchParams;
  const today = todayUtc();

  const selectedHotel = getHotelBySlug(hotelParam ?? '')?.slug ?? hotels[0]?.slug ?? '';
  // Clamped to today: the grid is a selling tool, and there is nothing to
  // load into last week.
  const requestedFrom = parseDateOnly(fromParam ?? '') ?? today;
  const calendarFrom = requestedFrom < today ? today : requestedFrom;

  const [calendar, warnings, loaded, changes] = await Promise.all([
    rateCalendar({ hotelSlug: selectedHotel, from: calendarFrom, days: CALENDAR_DAYS }),
    coverageWarnings(),
    prisma.roomInventory.groupBy({
      by: ['hotelSlug', 'roomTypeId'],
      where: { date: { gte: today, lte: addDays(today, LOOKAHEAD_DAYS) } },
      _count: { _all: true },
      _max: { date: true },
    }),
    prisma.auditEvent.findMany({
      where: { action: { startsWith: 'rates.' } },
      orderBy: { at: 'desc' },
      take: RECENT_CHANGES,
    }),
  ]);

  const roomTypeNames = new Map(
    (
      await prisma.roomType.findMany({
        where: { id: { in: loaded.map((row) => row.roomTypeId) } },
        select: { id: true, name: true },
      })
    ).map((room) => [room.id, room.name]),
  );

  const summary = loaded
    .map((row) => ({ ...row, roomName: roomTypeNames.get(row.roomTypeId) ?? row.roomTypeId }))
    .sort(
      (a, b) =>
        (getHotelBySlug(a.hotelSlug)?.name ?? a.hotelSlug).localeCompare(
          getHotelBySlug(b.hotelSlug)?.name ?? b.hotelSlug,
        ) || a.roomName.localeCompare(b.roomName),
    );

  const calendarHref = (overrides: Record<string, string>) =>
    `/admin/rates?${new URLSearchParams({ hotel: selectedHotel, from: dateKey(calendarFrom), ...overrides })}`;

  // Built from the database, not the content files: the loader posts room type
  // and rate plan ids, which only exist here.
  const loadableProperties: LoadableProperty[] = (
    await prisma.roomType.findMany({
      where: { active: true },
      include: { ratePlans: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ hotelSlug: 'asc' }, { sortOrder: 'asc' }],
    })
  ).reduce<LoadableProperty[]>((properties, roomType) => {
    const property = properties.find((p) => p.slug === roomType.hotelSlug);
    const entry = property ?? {
      slug: roomType.hotelSlug,
      name: getHotelBySlug(roomType.hotelSlug)?.name ?? roomType.hotelSlug,
      roomTypes: [],
    };
    entry.roomTypes.push({
      id: roomType.id,
      name: roomType.name,
      ratePlans: roomType.ratePlans.map((plan) => ({ id: plan.id, name: plan.name })),
    });
    if (!property) properties.push(entry);
    return properties;
  }, []);

  const missing = warnings.filter((w) => w.lastNight === null);
  const expiring = warnings.filter((w) => w.lastNight !== null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Rates &amp; Availability</p>
        <p className="mt-1 text-sm text-ink/60">
          What this website may sell direct. A room is only offered online for nights that have a
          rate loaded here.
        </p>
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
              {warnings.slice(0, 12).map((warning) => (
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
              {warnings.length > 12 && (
                <li className="self-center text-xs text-ink/50">and {warnings.length - 12} more</li>
              )}
            </ul>
          </section>
        )}

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-lg text-forest">Calendar</p>
            {/* Same shape as the Bookings filter bar, so the two admin
                screens read as one tool. */}
            <form method="get" className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              <input type="hidden" name="from" value={dateKey(calendarFrom)} />
              <select
                name="hotel"
                defaultValue={selectedHotel}
                className="select w-auto shrink-0 py-1.5 text-sm"
              >
                {hotels.map((hotel) => (
                  <option key={hotel.slug} value={hotel.slug}>
                    {hotel.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="shrink-0 whitespace-nowrap rounded bg-forest px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-forest-dark"
              >
                Filter
              </button>
            </form>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <Link
              href={calendarHref({ from: dateKey(addDays(calendarFrom, -CALENDAR_DAYS)) })}
              className="rounded border border-ink/15 px-3 py-1.5 text-xs uppercase tracking-wider text-ink/60 transition hover:border-forest hover:text-forest"
            >
              &larr; Earlier
            </Link>
            <p className="text-xs uppercase tracking-wider text-ink/50">
              {formatDate(calendarFrom)} &ndash;{' '}
              {formatDate(addDays(calendarFrom, CALENDAR_DAYS - 1))}
            </p>
            <Link
              href={calendarHref({ from: dateKey(addDays(calendarFrom, CALENDAR_DAYS)) })}
              className="rounded border border-ink/15 px-3 py-1.5 text-xs uppercase tracking-wider text-ink/60 transition hover:border-forest hover:text-forest"
            >
              Later &rarr;
            </Link>
          </div>

          <div className="mt-3">
            {calendar ? (
              <RateCalendarGrid calendar={calendar} />
            ) : (
              <p className="rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
                Pick a property to see its calendar.
              </p>
            )}
          </div>
        </section>

        <section className="max-w-3xl">
          <p className="font-display text-lg text-forest">Load a season</p>
          <div className="mt-3 rounded-lg border border-ink/10 bg-white p-6">
            <RateGridForm properties={loadableProperties} />
          </div>
        </section>

        <section className="max-w-3xl">
          <p className="font-display text-lg text-forest">Loaded — next {LOOKAHEAD_DAYS} days</p>
          {summary.length === 0 ? (
            <p className="mt-3 rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
              Nothing loaded yet — until a room has rates here, the booking pages will tell guests
              that direct booking is not open for that property.
            </p>
          ) : (
            <table className="mt-3 w-full border-collapse overflow-hidden rounded-lg bg-white text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink/50">
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Nights</th>
                  <th className="px-4 py-3 font-medium">Loaded through</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => {
                  return (
                    <tr
                      key={`${row.hotelSlug}-${row.roomTypeId}`}
                      className="border-b border-ink/5"
                    >
                      <td className="px-4 py-3">
                        {getHotelBySlug(row.hotelSlug)?.name ?? row.hotelSlug}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink/70">{row.roomName}</td>
                      <td className="px-4 py-3 text-ink/70">{row._count._all}</td>
                      <td className="px-4 py-3 text-ink/70">
                        {row._max.date ? formatDate(row._max.date) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="max-w-3xl pb-4">
          <p className="font-display text-lg text-forest">Change log</p>
          <p className="mt-1 text-xs text-ink/50">
            Every rate write, newest first. Signed in as the shared admin account, so
            &ldquo;who&rdquo; is the login and its address until per-user staff accounts exist.
          </p>
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
                      {change.ip ? ` · ${change.ip}` : ''}
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
