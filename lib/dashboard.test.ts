import { addDays, todayUtc } from '@/lib/booking';
import { dashboardToday } from '@/lib/dashboard';
import { prisma } from '@/lib/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { type LoadedRoom, findRoom } from '../test-utils/inventory';

const HOTEL = 'burdwan';
const OTHER_HOTEL = 'darjeeling';
const ROOM = 'Premier Room';
const TEST_EMAIL_DOMAIN = 'vitest-dashboard.invalid';

const ALL_HOTELS = { role: 'USER' as const, allProperties: true, hotels: [] };

let room: LoadedRoom;

async function book({
  checkIn,
  checkOut,
  status = 'CONFIRMED',
  hotelSlug = HOTEL,
  total = 5000,
}: {
  checkIn: Date;
  checkOut: Date;
  status?: 'CONFIRMED' | 'CANCELLED' | 'REFUND_DUE' | 'PENDING_PAYMENT' | 'PAYMENT_FAILED';
  hotelSlug?: string;
  total?: number;
}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return prisma.booking.create({
    data: {
      reference: `DASH-${suffix}`,
      viewToken: `dash-${suffix}`,
      hotelSlug,
      roomTypeId: hotelSlug === HOTEL ? room.roomTypeId : null,
      roomName: ROOM,
      checkIn,
      checkOut,
      rooms: 1,
      adults: 2,
      guestName: 'Dash Guest',
      guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: 'Somewhere',
      roomTotal: total,
      taxTotal: 0,
      total,
      status,
    },
  });
}

async function clear() {
  await prisma.booking.deleteMany({
    where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } },
  });
}

describe('dashboardToday', () => {
  const today = todayUtc();

  beforeEach(async () => {
    room = await findRoom(HOTEL, ROOM);
    await clear();
  });

  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('counts a stay starting today as an arrival', async () => {
    await book({ checkIn: today, checkOut: addDays(today, 2) });

    const result = await dashboardToday(ALL_HOTELS);
    expect(result.arrivals.filter((b) => b.reference.startsWith('DASH-'))).toHaveLength(1);
  });

  it('counts a stay ending today as a departure, not an arrival', async () => {
    await book({ checkIn: addDays(today, -2), checkOut: today });

    const result = await dashboardToday(ALL_HOTELS);
    const mine = (list: { reference: string }[]) =>
      list.filter((b) => b.reference.startsWith('DASH-'));
    expect(mine(result.departures)).toHaveLength(1);
    expect(mine(result.arrivals)).toHaveLength(0);
  });

  it('counts a guest as in house on the nights they paid for, never on checkout day', async () => {
    const before = (await dashboardToday(ALL_HOTELS)).inHouse;
    await book({ checkIn: addDays(today, -1), checkOut: addDays(today, 1) });
    expect((await dashboardToday(ALL_HOTELS)).inHouse).toBe(before + 1);

    await clear();
    await book({ checkIn: addDays(today, -2), checkOut: today });
    expect((await dashboardToday(ALL_HOTELS)).inHouse).toBe(before);
  });

  it('leaves a cancelled booking out of arrivals altogether', async () => {
    await book({ checkIn: today, checkOut: addDays(today, 1), status: 'CANCELLED' });

    const result = await dashboardToday(ALL_HOTELS);
    expect(result.arrivals.filter((b) => b.reference.startsWith('DASH-'))).toHaveLength(0);
  });

  it('surfaces a refund due, because it is money owed to someone', async () => {
    await book({ checkIn: addDays(today, 5), checkOut: addDays(today, 6), status: 'REFUND_DUE' });

    const result = await dashboardToday(ALL_HOTELS);
    expect(result.refundsDue.filter((b) => b.reference.startsWith('DASH-'))).toHaveLength(1);
  });

  it('shows a scoped user only their own property', async () => {
    await book({ checkIn: today, checkOut: addDays(today, 1) });
    await book({ checkIn: today, checkOut: addDays(today, 1), hotelSlug: OTHER_HOTEL });

    const scoped = await dashboardToday({
      role: 'USER' as const,
      allProperties: false,
      hotels: [HOTEL],
    });
    const mine = scoped.arrivals.filter((b) => b.reference.startsWith('DASH-'));
    expect(mine).toHaveLength(1);
    expect(mine[0]?.hotelSlug).toBe(HOTEL);
  });

  it('counts the week ahead without counting today twice', async () => {
    const before = (await dashboardToday(ALL_HOTELS)).nextSeven;
    await book({ checkIn: today, checkOut: addDays(today, 1) });
    await book({ checkIn: addDays(today, 3), checkOut: addDays(today, 4) });

    expect((await dashboardToday(ALL_HOTELS)).nextSeven).toBe(before + 1);
  });
});
