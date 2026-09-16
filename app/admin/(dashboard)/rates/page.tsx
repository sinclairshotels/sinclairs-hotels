import { RateGridForm } from '@/components/admin/rate-grid-form';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { formatDate } from '@/lib/admin-format';
import { addDays, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const LOOKAHEAD_DAYS = 120;

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ hotel?: string }>;
}) {
  const { hotel: hotelFilter } = await searchParams;
  const today = todayUtc();
  const horizon = addDays(today, LOOKAHEAD_DAYS);

  // Summarised rather than listed night by night: 120 days across every room
  // is thousands of rows, and what staff need to see is where the calendar
  // runs out, not each individual price.
  const loaded = await prisma.roomRate.groupBy({
    by: ['hotelSlug', 'roomName'],
    where: {
      date: { gte: today, lte: horizon },
      ...(hotelFilter ? { hotelSlug: hotelFilter } : {}),
    },
    _count: { _all: true },
    _min: { date: true, rate: true },
    _max: { date: true, rate: true },
  });

  const rows = loaded.sort(
    (a, b) =>
      (getHotelBySlug(a.hotelSlug)?.name ?? a.hotelSlug).localeCompare(
        getHotelBySlug(b.hotelSlug)?.name ?? b.hotelSlug,
      ) || a.roomName.localeCompare(b.roomName),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Rates &amp; Availability</p>
        <p className="mt-1 text-sm text-ink/60">
          What this website may sell direct. A room is only offered online for nights that have a
          rate loaded here.
        </p>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="max-w-3xl rounded-lg border border-ink/10 bg-white p-6">
          <RateGridForm hotels={hotels} />
        </div>

        <div className="mt-8 max-w-3xl">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-display text-lg text-forest">Loaded — next {LOOKAHEAD_DAYS} days</p>
            <form method="get">
              <select
                name="hotel"
                defaultValue={hotelFilter ?? ''}
                className="select w-auto py-1.5 text-sm"
              >
                <option value="">All hotels</option>
                {hotels.map((hotel) => (
                  <option key={hotel.slug} value={hotel.slug}>
                    {hotel.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="ml-2 rounded bg-forest px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-forest-dark"
              >
                Filter
              </button>
            </form>
          </div>

          {rows.length === 0 ? (
            <p className="mt-4 rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
              Nothing loaded yet — until a room has rates here, the booking pages will tell guests
              that direct booking is not open for that property.
            </p>
          ) : (
            <table className="mt-4 w-full border-collapse overflow-hidden rounded-lg bg-white text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink/50">
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Nights</th>
                  <th className="px-4 py-3 font-medium">Loaded through</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const min = row._min.rate?.toNumber() ?? 0;
                  const max = row._max.rate?.toNumber() ?? 0;
                  return (
                    <tr key={`${row.hotelSlug}-${row.roomName}`} className="border-b border-ink/5">
                      <td className="px-4 py-3">
                        {getHotelBySlug(row.hotelSlug)?.name ?? row.hotelSlug}
                      </td>
                      <td className="px-4 py-3 text-ink/70">{row.roomName}</td>
                      <td className="px-4 py-3 text-ink/70">{row._count._all}</td>
                      <td className="px-4 py-3 text-ink/70">
                        {row._max.date ? formatDate(row._max.date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-ink/70">
                        {min === max
                          ? `₹${min.toLocaleString('en-IN')}`
                          : `₹${min.toLocaleString('en-IN')} – ₹${max.toLocaleString('en-IN')}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
