import { DailyRateForm } from '@/components/admin/daily-rate-form';
import { RatesTabs } from '@/components/admin/rates-tabs';
import { hotels } from '@/content/hotels';
import { formatDate, formatTime } from '@/lib/admin-format';
import { can, canAccessHotel, getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hotelScopeFilter } from '@/lib/roles';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const RECENT_OVERRIDES = 12;

export default async function DailyRatesPage() {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'rates:write')) notFound();

  const visibleHotels = hotels.filter((hotel) => canAccessHotel(viewer, hotel.slug));
  if (visibleHotels.length === 0) notFound();

  const roomTypes = await prisma.roomType.findMany({
    where: { hotelSlug: { in: visibleHotels.map((hotel) => hotel.slug) }, active: true },
    orderBy: [{ hotelSlug: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, name: true, hotelSlug: true },
  });

  const recent = await prisma.auditEvent.findMany({
    where: {
      action: 'rates.day_overridden',
      ...hotelScopeFilter(viewer),
    },
    orderBy: { at: 'desc' },
    take: RECENT_OVERRIDES,
  });

  const withRooms = visibleHotels
    .map((hotel) => ({
      slug: hotel.slug,
      name: hotel.name,
      rooms: roomTypes
        .filter((room) => room.hotelSlug === hotel.slug)
        .map((room) => ({ roomTypeId: room.id, roomName: room.name })),
    }))
    .filter((hotel) => hotel.rooms.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Daily Rates</p>
        <p className="mt-1 text-sm text-ink/60">
          One night, overriding whatever the month laid down — a wedding weekend, a conference, a
          night to hold back.
        </p>
        <RatesTabs active="/admin/rates/daily" />
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="max-w-3xl pb-6">
          {withRooms.length === 0 ? (
            <p className="rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
              No active room types yet. Run <code>pnpm sync:rooms</code>.
            </p>
          ) : (
            <DailyRateForm hotels={withRooms} />
          )}

          <section className="mt-8">
            <p className="font-display text-lg text-forest">Recent overrides</p>
            <p className="mt-1 text-xs text-ink/50">
              Nights set here rather than by a monthly save, newest first.
            </p>
            {recent.length === 0 ? (
              <p className="mt-3 rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
                No nights have been overridden yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recent.map((event) => (
                  <li key={event.id} className="rounded-lg border border-ink/10 bg-white p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{event.summary}</p>
                      <p className="text-xs text-ink/50">
                        {formatDate(event.at)} {formatTime(event.at)} · {event.actorLabel}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
