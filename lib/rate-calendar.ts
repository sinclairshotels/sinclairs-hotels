import { getHotelBySlug, hotels } from '@/content/hotels';
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
  roomName: string;
  cells: CalendarCell[];
}

export interface RateCalendar {
  hotelSlug: string;
  hotelName: string;
  dates: string[];
  rows: CalendarRow[];
}

// Dates across, room types down. "Sold" counts the rooms currently held by
// bookings on that night — the same held-booking rule availability uses, so
// what staff read here is what a guest would be offered, not a second opinion.
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
  const hotel = getHotelBySlug(hotelSlug);
  if (!hotel) return null;

  const to = addDays(from, days);
  const dates = eachNight(from, to);

  const [rates, bookings] = await Promise.all([
    prisma.roomRate.findMany({
      where: { hotelSlug, date: { gte: from, lt: to } },
    }),
    prisma.booking.findMany({
      where: {
        hotelSlug,
        checkIn: { lt: to },
        checkOut: { gt: from },
        ...heldBookingFilter(now),
      },
      select: { roomName: true, rooms: true, checkIn: true, checkOut: true },
    }),
  ]);

  const rateByRoom = new Map<string, Map<string, (typeof rates)[number]>>();
  for (const rate of rates) {
    const byNight = rateByRoom.get(rate.roomName) ?? new Map();
    byNight.set(dateKey(rate.date), rate);
    rateByRoom.set(rate.roomName, byNight);
  }

  const soldByRoom = new Map<string, Map<string, number>>();
  for (const booking of bookings) {
    const byNight = soldByRoom.get(booking.roomName) ?? new Map<string, number>();
    for (const night of eachNight(booking.checkIn, booking.checkOut)) {
      const key = dateKey(night);
      byNight.set(key, (byNight.get(key) ?? 0) + booking.rooms);
    }
    soldByRoom.set(booking.roomName, byNight);
  }

  return {
    hotelSlug,
    hotelName: hotel.name,
    dates: dates.map(dateKey),
    // Driven by the content file's room order so the grid matches every other
    // list of this hotel's rooms.
    rows: hotel.rooms.map((room) => ({
      roomName: room.name,
      cells: dates.map((date) => {
        const key = dateKey(date);
        const loaded = rateByRoom.get(room.name)?.get(key);
        const sold = soldByRoom.get(room.name)?.get(key) ?? 0;
        const onSale = loaded?.totalRooms ?? 0;

        return {
          date: key,
          rate: loaded ? loaded.rate.toNumber() : null,
          onSale,
          sold,
          remaining: Math.max(0, onSale - sold),
          closed: loaded?.closed ?? false,
        };
      }),
    })),
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

// Every room type across every property that either has no rates at all or
// runs out within the warning window. A calendar quietly running out is the
// failure mode with no symptom — the site simply stops offering the room, and
// nothing else on this screen would say so.
export async function coverageWarnings(now: Date = new Date()): Promise<CoverageWarning[]> {
  const today = todayUtc(now);

  const loaded = await prisma.roomRate.groupBy({
    by: ['hotelSlug', 'roomName'],
    where: { date: { gte: today }, closed: false, totalRooms: { gt: 0 } },
    _max: { date: true },
  });

  const lastNightByRoom = new Map(
    loaded.map((row) => [`${row.hotelSlug}::${row.roomName}`, row._max.date]),
  );

  const warnings: CoverageWarning[] = [];

  for (const hotel of hotels) {
    for (const room of hotel.rooms) {
      const lastNight = lastNightByRoom.get(`${hotel.slug}::${room.name}`);
      const daysLeft = lastNight
        ? Math.round((lastNight.getTime() - today.getTime()) / 86_400_000)
        : 0;

      if (!lastNight || daysLeft <= COVERAGE_WARNING_DAYS) {
        warnings.push({
          hotelSlug: hotel.slug,
          hotelName: hotel.name,
          roomName: room.name,
          lastNight: lastNight ? dateKey(lastNight) : null,
          daysLeft,
        });
      }
    }
  }

  // Emptiest first: a room with nothing loaded is more urgent than one with
  // three weeks left.
  return warnings.sort((a, b) => a.daysLeft - b.daysLeft);
}
