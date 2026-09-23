import { hotels } from '@/content/hotels';
import { heldBookingFilter } from '@/lib/availability';
import { addDays, dateKey, eachNight, todayInIndia } from '@/lib/booking';
import { prisma } from '@/lib/db';

export interface CalendarCell {
  date: string;
  // Room Only, the one plan that has a calendar of its own.
  rate: number | null;
  // With Breakfast, worked out rather than stored: Room Only plus the
  // property's supplement for each of the room's base guests, which is exactly
  // what lib/availability.ts charges. It used to render as a dash, which read
  // as "no rate loaded" for a plan that is always on sale wherever Room Only
  // is. Null only when Room Only itself is missing, or the property charges no
  // supplement — there is nothing to add then, so the two rates are the same
  // number and printing it twice says nothing.
  breakfastRate: number | null;
  onSale: number;
  sold: number;
  remaining: number;
  closed: boolean;
  minStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  // A night a daily save has pinned. The monthly screen steps around these
  // unless staff ask for them to be replaced, so the calendar marks them.
  overridden: boolean;
}

// One row per room, not per (room, plan). The plans share one allotment, so
// the second row repeated the same inventory under a different name and made
// the grid twice as tall as it needed to be for a property with four rooms.
export interface CalendarRow {
  roomTypeId: string;
  roomName: string;
  baseOccupancy: number;
  cells: CalendarCell[];
}

export interface RateCalendar {
  hotelSlug: string;
  hotelName: string;
  // Zero means With Breakfast is not on sale here at all — lib/availability.ts
  // only offers the plan where there is a supplement to add — which is why
  // every cell shows one rate rather than two.
  breakfastSupplement: number;
  dates: string[];
  holidays: Record<string, string>;
  rows: CalendarRow[];
}

// The lengths of calendar staff can ask for. Fourteen is the working view,
// sixty is for checking a season holds together.
export const CALENDAR_VIEWS = [14, 30, 60] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export function parseCalendarView(value: string | undefined): CalendarView {
  const days = Number.parseInt(value ?? '', 10);
  return (CALENDAR_VIEWS as readonly number[]).includes(days) ? (days as CalendarView) : 14;
}

// Dates across, room types down. "Sold" counts the rooms currently held by
// bookings on that night — the same held-booking rule availability uses, so
// what staff read here is what a guest would be offered, not a second opinion.
// Inventory is per room type and price is per rate plan, but only Room Only
// carries prices — With Breakfast is derived from it — so a row is a room and
// the cell carries both figures.
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

  const [roomTypes, inventory, prices, bookings, holidays, settings] = await Promise.all([
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
    prisma.hotelSettings.findUnique({ where: { hotelSlug } }),
  ]);

  const breakfast = settings?.breakfastSupplement.toNumber() ?? 0;

  const inventoryByRoom = new Map<string, Map<string, (typeof inventory)[number]>>();
  for (const row of inventory) {
    const byNight = inventoryByRoom.get(row.roomTypeId) ?? new Map();
    byNight.set(dateKey(row.date), row);
    inventoryByRoom.set(row.roomTypeId, byNight);
  }

  const priceByPlan = new Map<string, Map<string, (typeof prices)[number]>>();
  for (const row of prices) {
    const byNight = priceByPlan.get(row.ratePlanId) ?? new Map<string, (typeof prices)[number]>();
    byNight.set(dateKey(row.date), row);
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
    const roomOnly = roomType.ratePlans.find((plan) => plan.code === 'EP');
    // What one more breakfast-inclusive night costs over Room Only: the
    // supplement for every guest the rate already covers.
    const supplement = breakfast * roomType.baseOccupancy;

    rows.push({
      roomTypeId: roomType.id,
      roomName: roomType.name,
      baseOccupancy: roomType.baseOccupancy,
      cells: dates.map((date) => {
        const key = dateKey(date);
        const row = inventoryByRoom.get(roomType.id)?.get(key);
        const price = roomOnly ? priceByPlan.get(roomOnly.id)?.get(key) : undefined;
        const sold = soldByRoom.get(roomType.id)?.get(key) ?? 0;
        const onSale = row?.roomsOnSale ?? 0;
        const rate = price ? price.amount.toNumber() : null;

        return {
          date: key,
          rate,
          breakfastRate: rate !== null && supplement > 0 ? rate + supplement : null,
          onSale,
          sold,
          remaining: Math.max(0, onSale - sold),
          closed: row?.stopSell ?? false,
          minStay: row?.minStay ?? null,
          closedToArrival: row?.closedToArrival ?? false,
          closedToDeparture: row?.closedToDeparture ?? false,
          overridden: row?.source === 'DAILY' || price?.source === 'DAILY',
        };
      }),
    });
  }

  return {
    hotelSlug,
    hotelName: hotel.name,
    breakfastSupplement: breakfast,
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
  const today = todayInIndia(now);

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
