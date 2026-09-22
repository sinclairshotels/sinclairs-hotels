import { addDays, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { FUNNEL_STEPS, funnelCounts, toRows } from '@/lib/funnel';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const TEST_EMAIL_DOMAIN = 'vitest-funnel.invalid';
const ALL = { role: 'USER' as const, allProperties: true, hotels: [] };
const HOTEL = 'gangtok';
const OTHER = 'darjeeling';

const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function event(step: string, hotelSlug: string | null, days = 1) {
  await prisma.funnelEvent.create({ data: { step, hotelSlug, at: ago(days) } });
}

async function booking(hotelSlug: string, status: 'PENDING_PAYMENT' | 'CONFIRMED', days = 1) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const today = todayUtc();
  await prisma.booking.create({
    data: {
      reference: `FN-${suffix}`,
      viewToken: `fn-${suffix}`,
      hotelSlug,
      roomName: 'Deluxe Room',
      checkIn: addDays(today, 5),
      checkOut: addDays(today, 6),
      rooms: 1,
      adults: 2,
      guestName: 'Funnel Guest',
      guestEmail: `g-${suffix}@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: 'Somewhere',
      roomTotal: 1000,
      taxTotal: 50,
      total: 1050,
      status,
      createdAt: ago(days),
    },
  });
}

async function clear() {
  await prisma.funnelEvent.deleteMany({});
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
}

describe('funnelCounts', () => {
  beforeEach(clear);
  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('counts browser steps per property and in the total', async () => {
    await event('room_view', HOTEL);
    await event('room_view', HOTEL);
    await event('room_view', OTHER);

    const counts = await funnelCounts(ALL, 7);
    expect(counts.get(HOTEL)?.room_view).toBe(2);
    expect(counts.get(OTHER)?.room_view).toBe(1);
    expect(counts.get(null)?.room_view).toBe(3);
  });

  it('counts the paid-for steps from bookings, not from anything the browser said', async () => {
    await booking(HOTEL, 'PENDING_PAYMENT');
    await booking(HOTEL, 'CONFIRMED');

    const counts = await funnelCounts(ALL, 7);
    expect(counts.get(HOTEL)?.guest_details).toBe(2);
    expect(counts.get(HOTEL)?.confirmed).toBe(1);
  });

  it('leaves out anything older than the window', async () => {
    await event('search', HOTEL, 40);
    await booking(HOTEL, 'CONFIRMED', 40);

    const week = await funnelCounts(ALL, 7);
    expect(week.get(HOTEL)?.search ?? 0).toBe(0);
    expect(week.get(HOTEL)?.confirmed ?? 0).toBe(0);
  });

  it('shows a scoped user only their own property, total included', async () => {
    await event('room_view', HOTEL);
    await event('room_view', OTHER);

    const scoped = await funnelCounts(
      { role: 'USER' as const, allProperties: false, hotels: [HOTEL] },
      7,
    );
    expect(scoped.get(OTHER)).toBeUndefined();
    expect(scoped.get(null)?.room_view).toBe(1);
  });

  it('ignores a step name that is not part of the funnel', async () => {
    await event('not_a_step', HOTEL);

    const counts = await funnelCounts(ALL, 7);
    expect(Object.values(counts.get(HOTEL) ?? {}).every((n) => n === 0)).toBe(true);
  });
});

describe('toRows', () => {
  const counts = {
    home_view: 1000,
    search: 400,
    room_view: 200,
    guest_details: 40,
    payment_started: 30,
    confirmed: 20,
  };

  it('reports drop-off against the step above', () => {
    const rows = toRows(counts);
    expect(rows.map((r) => r.dropOff)).toEqual([null, 60, 50, 80, 25, 33]);
  });

  it('keeps the steps in the order a guest walks them', () => {
    expect(toRows(counts).map((r) => r.step)).toEqual([...FUNNEL_STEPS]);
  });

  it('reports no drop-off from a step that had nothing in it', () => {
    const rows = toRows({ ...counts, home_view: 0, search: 0 });
    expect(rows[1]?.dropOff).toBeNull();
    expect(rows[2]?.dropOff).toBeNull();
  });

  it('marks which steps came from the browser and can be blocked', () => {
    expect(toRows(counts).map((r) => r.fromBrowser)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
