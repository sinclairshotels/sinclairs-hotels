import { hotels } from '@/content/hotels';
import { heldBookingFilter } from '@/lib/availability';
import { addDays, dateKey, eachNight, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';

export interface CalendarCell {
  date: string;
  rate: number | null;
  onSale: number;
  sold: number;
  remaining: number;
  closed: boolean;
}

export interface CalendarRow {
  roomTypeId: string;
  roomName: string;
  ratePlanId: string;
  ratePlanName: string;
  cells: CalendarCell[];
}

export interface RateCalendar {
  hotelSlug: string;
  hotelName: string;
  dates: string[];
  holidays: Record<string, string>;
  rows: CalendarRow[];
}

// Dates across, room types down. "Sold" counts the rooms currently held by
// bookings on that night — the same held-booking rule availability uses, so
// what staff read here is what a guest would be offered, not a second opinion.
// Inventory is per room type and price is per rate plan, so a row is a
// (room type, plan) pair: the same "5 on sale" repeats down a room's plans
// because the plans share those five rooms.
export async function rateCalendar({
  hotelSlug,
  from,
  days,
  now = new Date(),
}: {
  hotelSlug: string;
  from: Date;
  days: number;
  now?: Date;
}): Promise<RateCalendar | null> {
  const hotel = hotels.find((h) => h.slug === hotelSlug);
  const to = addDays(from, days);
  const dates = eachNight(from, to);
  if (!hotel || dates.length === 0) return null;

  const [roomTypes, inventory, prices, bookings, holidays] = await Promise.all([
    prisma.roomType.findMany({
      where: { hotelSlug, active: true },
      include: { ratePlans: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.roomInventory.findMany({ where: { hotelSlug, date: { gte: from, lt: to } } }),
    prisma.ratePrice.findMany({ where: { hotelSlug, date: { gte: from, lt: to } } }),
    prisma.booking.findMany({
      where: {
        hotelSlug,
        checkIn: { lt: to },
        checkOut: { gt: from },
        ...heldBookingFilter(now),
      },
      select: { roomTypeId: true, rooms: true, checkIn: true, checkOut: true },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: from, lt: to }, OR: [{ hotelSlug: null }, { hotelSlug }] },
    }),
  ]);

  const inventoryByRoom = new Map<string, Map<string, (typeof inventory)[number]>>();
  for (const row of inventory) {
    const byNight = inventoryByRoom.get(row.roomTypeId) ?? new Map();
    byNight.set(dateKey(row.date), row);
    inventoryByRoom.set(row.roomTypeId, byNight);
  }

  const priceByPlan = new Map<string, Map<string, number>>();
  for (const row of prices) {
    const byNight = priceByPlan.get(row.ratePlanId) ?? new Map<string, number>();
    byNight.set(dateKey(row.date), row.amount.toNumber());
    priceByPlan.set(row.ratePlanId, byNight);
  }

  const soldByRoom = new Map<string, Map<string, number>>();
  for (const booking of bookings) {
    if (!booking.roomTypeId) continue;
    const byNight = soldByRoom.get(booking.roomTypeId) ?? new Map<string, number>();
    for (const night of eachNight(booking.checkIn, booking.checkOut)) {
      const key = dateKey(night);
      byNight.set(key, (byNight.get(key) ?? 0) + booking.rooms);
    }
    soldByRoom.set(booking.roomTypeId, byNight);
  }

  const rows: CalendarRow[] = [];

  for (const roomType of roomTypes) {
    for (const plan of roomType.ratePlans) {
      rows.push({
        roomTypeId: roomType.id,
        roomName: roomType.name,
        ratePlanId: plan.id,
        ratePlanName: plan.name,
        cells: dates.map((date) => {
          const key = dateKey(date);
          const row = inventoryByRoom.get(roomType.id)?.get(key);
          const sold = soldByRoom.get(roomType.id)?.get(key) ?? 0;
          const onSale = row?.roomsOnSale ?? 0;

          return {
            date: key,
            rate: priceByPlan.get(plan.id)?.get(key) ?? null,
            onSale,
            sold,
            remaining: Math.max(0, onSale - sold),
            closed: row?.stopSell ?? false,
          };
        }),
      });
    }
  }

  return {
    hotelSlug,
    hotelName: hotel.name,
    dates: dates.map(dateKey),
    holidays: Object.fromEntries(holidays.map((h) => [dateKey(h.date), h.name])),
    rows,
  };
}

export interface CoverageWarning {
  hotelSlug: string;
  hotelName: string;
  roomName: string;
  lastNight: string | null;
  daysLeft: number;
}

// How far ahead a room type has to be loaded before it stops being urgent.
export const COVERAGE_WARNING_DAYS = 30;

// Every room type across every property that either has no sellable nights at
// all or runs out within the warning window. A calendar quietly running out is
// the failure mode with no symptom — the site simply stops offering the room.
export async function coverageWarnings(now: Date = new Date()): Promise<CoverageWarning[]> {
  const today = todayUtc(now);

  const [roomTypes, loaded] = await Promise.all([
    prisma.roomType.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.roomInventory.groupBy({
      by: ['roomTypeId'],
      where: { date: { gte: today }, stopSell: false, roomsOnSale: { gt: 0 } },
      _max: { date: true },
    }),
  ]);

  const lastNightByRoom = new Map(loaded.map((row) => [row.roomTypeId, row._max.date]));
  const hotelName = new Map(hotels.map((hotel) => [hotel.slug, hotel.name]));
  const warnings: CoverageWarning[] = [];

  for (const roomType of roomTypes) {
    const lastNight = lastNightByRoom.get(roomType.id);
    const daysLeft = lastNight
      ? Math.round((lastNight.getTime() - today.getTime()) / 86_400_000)
      : 0;

    if (!lastNight || daysLeft <= COVERAGE_WARNING_DAYS) {
      warnings.push({
        hotelSlug: roomType.hotelSlug,
        hotelName: hotelName.get(roomType.hotelSlug) ?? roomType.hotelSlug,
        roomName: roomType.name,
        lastNight: lastNight ? dateKey(lastNight) : null,
        daysLeft,
      });
    }
  }

  // Emptiest first: a room with nothing loaded is more urgent than one with
  // three weeks left.
  return warnings.sort((a, b) => a.daysLeft - b.daysLeft);
}
