import { createSessionCookieValue } from '@/lib/admin-auth';
import { addDays, dateKey, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveRates } from './actions';

// createSessionCookieValue() needs this set — locally it comes from .env.local
// (loaded by vitest.config.ts), but CI has no such file, so this test must not
// depend on the ambient environment for it.
const originalAdminSecret = process.env.ADMIN_SESSION_SECRET;

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'rates-test-default',
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'admin_session' && mockState.cookieValue
        ? { value: mockState.cookieValue }
        : undefined,
  }),
  headers: async () => ({
    get: (name: string) => (name === 'x-real-ip' ? mockState.ip : null),
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const HOTEL = 'gangtok';
const ROOM = 'Deluxe Room';
const FROM = addDays(todayUtc(), 400);
const TO = addDays(FROM, 4);
const WINDOW = { gte: addDays(todayUtc(), 390), lt: addDays(todayUtc(), 430) };

// Weekdays are multi-valued, so they are appended separately rather than
// squeezed into the single-value overrides map.
function rateFormData(overrides: Record<string, string> = {}, weekdays: number[] = []): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    hotelSlug: HOTEL,
    roomName: ROOM,
    from: dateKey(FROM),
    to: dateKey(TO),
    rate: '5500',
    totalRooms: '4',
    confirmed: 'on',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  for (const day of weekdays) data.append('weekdays', String(day));
  return data;
}

const submit = (formData: FormData) => saveRates({ status: 'idle' }, formData);

async function cleanup() {
  await prisma.roomRate.deleteMany({ where: { hotelSlug: HOTEL, date: WINDOW } });
  await prisma.rateChange.deleteMany({ where: { hotelSlug: HOTEL, firstNight: WINDOW } });
}

beforeAll(async () => {
  process.env.ADMIN_SESSION_SECRET = originalAdminSecret ?? 'rates-test-secret';
});

beforeEach(async () => {
  mockState.cookieValue = await createSessionCookieValue();
  mockState.ip = `rates-${Math.random()}`;
  await cleanup();
});

afterAll(async () => {
  process.env.ADMIN_SESSION_SECRET = originalAdminSecret;
  await cleanup();
  await prisma.$disconnect();
});

describe('saveRates', () => {
  it('writes one row per night, inclusive of both dates', async () => {
    const state = await submit(rateFormData());

    expect(state.status).toBe('success');
    const rows = await prisma.roomRate.findMany({
      where: { hotelSlug: HOTEL, roomName: ROOM, date: WINDOW },
      orderBy: { date: 'asc' },
    });

    expect(rows).toHaveLength(5);
    expect(dateKey(rows[0]?.date as Date)).toBe(dateKey(FROM));
    expect(dateKey(rows[4]?.date as Date)).toBe(dateKey(TO));
    expect(rows[0]?.rate.toNumber()).toBe(5500);
    expect(rows[0]?.totalRooms).toBe(4);
    expect(rows[0]?.closed).toBe(false);
  });

  it('replaces what was already loaded rather than duplicating it', async () => {
    await submit(rateFormData());
    const state = await submit(rateFormData({ rate: '6200', totalRooms: '2' }));

    expect(state.status).toBe('success');
    const rows = await prisma.roomRate.findMany({
      where: { hotelSlug: HOTEL, roomName: ROOM, date: WINDOW },
    });
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.rate.toNumber() === 6200 && row.totalRooms === 2)).toBe(true);
  });

  it('records a stop sell', async () => {
    await submit(rateFormData({ closed: 'on' }));
    const rows = await prisma.roomRate.findMany({ where: { hotelSlug: HOTEL, date: WINDOW } });
    expect(rows.every((row) => row.closed)).toBe(true);
  });

  it('refuses a room type the property does not have', async () => {
    const state = await submit(rateFormData({ roomName: 'Presidential Yurt' }));

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/no room type/i);
    expect(await prisma.roomRate.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });

  it('refuses an unknown property', async () => {
    const state = await submit(rateFormData({ hotelSlug: 'atlantis' }));
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/unknown property/i);
  });

  it('refuses an end date before the start date', async () => {
    const state = await submit(rateFormData({ to: dateKey(addDays(FROM, -2)) }));
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/before the start date/i);
  });

  it('refuses a range long enough to be a typo', async () => {
    const state = await submit(rateFormData({ to: dateKey(addDays(FROM, 400)) }));
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/at most/i);
  });

  it('writes nothing without a valid admin session', async () => {
    mockState.cookieValue = undefined;
    const state = await submit(rateFormData());

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/sign in/i);
    expect(await prisma.roomRate.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });

  it('rejects a forged session cookie', async () => {
    mockState.cookieValue = `${Date.now() + 60_000}.deadbeef`;
    const state = await submit(rateFormData());

    expect(state.status).toBe('error');
    expect(await prisma.roomRate.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });
});

describe('the confirmation step', () => {
  it('writes nothing until the change is confirmed', async () => {
    const state = await submit(rateFormData({ confirmed: '' }));

    expect(state.status).toBe('preview');
    expect(state.preview?.nights).toBe(5);
    expect(state.preview?.existing).toBe(0);
    expect(state.preview?.changing).toBe(0);
    expect(await prisma.roomRate.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });

  it('counts how many nights are already loaded and how many actually differ', async () => {
    await submit(rateFormData({ to: dateKey(addDays(FROM, 2)) })); // 3 nights at 5500/4

    const state = await submit(rateFormData({ confirmed: '', rate: '6900' }));

    expect(state.status).toBe('preview');
    expect(state.preview).toMatchObject({ nights: 5, existing: 3, changing: 3 });
  });

  it('does not count a night re-saved at the values it already holds', async () => {
    await submit(rateFormData());

    const state = await submit(rateFormData({ confirmed: '' }));

    expect(state.preview).toMatchObject({ nights: 5, existing: 5, changing: 0 });
  });

  it('carries the property slug back so the confirmation can resubmit it', async () => {
    const state = await submit(rateFormData({ confirmed: '' }));
    expect(state.preview?.hotelSlug).toBe(HOTEL);
  });
});

describe('day-of-week filtering', () => {
  it('writes only the nights falling on the selected days', async () => {
    // FROM is a known weekday; select exactly the day it falls on.
    const onlyThatDay = FROM.getUTCDay();
    const state = await submit(rateFormData({ to: dateKey(addDays(FROM, 13)) }, [onlyThatDay]));

    expect(state.status).toBe('success');
    const rows = await prisma.roomRate.findMany({
      where: { hotelSlug: HOTEL, date: WINDOW },
      orderBy: { date: 'asc' },
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.date.getUTCDay() === onlyThatDay)).toBe(true);
  });

  it('treats no days ticked as every night, not none', async () => {
    const state = await submit(rateFormData({}, []));
    expect(state.status).toBe('success');
    expect(await prisma.roomRate.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(5);
  });

  it('leaves the other days of an existing season untouched', async () => {
    await submit(rateFormData({ to: dateKey(addDays(FROM, 13)) })); // 14 nights at 5500
    const weekendDay = FROM.getUTCDay();

    await submit(rateFormData({ to: dateKey(addDays(FROM, 13)), rate: '9900' }, [weekendDay]));

    const rows = await prisma.roomRate.findMany({ where: { hotelSlug: HOTEL, date: WINDOW } });
    expect(rows).toHaveLength(14);
    expect(rows.filter((r) => r.rate.toNumber() === 9900)).toHaveLength(2);
    expect(rows.filter((r) => r.rate.toNumber() === 5500)).toHaveLength(12);
  });

  it('refuses a range that contains none of the selected days', async () => {
    // A three-night range cannot contain all seven weekdays, so pick one it misses.
    const missing = (FROM.getUTCDay() + 4) % 7;
    const state = await submit(rateFormData({ to: dateKey(addDays(FROM, 2)) }, [missing]));

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/none of the selected days|no nights in that range/i);
  });
});

describe('the change log', () => {
  it('records what was written, by whom, and what it replaced', async () => {
    await submit(rateFormData({ rate: '5000', totalRooms: '3' }));
    await submit(rateFormData({ rate: '7000', totalRooms: '2' }));

    const changes = await prisma.rateChange.findMany({
      where: { hotelSlug: HOTEL, firstNight: WINDOW },
      orderBy: { createdAt: 'asc' },
    });

    expect(changes).toHaveLength(2);
    expect(changes[1]).toMatchObject({
      roomName: ROOM,
      nightsWritten: 5,
      nightsChanged: 5,
      totalRooms: 2,
    });
    expect(changes[1]?.rate.toNumber()).toBe(7000);
    expect(changes[1]?.actorIp).toBeTruthy();
    expect(changes[1]?.actor).toMatch(/admin/i);

    // The values it replaced, per night, so the log is a history not a list.
    const previous = changes[1]?.previous as Array<{ rate: number; totalRooms: number }>;
    expect(previous).toHaveLength(5);
    expect(previous[0]).toMatchObject({ rate: 5000, totalRooms: 3 });
  });

  it('records the write but not a replacement when nothing actually changed', async () => {
    await submit(rateFormData());
    await submit(rateFormData());

    const changes = await prisma.rateChange.findMany({
      where: { hotelSlug: HOTEL, firstNight: WINDOW },
      orderBy: { createdAt: 'asc' },
    });

    expect(changes[1]).toMatchObject({ nightsWritten: 5, nightsChanged: 0 });
    expect(changes[1]?.previous).toEqual([]);
  });

  it('writes no log entry for a rejected submission', async () => {
    await submit(rateFormData({ roomName: 'Presidential Yurt' }));
    expect(await prisma.rateChange.count({ where: { hotelSlug: HOTEL, firstNight: WINDOW } })).toBe(
      0,
    );
  });
});
