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

function rateFormData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    hotelSlug: HOTEL,
    roomName: ROOM,
    from: dateKey(FROM),
    to: dateKey(TO),
    rate: '5500',
    totalRooms: '4',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const submit = (formData: FormData) => saveRates({ status: 'idle' }, formData);

async function cleanup() {
  await prisma.roomRate.deleteMany({ where: { hotelSlug: HOTEL, date: WINDOW } });
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
