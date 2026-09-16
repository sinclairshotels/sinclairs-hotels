import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { roomOffer, roomOffers } from './availability';
import { HOLD_MINUTES, dateKey, parseDateOnly } from './booking';
import { prisma } from './db';

// Real Postgres, per this project's testing rules — availability is a query,
// and a mock would assert nothing about the one thing that can be wrong.
// Everything is written far enough into the future that it cannot collide
// with (or be cleaned up alongside) real data in a shared dev database.
const HOTEL = 'gangtok';
const ROOM = 'Deluxe Room';
const OTHER_ROOM = 'Deluxe Family Room';
const FROM = parseDateOnly('2099-06-01') as Date;
const TO = parseDateOnly('2099-06-04') as Date;
const RANGE = { gte: parseDateOnly('2099-01-01') as Date, lt: parseDateOnly('2100-01-01') as Date };
const TEST_EMAIL_DOMAIN = 'vitest-availability-test.invalid';

const day = (offset: number) => new Date(FROM.getTime() + offset * 86_400_000);

async function loadRates(
  roomName: string,
  nights: number,
  values: { rate?: number; totalRooms?: number; closed?: boolean } = {},
) {
  for (let i = 0; i < nights; i++) {
    const date = day(i);
    await prisma.roomRate.upsert({
      where: { hotelSlug_roomName_date: { hotelSlug: HOTEL, roomName, date } },
      update: {
        rate: values.rate ?? 5000,
        totalRooms: values.totalRooms ?? 3,
        closed: values.closed ?? false,
      },
      create: {
        hotelSlug: HOTEL,
        roomName,
        date,
        rate: values.rate ?? 5000,
        totalRooms: values.totalRooms ?? 3,
        closed: values.closed ?? false,
      },
    });
  }
}

async function createBooking(overrides: {
  status: 'CONFIRMED' | 'PENDING_PAYMENT' | 'CANCELLED' | 'PAYMENT_FAILED';
  rooms?: number;
  createdAt?: Date;
  checkIn?: Date;
  checkOut?: Date;
  roomName?: string;
}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return prisma.booking.create({
    data: {
      reference: `VITEST-${suffix}`,
      viewToken: `vitest-${suffix}`,
      hotelSlug: HOTEL,
      roomName: overrides.roomName ?? ROOM,
      checkIn: overrides.checkIn ?? FROM,
      checkOut: overrides.checkOut ?? TO,
      rooms: overrides.rooms ?? 1,
      adults: 2,
      guestName: 'Test Guest',
      guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: 'Somewhere',
      roomTotal: 15000,
      taxTotal: 1800,
      total: 16800,
      status: overrides.status,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

async function cleanup() {
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await prisma.roomRate.deleteMany({ where: { hotelSlug: HOTEL, date: RANGE } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const query = { hotelSlug: HOTEL, checkIn: FROM, checkOut: TO, rooms: 1 };

describe('roomOffers', () => {
  it('offers nothing for a property with no rates loaded', async () => {
    expect(await roomOffers(prisma, query)).toEqual([]);
  });

  it('prices every night of the stay from its own rate row', async () => {
    await loadRates(ROOM, 3, { rate: 4000 });
    const [offer] = await roomOffers(prisma, query);

    expect(offer?.room.name).toBe(ROOM);
    expect(offer?.nightlyRates).toEqual([4000, 4000, 4000]);
    expect(offer?.quote.nights).toBe(3);
    expect(offer?.quote.roomTotal).toBe(12000);
    expect(offer?.quote.taxTotal).toBe(2160);
    expect(offer?.roomsLeft).toBe(3);
  });

  it('does not offer a room whose calendar has a gap — an unpriced night is not bookable', async () => {
    await loadRates(ROOM, 3);
    await prisma.roomRate.delete({
      where: { hotelSlug_roomName_date: { hotelSlug: HOTEL, roomName: ROOM, date: day(1) } },
    });

    expect(await roomOffers(prisma, query)).toEqual([]);
  });

  it('does not offer a room that is stop-sold on any night of the stay', async () => {
    await loadRates(ROOM, 3);
    await prisma.roomRate.update({
      where: { hotelSlug_roomName_date: { hotelSlug: HOTEL, roomName: ROOM, date: day(2) } },
      data: { closed: true },
    });

    expect(await roomOffers(prisma, query)).toEqual([]);
  });

  it('multiplies the quote by the number of rooms asked for', async () => {
    await loadRates(ROOM, 3, { rate: 4000 });
    const [offer] = await roomOffers(prisma, { ...query, rooms: 2 });

    expect(offer?.quote.roomTotal).toBe(24000);
    expect(offer?.quote.total).toBe(28320);
  });

  it('lists room types in the content file’s order, not the database’s', async () => {
    await loadRates(OTHER_ROOM, 3);
    await loadRates(ROOM, 3);

    expect((await roomOffers(prisma, query)).map((offer) => offer.room.name)).toEqual([
      ROOM,
      OTHER_ROOM,
    ]);
  });
});

describe('inventory held by existing bookings', () => {
  beforeEach(() => loadRates(ROOM, 3, { totalRooms: 3 }));

  it('a confirmed booking takes its rooms out of availability', async () => {
    await createBooking({ status: 'CONFIRMED', rooms: 2 });
    const [offer] = await roomOffers(prisma, query);
    expect(offer?.roomsLeft).toBe(1);
  });

  it('a booking still inside the payment hold window keeps holding its rooms', async () => {
    await createBooking({ status: 'PENDING_PAYMENT', rooms: 3 });
    const [offer] = await roomOffers(prisma, query);
    expect(offer?.roomsLeft).toBe(0);
  });

  it('an abandoned payment releases its rooms once the hold expires', async () => {
    await createBooking({
      status: 'PENDING_PAYMENT',
      rooms: 3,
      createdAt: new Date(Date.now() - (HOLD_MINUTES + 1) * 60_000),
    });
    const [offer] = await roomOffers(prisma, query);
    expect(offer?.roomsLeft).toBe(3);
  });

  it.each(['CANCELLED', 'PAYMENT_FAILED'] as const)(
    'a %s booking holds nothing',
    async (status) => {
      await createBooking({ status, rooms: 3 });
      const [offer] = await roomOffers(prisma, query);
      expect(offer?.roomsLeft).toBe(3);
    },
  );

  it('a booking that checks out on our check-in day does not overlap it', async () => {
    await createBooking({
      status: 'CONFIRMED',
      rooms: 3,
      checkIn: day(-2),
      checkOut: FROM,
    });
    const [offer] = await roomOffers(prisma, query);
    expect(offer?.roomsLeft).toBe(3);
  });

  it('holds only the nights it actually occupies, so the stay takes the tightest night', async () => {
    await createBooking({ status: 'CONFIRMED', rooms: 2, checkIn: day(1), checkOut: day(2) });
    const [offer] = await roomOffers(prisma, query);
    // Nights 0 and 2 still have 3 free; night 1 has 1, and a stay needs every night.
    expect(offer?.roomsLeft).toBe(1);
  });

  it('a booking of another room type does not touch this one', async () => {
    await createBooking({ status: 'CONFIRMED', rooms: 3, roomName: OTHER_ROOM });
    const [offer] = await roomOffers(prisma, query);
    expect(offer?.roomsLeft).toBe(3);
  });
});

describe('excludeBookingId', () => {
  beforeEach(() => loadRates(ROOM, 3, { totalRooms: 1 }));

  it('leaves the named booking out of the held count, so it cannot block itself', async () => {
    const booking = await createBooking({ status: 'CONFIRMED', rooms: 1 });

    expect((await roomOffers(prisma, query))[0]?.roomsLeft).toBe(0);
    expect(
      (await roomOffers(prisma, { ...query, excludeBookingId: booking.id }))[0]?.roomsLeft,
    ).toBe(1);
  });

  it('still counts every other booking', async () => {
    const mine = await createBooking({ status: 'CONFIRMED', rooms: 1 });
    await createBooking({ status: 'CONFIRMED', rooms: 1 });

    expect((await roomOffers(prisma, { ...query, excludeBookingId: mine.id }))[0]?.roomsLeft).toBe(
      0,
    );
  });
});

describe('roomOffer', () => {
  it('returns the named room only', async () => {
    await loadRates(ROOM, 3);
    expect((await roomOffer(prisma, { ...query, roomName: ROOM }))?.room.name).toBe(ROOM);
    expect(await roomOffer(prisma, { ...query, roomName: 'No Such Room' })).toBeUndefined();
  });
});

describe('date handling', () => {
  it('reads back @db.Date rows on the same calendar day they were written', async () => {
    await loadRates(ROOM, 1);
    const row = await prisma.roomRate.findFirst({ where: { hotelSlug: HOTEL, date: RANGE } });
    expect(dateKey(row?.date as Date)).toBe('2099-06-01');
  });
});
