import { getHotelBySlug } from '@/content/hotels';
import type { RoomType } from '@/content/types';
import { HOLD_MINUTES, type StayQuote, dateKey, eachNight, quoteStay } from '@/lib/booking';
import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient } from '@prisma/client';

// Accepts either the shared client or an interactive transaction client, so
// the same availability read backs both the public search page and the
// re-check inside the serializable transaction that creates a booking.
type Db = PrismaClient | Prisma.TransactionClient;

export interface RoomOffer {
  room: RoomType;
  roomsLeft: number;
  nightlyRates: number[];
  quote: StayQuote;
}

// What a PENDING_PAYMENT booking still holds. It is mid-payment so its rooms
// are not free, but an abandoned attempt must not hold them forever — after
// HOLD_MINUTES it simply stops matching, with nothing to sweep.
export function heldBookingFilter(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: 'CONFIRMED' },
      {
        status: 'PENDING_PAYMENT',
        createdAt: { gt: new Date(now.getTime() - HOLD_MINUTES * 60_000) },
      },
    ],
  };
}

export interface AvailabilityQuery {
  hotelSlug: string;
  checkIn: Date;
  checkOut: Date;
  rooms: number;
  now?: Date;
}

// Every room type at a property that can be sold for the whole of the
// requested stay, priced for `rooms` rooms. A room type is offered only if
// it has an open RoomRate row for *every* night — a gap in the calendar is
// an unpriced night, which is a "not bookable" rather than something to
// guess a rate for.
export async function roomOffers(
  db: Db,
  { hotelSlug, checkIn, checkOut, rooms, now = new Date() }: AvailabilityQuery,
): Promise<RoomOffer[]> {
  const hotel = getHotelBySlug(hotelSlug);
  const nights = eachNight(checkIn, checkOut);
  if (!hotel || nights.length === 0) return [];

  const [rates, heldBookings] = await Promise.all([
    db.roomRate.findMany({
      where: { hotelSlug, date: { gte: checkIn, lt: checkOut }, closed: false },
    }),
    db.booking.findMany({
      where: {
        hotelSlug,
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...heldBookingFilter(now),
      },
      select: { roomName: true, rooms: true, checkIn: true, checkOut: true },
    }),
  ]);

  const ratesByRoomAndNight = new Map<string, Map<string, { rate: number; totalRooms: number }>>();
  for (const rate of rates) {
    const byNight = ratesByRoomAndNight.get(rate.roomName) ?? new Map();
    byNight.set(dateKey(rate.date), { rate: rate.rate.toNumber(), totalRooms: rate.totalRooms });
    ratesByRoomAndNight.set(rate.roomName, byNight);
  }

  const heldByRoomAndNight = new Map<string, Map<string, number>>();
  for (const booking of heldBookings) {
    const byNight = heldByRoomAndNight.get(booking.roomName) ?? new Map<string, number>();
    for (const night of eachNight(booking.checkIn, booking.checkOut)) {
      const key = dateKey(night);
      byNight.set(key, (byNight.get(key) ?? 0) + booking.rooms);
    }
    heldByRoomAndNight.set(booking.roomName, byNight);
  }

  const offers: RoomOffer[] = [];

  // Driven by the content file's room order, not the database's, so the
  // booking page lists rooms the same way the hotel page does.
  for (const room of hotel.rooms) {
    const ratesForRoom = ratesByRoomAndNight.get(room.name);
    if (!ratesForRoom) continue;

    const heldForRoom = heldByRoomAndNight.get(room.name);
    const nightlyRates: number[] = [];
    let roomsLeft = Number.POSITIVE_INFINITY;

    for (const night of nights) {
      const key = dateKey(night);
      const loaded = ratesForRoom.get(key);
      if (!loaded) {
        nightlyRates.length = 0;
        break;
      }
      nightlyRates.push(loaded.rate);
      roomsLeft = Math.min(roomsLeft, loaded.totalRooms - (heldForRoom?.get(key) ?? 0));
    }

    if (nightlyRates.length !== nights.length) continue;

    offers.push({
      room,
      roomsLeft: Math.max(0, roomsLeft),
      nightlyRates,
      quote: quoteStay(nightlyRates, rooms),
    });
  }

  return offers;
}

export async function roomOffer(
  db: Db,
  query: AvailabilityQuery & { roomName: string },
): Promise<RoomOffer | undefined> {
  const offers = await roomOffers(db, query);
  return offers.find((offer) => offer.room.name === query.roomName);
}

// True when a property has any rate loaded at all. Distinguishes "we are
// full" from "direct booking is not open here yet", which are very
// different messages to show a guest — every property starts in the second
// state until staff load an allotment on /admin/rates.
export async function hasLoadedRates(hotelSlug: string, from: Date): Promise<boolean> {
  const count = await prisma.roomRate.count({
    where: { hotelSlug, date: { gte: from } },
  });
  return count > 0;
}

export async function bookableHotelSlugs(from: Date): Promise<string[]> {
  const grouped = await prisma.roomRate.groupBy({
    by: ['hotelSlug'],
    where: { date: { gte: from }, closed: false, totalRooms: { gt: 0 } },
  });
  return grouped.map((row) => row.hotelSlug);
}
