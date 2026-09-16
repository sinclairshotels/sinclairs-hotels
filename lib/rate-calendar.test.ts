import { hotels } from '@/content/hotels';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, parseDateOnly, todayUtc } from './booking';
import { prisma } from './db';
import { COVERAGE_WARNING_DAYS, coverageWarnings, rateCalendar } from './rate-calendar';

const HOTEL = 'gangtok';
const ROOM = 'Deluxe Room';
const FROM = parseDateOnly('2098-06-01') as Date;
const WINDOW = {
  gte: parseDateOnly('2098-01-01') as Date,
  lt: parseDateOnly('2099-01-01') as Date,
};
const TEST_EMAIL_DOMAIN = 'vitest-calendar-test.invalid';

const day = (offset: number) => addDays(FROM, offset);

async function loadRates(nights: number, values: { totalRooms?: number; closed?: boolean } = {}) {
  for (let i = 0; i < nights; i++) {
    const date = day(i);
    await prisma.roomRate.upsert({
      where: { hotelSlug_roomName_date: { hotelSlug: HOTEL, roomName: ROOM, date } },
      update: { rate: 5000, totalRooms: values.totalRooms ?? 4, closed: values.closed ?? false },
      create: {
        hotelSlug: HOTEL,
        roomName: ROOM,
        date,
        rate: 5000,
        totalRooms: values.totalRooms ?? 4,
        closed: values.closed ?? false,
      },
    });
  }
}

async function book(rooms: number, startOffset: number, nights: number, status = 'CONFIRMED') {
  const suffix = Math.random().toString(36).slice(2, 10);
  return prisma.booking.create({
    data: {
      reference: `CAL-${suffix}`,
      viewToken: `cal-${suffix}`,
      hotelSlug: HOTEL,
      roomName: ROOM,
      checkIn: day(startOffset),
      checkOut: day(startOffset + nights),
      rooms,
      adults: 2,
      guestName: 'Cal Guest',
      guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: 'Somewhere',
      roomTotal: 1,
      taxTotal: 0,
      total: 1,
      status: status as 'CONFIRMED',
    },
  });
}

async function cleanup() {
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await prisma.roomRate.deleteMany({ where: { hotelSlug: HOTEL, date: WINDOW } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const calendar = () => rateCalendar({ hotelSlug: HOTEL, from: FROM, days: 5 });

describe('rateCalendar', () => {
  it('returns a cell per night for every room type the property has', async () => {
    const grid = await calendar();
    expect(grid?.dates).toHaveLength(5);
    expect(grid?.rows.length).toBeGreaterThan(1);
    expect(grid?.rows.every((row) => row.cells.length === 5)).toBe(true);
  });

  it('shows an unloaded night as having no rate rather than a rate of zero', async () => {
    const grid = await calendar();
    const cell = grid?.rows.find((r) => r.roomName === ROOM)?.cells[0];
    expect(cell?.rate).toBeNull();
    expect(cell?.onSale).toBe(0);
  });

  it('reports rate, rooms on sale, sold and remaining for a loaded night', async () => {
    await loadRates(5, { totalRooms: 4 });
    await book(3, 0, 1);

    const cells = (await calendar())?.rows.find((r) => r.roomName === ROOM)?.cells;

    expect(cells?.[0]).toMatchObject({ rate: 5000, onSale: 4, sold: 3, remaining: 1 });
    // The booking covers one night only, so the next is untouched.
    expect(cells?.[1]).toMatchObject({ sold: 0, remaining: 4 });
  });

  it('counts a multi-night booking against every night it occupies, but not the checkout day', async () => {
    await loadRates(5);
    await book(1, 1, 2);

    const cells = (await calendar())?.rows.find((r) => r.roomName === ROOM)?.cells;

    expect(cells?.map((c) => c.sold)).toEqual([0, 1, 1, 0, 0]);
  });

  it('ignores bookings that hold nothing', async () => {
    await loadRates(5);
    await book(4, 0, 2, 'CANCELLED');
    await book(4, 0, 2, 'REFUND_DUE');

    const cells = (await calendar())?.rows.find((r) => r.roomName === ROOM)?.cells;
    expect(cells?.[0]?.sold).toBe(0);
  });

  it('never reports negative remaining when a room is oversold against a cut allotment', async () => {
    await loadRates(5, { totalRooms: 1 });
    await book(3, 0, 1);

    const cell = (await calendar())?.rows.find((r) => r.roomName === ROOM)?.cells[0];
    expect(cell?.sold).toBe(3);
    expect(cell?.remaining).toBe(0);
  });

  it('marks a stop sell without hiding its rate', async () => {
    await loadRates(5, { closed: true });
    const cell = (await calendar())?.rows.find((r) => r.roomName === ROOM)?.cells[0];
    expect(cell).toMatchObject({ closed: true, rate: 5000 });
  });

  it('returns nothing for a property that does not exist', async () => {
    expect(await rateCalendar({ hotelSlug: 'atlantis', from: FROM, days: 5 })).toBeNull();
  });
});

// Every assertion here runs with `now` pinned deep in the test window, so
// "from today" means "from 2098-06-01" and nothing loaded around the real
// today is visible. That keeps these deterministic without deleting rows in
// the live date range, which a developer's own dev database holds.
const NOW = new Date('2098-06-01T09:00:00.000Z');

describe('coverageWarnings', () => {
  it('flags every room type when nothing is loaded', async () => {
    const warnings = await coverageWarnings(NOW);
    const roomCount = hotels.reduce((sum, hotel) => sum + hotel.rooms.length, 0);

    expect(warnings).toHaveLength(roomCount);
    expect(warnings.every((w) => w.lastNight === null && w.daysLeft === 0)).toBe(true);
  });

  it('stops flagging a room loaded beyond the warning window', async () => {
    await loadRates(COVERAGE_WARNING_DAYS + 10);

    const warnings = await coverageWarnings(NOW);
    expect(warnings.find((w) => w.hotelSlug === HOTEL && w.roomName === ROOM)).toBeUndefined();
  });

  it('still flags a room that runs out inside the window, with the days left', async () => {
    await loadRates(20);

    const warning = (await coverageWarnings(NOW)).find(
      (w) => w.hotelSlug === HOTEL && w.roomName === ROOM,
    );

    // Loaded for nights 0..19, so the last night is 19 days out.
    expect(warning).toMatchObject({ daysLeft: 19, lastNight: '2098-06-20' });
  });

  it('does not let a stop-sold run count as coverage — it cannot be sold either', async () => {
    await loadRates(COVERAGE_WARNING_DAYS + 10, { closed: true });

    const warning = (await coverageWarnings(NOW)).find(
      (w) => w.hotelSlug === HOTEL && w.roomName === ROOM,
    );
    expect(warning).toMatchObject({ lastNight: null });
  });

  it('does not let a zero allotment count as coverage either', async () => {
    await loadRates(COVERAGE_WARNING_DAYS + 10, { totalRooms: 0 });

    const warning = (await coverageWarnings(NOW)).find(
      (w) => w.hotelSlug === HOTEL && w.roomName === ROOM,
    );
    expect(warning).toMatchObject({ lastNight: null });
  });

  it('names only real properties and real room types', async () => {
    for (const warning of await coverageWarnings(NOW)) {
      const hotel = hotels.find((h) => h.slug === warning.hotelSlug);
      expect(hotel).toBeDefined();
      expect(hotel?.rooms.some((room) => room.name === warning.roomName)).toBe(true);
    }
  });

  it('sorts the emptiest room types first', async () => {
    await loadRates(20);

    const daysLeft = (await coverageWarnings(NOW)).map((w) => w.daysLeft);
    expect([...daysLeft].sort((a, b) => a - b)).toEqual(daysLeft);
    expect(daysLeft.at(-1)).toBe(19);
  });
});
