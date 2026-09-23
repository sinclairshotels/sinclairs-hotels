import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  type LoadedRoom,
  clearNights,
  findRoom,
  loadNights,
  planFor,
} from '../test-utils/inventory';
import { availability, roomOffer, roomOffers } from './availability';
import { HOLD_MINUTES, addDays, dateKey, parseDateOnly } from './booking';
import { prisma } from './db';

// Real Postgres, per this project's testing rules — availability is a query,
// and a mock would assert nothing about the one thing that can be wrong.
// Everything is written far enough into the future that it cannot collide
// with real data in a shared dev database.
const HOTEL = 'gangtok';
const ROOM = 'Deluxe Room';
const OTHER_ROOM = 'Deluxe Family Room';
const FROM = parseDateOnly('2099-06-01') as Date;
const TO = parseDateOnly('2099-06-04') as Date;
const RANGE = { gte: parseDateOnly('2099-01-01') as Date, lt: parseDateOnly('2100-01-01') as Date };
const TEST_EMAIL_DOMAIN = 'vitest-availability-test.invalid';

const day = (offset: number) => addDays(FROM, offset);
const nights = (count: number, start = 0) =>
  Array.from({ length: count }, (_, i) => day(start + i));

let room: LoadedRoom;
let otherRoom: LoadedRoom;

async function createBooking(overrides: {
  status: 'CONFIRMED' | 'PENDING_PAYMENT' | 'CANCELLED' | 'PAYMENT_FAILED' | 'REFUND_DUE';
  rooms?: number;
  createdAt?: Date;
  checkIn?: Date;
  checkOut?: Date;
  target?: LoadedRoom;
}) {
  const target = overrides.target ?? room;
  const suffix = Math.random().toString(36).slice(2, 10);
  return prisma.booking.create({
    data: {
      reference: `VITEST-${suffix}`,
      viewToken: `vitest-${suffix}`,
      hotelSlug: HOTEL,
      roomTypeId: target.roomTypeId,
      ratePlanId: target.ratePlanId,
      roomName: target.roomName,
      checkIn: overrides.checkIn ?? FROM,
      checkOut: overrides.checkOut ?? TO,
      rooms: overrides.rooms ?? 1,
      adults: 2,
      guestName: 'Test Guest',
      guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: 'Somewhere',
      roomTotal: 15000,
      taxTotal: 2700,
      total: 17700,
      status: overrides.status,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

async function cleanup() {
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await clearNights(HOTEL, RANGE);
  // The breakfast supplement is what puts With Breakfast on offer now, so it
  // is the switch a test has to put back rather than the plan's active flag.
  // Every settings column is reset, not just the one the last test touched:
  // these tests share one row, and a half-reset leaks a refundable rate into
  // the next test's offer count.
  const blankSettings = {
    breakfastSupplement: 0,
    refundableUpliftPct: null,
    freeCancellationDays: null,
  };
  await prisma.hotelSettings.upsert({
    where: { hotelSlug: HOTEL },
    update: blankSettings,
    create: { hotelSlug: HOTEL, ...blankSettings },
  });
  await prisma.ratePlan.updateMany({
    where: { hotelSlug: HOTEL, code: 'CP' },
    data: { active: true },
  });
  await prisma.nonRefundableWindow.deleteMany({ where: { hotelSlug: HOTEL } });
}

beforeEach(async () => {
  room = await findRoom(HOTEL, ROOM);
  otherRoom = await findRoom(HOTEL, OTHER_ROOM);
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const query = { hotelSlug: HOTEL, checkIn: FROM, checkOut: TO, rooms: 1 };

describe('roomOffers', () => {
  it('offers nothing for a property with nothing loaded', async () => {
    expect(await roomOffers(prisma, query)).toEqual([]);
  });

  it('prices every night of the stay from its own rate row', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 4000, roomsOnSale: 3 });
    const [offer] = await roomOffers(prisma, query);

    expect(offer?.roomTypeName).toBe(ROOM);
    expect(offer?.nightlyRates).toEqual([4000, 4000, 4000]);
    expect(offer?.quote.roomTotal).toBe(12000);
    // 4,000 is under the ₹7,500 threshold, so every night takes the 5% rate
    expect(offer?.quote.taxTotal).toBe(600);
    expect(offer?.roomsLeft).toBe(3);
  });

  it('does not offer a room whose calendar has a gap — an unpriced night is not bookable', async () => {
    await loadNights(room, HOTEL, nights(3));
    await prisma.roomInventory.deleteMany({
      where: { roomTypeId: room.roomTypeId, date: day(1) },
    });

    const { offers, blocked } = await availability(prisma, query);
    expect(offers).toEqual([]);
    expect(blocked[0]?.reason).toBe('unpriced');
  });

  it('does not offer a room priced but with no inventory row, or vice versa', async () => {
    await loadNights(room, HOTEL, nights(3), { priced: false });
    expect(await roomOffers(prisma, query)).toEqual([]);
  });

  it('does not offer a room that is stop-sold on any night of the stay', async () => {
    await loadNights(room, HOTEL, nights(3));
    await loadNights(room, HOTEL, [day(2)], { stopSell: true });

    const { offers, blocked } = await availability(prisma, query);
    expect(offers).toEqual([]);
    expect(blocked[0]?.reason).toBe('stop-sell');
  });

  it('multiplies the quote by the number of rooms asked for', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 4000 });
    const [offer] = await roomOffers(prisma, { ...query, rooms: 2 });

    expect(offer?.quote.roomTotal).toBe(24000);
    expect(offer?.quote.total).toBe(25200);
  });

  it('lists room types in their configured order', async () => {
    await loadNights(otherRoom, HOTEL, nights(3));
    await loadNights(room, HOTEL, nights(3));

    expect((await roomOffers(prisma, query)).map((offer) => offer.roomTypeName)).toEqual([
      ROOM,
      OTHER_ROOM,
    ]);
  });

  it('derives With Breakfast from Room Only and the hotel’s supplement', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 4000, roomsOnSale: 2 });
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: HOTEL },
      update: { breakfastSupplement: 400 },
      create: { hotelSlug: HOTEL, breakfastSupplement: 400 },
    });

    const offers = (await roomOffers(prisma, query)).filter((o) => o.roomTypeName === ROOM);

    expect(offers).toHaveLength(2);
    // The same two rooms back both plans — a room is sold once, whatever it
    // was sold on.
    expect(offers.every((offer) => offer.roomsLeft === 2)).toBe(true);
    // 400 a head times the room's two base guests
    expect(offers.map((o) => o.nightlyRates[0]).sort()).toEqual([4000, 4800]);
  });

  it('offers Room Only alone when no breakfast supplement is set', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 4000, roomsOnSale: 2 });
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: HOTEL },
      update: { breakfastSupplement: 0 },
      create: { hotelSlug: HOTEL, breakfastSupplement: 0 },
    });

    const offers = (await roomOffers(prisma, query)).filter((o) => o.roomTypeName === ROOM);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.ratePlanCode).toBe('EP');
  });

  it('offers both sets of cancellation terms, priced apart by the uplift', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 4000, roomsOnSale: 2 });
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: HOTEL },
      update: { breakfastSupplement: 0, refundableUpliftPct: 15, freeCancellationDays: 2 },
      create: {
        hotelSlug: HOTEL,
        breakfastSupplement: 0,
        refundableUpliftPct: 15,
        freeCancellationDays: 2,
      },
    });

    const offers = (await roomOffers(prisma, query)).filter((o) => o.roomTypeName === ROOM);
    expect(offers).toHaveLength(2);

    const nonRefundable = offers.find((o) => o.rateType === 'NON_REFUNDABLE');
    const refundable = offers.find((o) => o.rateType === 'REFUNDABLE');

    expect(nonRefundable?.nightlyRates[0]).toBe(4000);
    expect(refundable?.nightlyRates[0]).toBe(4600);
    expect(nonRefundable?.cancellationDeadline).toBeNull();
    // Two days before check-in, and the same rooms back both — flexibility is
    // a price, not a second allotment.
    expect(refundable?.cancellationDeadline).toEqual(
      new Date(query.checkIn.getTime() - 2 * 86_400_000),
    );
    expect(offers.every((offer) => offer.roomsLeft === 2)).toBe(true);
  });

  it('does not offer a refundable rate whose window has already closed', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 4000, roomsOnSale: 2 });
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: HOTEL },
      update: { breakfastSupplement: 0, refundableUpliftPct: 15, freeCancellationDays: 365 },
      create: {
        hotelSlug: HOTEL,
        breakfastSupplement: 0,
        refundableUpliftPct: 15,
        freeCancellationDays: 365,
      },
    });

    // The deadline is a year before check-in, so searching after it has passed
    // must not offer an uplift that would buy nothing.
    const afterDeadline = parseDateOnly('2098-07-01') as Date;
    const offers = (await roomOffers(prisma, { ...query, now: afterDeadline })).filter(
      (o) => o.roomTypeName === ROOM,
    );
    expect(offers).toHaveLength(1);
    expect(offers[0]?.rateType).toBe('NON_REFUNDABLE');
  });

  it('offers no refundable rate on dates sold as non-refundable only', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 4000, roomsOnSale: 2 });
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: HOTEL },
      update: { breakfastSupplement: 0, refundableUpliftPct: 15, freeCancellationDays: 2 },
      create: {
        hotelSlug: HOTEL,
        breakfastSupplement: 0,
        refundableUpliftPct: 15,
        freeCancellationDays: 2,
      },
    });
    // Covers the stay's middle night only — one night is enough, because a
    // booking cannot be half refundable.
    await prisma.nonRefundableWindow.create({
      data: {
        hotelSlug: HOTEL,
        startDate: new Date(query.checkIn.getTime() + 86_400_000),
        endDate: new Date(query.checkIn.getTime() + 86_400_000),
        label: 'Peak season',
      },
    });

    const result = await availability(prisma, query);
    const offers = result.offers.filter((o) => o.roomTypeName === ROOM);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.rateType).toBe('NON_REFUNDABLE');
    // The room list needs to say *why* there is one price, or the property
    // looks like one that never sells a refundable rate.
    expect(result.nonRefundableOnly?.label).toBe('Peak season');
  });

  it('still offers the refundable rate when the window only touches the checkout day', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 4000, roomsOnSale: 2 });
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: HOTEL },
      update: { breakfastSupplement: 0, refundableUpliftPct: 15, freeCancellationDays: 2 },
      create: {
        hotelSlug: HOTEL,
        breakfastSupplement: 0,
        refundableUpliftPct: 15,
        freeCancellationDays: 2,
      },
    });
    // Starts on the checkout date, which is never a night the guest pays for.
    await prisma.nonRefundableWindow.create({
      data: { hotelSlug: HOTEL, startDate: query.checkOut, endDate: query.checkOut },
    });

    const result = await availability(prisma, query);
    expect(result.nonRefundableOnly).toBeNull();
    expect(
      result.offers.filter((o) => o.roomTypeName === ROOM && o.rateType === 'REFUNDABLE'),
    ).toHaveLength(1);
  });

  it('drops the room when Room Only has an unpriced night, since every plan rests on it', async () => {
    await loadNights(room, HOTEL, nights(2), { rate: 4000 });
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: HOTEL },
      update: { breakfastSupplement: 400 },
      create: { hotelSlug: HOTEL, breakfastSupplement: 400 },
    });

    const offers = (await roomOffers(prisma, query)).filter((o) => o.roomTypeName === ROOM);
    expect(offers).toHaveLength(0);
  });
});

describe('restrictions staff set', () => {
  it('refuses a stay shorter than a night’s minimum stay', async () => {
    await loadNights(room, HOTEL, nights(3), { minStay: 5 });

    const { offers, blocked } = await availability(prisma, query);
    expect(offers).toEqual([]);
    expect(blocked[0]).toMatchObject({ reason: 'min-stay', minStay: 5 });
  });

  it('allows a stay that meets the minimum', async () => {
    await loadNights(room, HOTEL, nights(3), { minStay: 3 });
    expect(await roomOffers(prisma, query)).toHaveLength(1);
  });

  it('refuses arrival on a night closed to arrival', async () => {
    await loadNights(room, HOTEL, nights(3));
    await loadNights(room, HOTEL, [day(0)], { closedToArrival: true });

    const { blocked } = await availability(prisma, query);
    expect(blocked[0]?.reason).toBe('closed-to-arrival');
  });

  it('ignores closed-to-arrival on a night the guest is not arriving on', async () => {
    await loadNights(room, HOTEL, nights(3));
    await loadNights(room, HOTEL, [day(1)], { closedToArrival: true });

    expect(await roomOffers(prisma, query)).toHaveLength(1);
  });

  it('refuses departure on a day closed to departure', async () => {
    await loadNights(room, HOTEL, nights(3));
    // The checkout day is not a night the guest pays for, so its row has to be
    // read separately — that is the whole subtlety of this rule.
    await loadNights(room, HOTEL, [day(3)], { closedToDeparture: true, priced: false });

    const { offers, blocked } = await availability(prisma, query);
    expect(offers).toEqual([]);
    expect(blocked[0]?.reason).toBe('closed-to-departure');
  });
});

describe('inventory held by existing bookings', () => {
  beforeEach(() => loadNights(room, HOTEL, nights(3), { roomsOnSale: 3 }));

  it('a confirmed booking takes its rooms out of availability', async () => {
    await createBooking({ status: 'CONFIRMED', rooms: 2 });
    expect((await roomOffers(prisma, query))[0]?.roomsLeft).toBe(1);
  });

  it('a booking still inside the payment hold window keeps holding its rooms', async () => {
    await createBooking({ status: 'PENDING_PAYMENT', rooms: 3 });
    const { offers, blocked } = await availability(prisma, query);
    expect(offers).toEqual([]);
    expect(blocked[0]?.reason).toBe('sold-out');
  });

  it('an abandoned payment releases its rooms once the hold expires', async () => {
    await createBooking({
      status: 'PENDING_PAYMENT',
      rooms: 3,
      createdAt: new Date(Date.now() - (HOLD_MINUTES + 1) * 60_000),
    });
    expect((await roomOffers(prisma, query))[0]?.roomsLeft).toBe(3);
  });

  it.each(['CANCELLED', 'PAYMENT_FAILED', 'REFUND_DUE'] as const)(
    'a %s booking holds nothing',
    async (status) => {
      await createBooking({ status, rooms: 3 });
      expect((await roomOffers(prisma, query))[0]?.roomsLeft).toBe(3);
    },
  );

  it('a booking that checks out on our check-in day does not overlap it', async () => {
    await createBooking({ status: 'CONFIRMED', rooms: 3, checkIn: day(-2), checkOut: FROM });
    expect((await roomOffers(prisma, query))[0]?.roomsLeft).toBe(3);
  });

  it('holds only the nights it occupies, so the stay takes the tightest night', async () => {
    await createBooking({ status: 'CONFIRMED', rooms: 2, checkIn: day(1), checkOut: day(2) });
    expect((await roomOffers(prisma, query))[0]?.roomsLeft).toBe(1);
  });

  it('a booking of another room type does not touch this one', async () => {
    await loadNights(otherRoom, HOTEL, nights(3), { roomsOnSale: 3 });
    await createBooking({ status: 'CONFIRMED', rooms: 3, target: otherRoom });

    const offer = (await roomOffers(prisma, query)).find((o) => o.roomTypeName === ROOM);
    expect(offer?.roomsLeft).toBe(3);
  });
});

describe('excludeBookingId', () => {
  beforeEach(() => loadNights(room, HOTEL, nights(3), { roomsOnSale: 1 }));

  it('leaves the named booking out of the held count, so it cannot block itself', async () => {
    const booking = await createBooking({ status: 'CONFIRMED', rooms: 1 });

    expect(await roomOffers(prisma, query)).toEqual([]);
    expect(
      (await roomOffers(prisma, { ...query, excludeBookingId: booking.id }))[0]?.roomsLeft,
    ).toBe(1);
  });

  it('still counts every other booking', async () => {
    const mine = await createBooking({ status: 'CONFIRMED', rooms: 1 });
    await createBooking({ status: 'CONFIRMED', rooms: 1 });

    expect(await roomOffers(prisma, { ...query, excludeBookingId: mine.id })).toEqual([]);
  });
});

describe('roomOffer', () => {
  it('returns the named room and plan only', async () => {
    await loadNights(room, HOTEL, nights(3));

    expect((await roomOffer(prisma, { ...query, roomTypeId: room.roomTypeId }))?.roomTypeName).toBe(
      ROOM,
    );
    expect(await roomOffer(prisma, { ...query, roomTypeId: 'no-such-room' })).toBeUndefined();
    expect(
      await roomOffer(prisma, {
        ...query,
        roomTypeId: room.roomTypeId,
        ratePlanId: 'no-such-plan',
      }),
    ).toBeUndefined();
  });
});

describe('date handling', () => {
  it('reads back @db.Date rows on the same calendar day they were written', async () => {
    await loadNights(room, HOTEL, nights(1));
    const row = await prisma.roomInventory.findFirst({ where: { hotelSlug: HOTEL, date: RANGE } });
    expect(dateKey(row?.date as Date)).toBe('2099-06-01');
  });
});
