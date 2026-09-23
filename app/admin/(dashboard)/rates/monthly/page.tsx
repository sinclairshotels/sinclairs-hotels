import { AddRoomTypeRow } from '@/components/admin/add-room-type-row';
import { HotelSetupForm } from '@/components/admin/hotel-setup-form';
import { type MonthlyBaseline, MonthlyRatesTable } from '@/components/admin/monthly-rates-table';
import { NonRefundableWindows } from '@/components/admin/non-refundable-windows';
import { RatesTabs } from '@/components/admin/rates-tabs';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { can, canAccessHotel, getSession } from '@/lib/auth';
import { dateKey, formatStayDate, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { MONTHS_AHEAD, monthKey, monthsAhead } from '@/lib/rate-plan';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// What a month already holds, but only where it holds one value throughout.
// A month that is 4,950 for three weeks and 6,200 for the rest has no single
// monthly value, and showing either would invite staff to "confirm" a number
// that would flatten the other.
async function monthlyBaseline(hotelSlug: string, months: string[]) {
  const today = todayUtc();
  const first = new Date(`${months[0]}-01T00:00:00.000Z`);
  const lastKey = months[months.length - 1] as string;
  const [lastYear, lastMonth] = lastKey.split('-').map(Number) as [number, number];
  const end = new Date(Date.UTC(lastYear, lastMonth, 1));
  const from = first < today ? today : first;

  const [inventory, prices, plans] = await Promise.all([
    prisma.roomInventory.findMany({
      where: { hotelSlug, date: { gte: from, lt: end } },
      select: { roomTypeId: true, date: true, roomsOnSale: true, source: true },
    }),
    prisma.ratePrice.findMany({
      where: { hotelSlug, date: { gte: from, lt: end }, ratePlan: { code: 'EP' } },
      select: { ratePlanId: true, date: true, amount: true, source: true },
    }),
    prisma.ratePlan.findMany({
      where: { hotelSlug, code: 'EP' },
      select: { id: true, roomTypeId: true },
    }),
  ]);

  const roomByPlan = new Map(plans.map((plan) => [plan.id, plan.roomTypeId]));

  const rooms = new Map<string, Set<number>>();
  const rates = new Map<string, Set<number>>();
  const overriddenByMonth: Record<string, number> = {};
  const overriddenNights = new Set<string>();

  for (const row of inventory) {
    const key = `${row.roomTypeId}:${monthKey(row.date)}`;
    (rooms.get(key) ?? rooms.set(key, new Set()).get(key))?.add(row.roomsOnSale);
    if (row.source === 'DAILY') overriddenNights.add(`${row.roomTypeId}:${dateKey(row.date)}`);
  }

  for (const row of prices) {
    const roomTypeId = roomByPlan.get(row.ratePlanId);
    if (!roomTypeId) continue;
    const key = `${roomTypeId}:${monthKey(row.date)}`;
    (rates.get(key) ?? rates.set(key, new Set()).get(key))?.add(row.amount.toNumber());
    if (row.source === 'DAILY') overriddenNights.add(`${roomTypeId}:${dateKey(row.date)}`);
  }

  for (const night of overriddenNights) {
    const month = (night.split(':')[1] as string).slice(0, 7);
    overriddenByMonth[month] = (overriddenByMonth[month] ?? 0) + 1;
  }

  const baseline: MonthlyBaseline = {};
  const only = (values: Set<number> | undefined) =>
    values && values.size === 1 ? ([...values][0] as number) : null;
  const mixed = (values: Set<number> | undefined) => (values?.size ?? 0) > 1;

  for (const key of new Set([...rooms.keys(), ...rates.keys()])) {
    baseline[key] = {
      roomsOnSale: only(rooms.get(key)),
      rate: only(rates.get(key)),
      roomsMixed: mixed(rooms.get(key)),
      rateMixed: mixed(rates.get(key)),
    };
  }

  return { baseline, overriddenByMonth };
}

export default async function MonthlyRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ hotel?: string }>;
}) {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'rates:write')) notFound();

  const { hotel: hotelParam } = await searchParams;
  const visibleHotels = hotels.filter((hotel) => canAccessHotel(viewer, hotel.slug));
  if (visibleHotels.length === 0) notFound();

  const selected =
    visibleHotels.find((hotel) => hotel.slug === hotelParam)?.slug ??
    (visibleHotels[0]?.slug as string);

  const months = monthsAhead(todayUtc(), MONTHS_AHEAD);
  const [roomTypes, settings, windows] = await Promise.all([
    prisma.roomType.findMany({
      where: { hotelSlug: selected, active: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.hotelSettings.findUnique({ where: { hotelSlug: selected } }),
    prisma.nonRefundableWindow.findMany({
      where: { hotelSlug: selected },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  const today = todayUtc();
  const windowRows = windows.map((window) => ({
    id: window.id,
    startDate: dateKey(window.startDate),
    endDate: dateKey(window.endDate),
    label: window.label,
    span: `${formatStayDate(window.startDate)} – ${formatStayDate(window.endDate)}`,
    past: window.endDate < today,
  }));
  const coveredTo = windowRows.filter((window) => !window.past).at(-1)?.endDate ?? null;
  const { baseline, overriddenByMonth } = await monthlyBaseline(selected, months);

  // A room added in the back office has no entry in content/hotels, so the
  // website has no photograph for it until one is added there.
  const photographed = new Set(getHotelBySlug(selected)?.rooms.map((room) => room.name) ?? []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Set-up: rooms and monthly rates</p>
        <p className="mt-1 text-sm text-ink/60">
          The rooms this property sells and what they cost. A month is the baseline — one save
          applies each value to every night of it.
        </p>
        <RatesTabs active="/admin/rates/monthly" />
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-end gap-6">
          <form method="get" className="flex flex-nowrap items-center gap-2">
            <select
              name="hotel"
              defaultValue={selected}
              className="select w-auto shrink-0 py-1.5 text-sm"
            >
              {visibleHotels.map((hotel) => (
                <option key={hotel.slug} value={hotel.slug}>
                  {hotel.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="shrink-0 rounded bg-forest px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-forest-dark"
            >
              Show
            </button>
          </form>

          <HotelSetupForm
            key={selected}
            hotelSlug={selected}
            amount={settings?.breakfastSupplement.toNumber() ?? 0}
            refundableUpliftPct={settings?.refundableUpliftPct?.toNumber() ?? null}
            freeCancellationDays={settings?.freeCancellationDays ?? null}
          />
        </div>

        <p className="mt-2 text-xs text-ink/50">
          With Breakfast is Room Only plus the supplement, per person per night, times the
          room&rsquo;s base guests. Leave both refundable boxes empty to sell the non-refundable
          rate only; fill both to offer a refundable rate alongside it.
        </p>

        <div className="mt-4">
          <NonRefundableWindows
            key={selected}
            hotelSlug={selected}
            windows={windowRows}
            today={dateKey(today)}
            coveredTo={coveredTo}
          />
        </div>

        <div className="mt-4 pb-6">
          {roomTypes.length === 0 ? (
            <p className="rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
              This property has no active room types yet. Run <code>pnpm sync:rooms</code>.
            </p>
          ) : (
            <MonthlyRatesTable
              key={selected}
              hotelSlug={selected}
              rooms={roomTypes.map((room) => ({
                roomTypeId: room.id,
                roomName: room.name,
                baseOccupancy: room.baseOccupancy,
                maxAdults: room.maxAdults,
                maxChildren: room.maxChildren,
                extraAdultCharge: room.extraAdultCharge.toNumber(),
                extraChildCharge: room.extraChildCharge.toNumber(),
                hasPhoto: photographed.has(room.contentKey),
              }))}
              months={months}
              baseline={baseline}
              overriddenByMonth={overriddenByMonth}
            />
          )}

          <div className="mt-4">
            <AddRoomTypeRow key={selected} hotelSlug={selected} />
          </div>

          <p className="mt-6 text-xs text-ink/50">
            Setting a single night instead?{' '}
            <Link href="/admin/rates/daily" className="text-forest underline">
              Use the Daily screen
            </Link>
            , which wins over whatever the month says.
          </p>
        </div>
      </div>
    </div>
  );
}
