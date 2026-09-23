import { addDays, todayInIndia } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { FROM_PRICE_DAYS, fromPricePerHotel } from '@/lib/from-price';
import { clearNights, findRoom, loadNights, planFor } from '@/test-utils/inventory';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

// Kalimpong on purpose: no other database-backed suite loads it, and the
// e2e suite needs Ooty to have nothing loaded at all — a test that half-clears
// a property leaves it in a state neither suite expects.
const HOTEL = 'kalimpong';
const ROOM = 'Premier Room';

// Wider than the window the page reads, so a night parked just outside it
// cannot survive into the next case.
const WINDOW = {
  gte: addDays(todayInIndia(), -5),
  lt: addDays(todayInIndia(), FROM_PRICE_DAYS + 30),
};

describe('fromPricePerHotel', () => {
  beforeEach(async () => {
    await clearNights(HOTEL, WINDOW);
  });

  afterAll(async () => {
    await clearNights(HOTEL, WINDOW);
  });

  it('reports the cheapest room-only night a property has loaded', async () => {
    const room = await findRoom(HOTEL, ROOM);
    await loadNights(room, HOTEL, [addDays(todayInIndia(), 1)], { rate: 6000 });
    await loadNights(room, HOTEL, [addDays(todayInIndia(), 2)], { rate: 4200 });
    await loadNights(room, HOTEL, [addDays(todayInIndia(), 3)], { rate: 9000 });

    expect((await fromPricePerHotel()).get(HOTEL)).toBe(4200);
  });

  it('omits a property with nothing loaded, so the page can say Enquire instead of a price', async () => {
    expect((await fromPricePerHotel()).has(HOTEL)).toBe(false);
  });

  it('ignores a cheaper night beyond the window', async () => {
    const room = await findRoom(HOTEL, ROOM);
    await loadNights(room, HOTEL, [addDays(todayInIndia(), 1)], { rate: 6000 });
    await loadNights(room, HOTEL, [addDays(todayInIndia(), FROM_PRICE_DAYS + 2)], { rate: 1000 });

    expect((await fromPricePerHotel()).get(HOTEL)).toBe(6000);
  });

  it('ignores yesterday, which nobody can book', async () => {
    const room = await findRoom(HOTEL, ROOM);
    await loadNights(room, HOTEL, [addDays(todayInIndia(), 1)], { rate: 6000 });
    await prisma.ratePrice.create({
      data: {
        ratePlanId: room.ratePlanId,
        hotelSlug: HOTEL,
        date: addDays(todayInIndia(), -1),
        amount: 500,
      },
    });

    expect((await fromPricePerHotel()).get(HOTEL)).toBe(6000);

    await prisma.ratePrice.deleteMany({
      where: { hotelSlug: HOTEL, date: addDays(todayInIndia(), -1) },
    });
  });

  it('quotes room-only even when a meal plan is priced lower', async () => {
    const room = await findRoom(HOTEL, ROOM);
    const withBreakfast = await planFor(room.roomTypeId, 'CP');
    const night = addDays(todayInIndia(), 1);

    await loadNights(room, HOTEL, [night], { rate: 6000 });
    await prisma.ratePrice.upsert({
      where: { ratePlanId_date: { ratePlanId: withBreakfast, date: night } },
      update: { amount: 3000 },
      create: { ratePlanId: withBreakfast, hotelSlug: HOTEL, date: night, amount: 3000 },
    });

    expect((await fromPricePerHotel()).get(HOTEL)).toBe(6000);
  });
});
