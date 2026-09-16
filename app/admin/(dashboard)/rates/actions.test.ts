import { addDays, dateKey, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestStaff, createTestStaff } from '../../../../test-utils/auth';
import { type LoadedRoom, clearNights, findRoom } from '../../../../test-utils/inventory';
import { saveRates } from './actions';

// createSessionCookieValue() needs this set — locally it comes from .env.local
// (loaded by vitest.config.ts), but CI has no such file, so this test must not
// depend on the ambient environment for it.

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'rates-test-default',
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'staff_session' && mockState.cookieValue
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

let room: LoadedRoom;
const FROM = addDays(todayUtc(), 400);
const TO = addDays(FROM, 4);
const WINDOW = { gte: addDays(todayUtc(), 390), lt: addDays(todayUtc(), 430) };

// Weekdays are multi-valued, so they are appended separately rather than
// squeezed into the single-value overrides map.
function rateFormData(overrides: Record<string, string> = {}, weekdays: number[] = []): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    hotelSlug: HOTEL,
    roomTypeId: room.roomTypeId,
    ratePlanId: room.ratePlanId,
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
  await clearNights(HOTEL, WINDOW);
  await prisma.auditEvent.deleteMany({ where: { hotelSlug: HOTEL } });
  await cleanupTestStaff();
}

beforeEach(async () => {
  await cleanup();
  room = await findRoom(HOTEL, ROOM);
  mockState.cookieValue = (await createTestStaff({ role: 'REVENUE' })).token;
  mockState.ip = `rates-${Math.random()}`;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('saveRates', () => {
  it('writes one row per night, inclusive of both dates', async () => {
    const state = await submit(rateFormData());

    expect(state.status).toBe('success');
    const rows = await prisma.roomInventory.findMany({
      where: { hotelSlug: HOTEL, roomTypeId: room.roomTypeId, date: WINDOW },
      orderBy: { date: 'asc' },
    });

    expect(rows).toHaveLength(5);
    expect(dateKey(rows[0]?.date as Date)).toBe(dateKey(FROM));
    expect(dateKey(rows[4]?.date as Date)).toBe(dateKey(TO));
    expect(rows[0]?.roomsOnSale).toBe(4);
    expect(rows[0]?.stopSell).toBe(false);
  });

  it('writes the price against the chosen rate plan', async () => {
    await submit(rateFormData());

    const prices = await prisma.ratePrice.findMany({
      where: { ratePlanId: room.ratePlanId, date: WINDOW },
    });
    expect(prices).toHaveLength(5);
    expect(prices.every((row) => row.amount.toNumber() === 5500)).toBe(true);
  });

  it('replaces what was already loaded rather than duplicating it', async () => {
    await submit(rateFormData());
    const state = await submit(rateFormData({ rate: '6200', totalRooms: '2' }));

    expect(state.status).toBe('success');
    const rows = await prisma.roomInventory.findMany({
      where: { hotelSlug: HOTEL, roomTypeId: room.roomTypeId, date: WINDOW },
    });
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.roomsOnSale === 2)).toBe(true);
  });

  it('records a stop sell', async () => {
    await submit(rateFormData({ closed: 'on' }));
    const rows = await prisma.roomInventory.findMany({ where: { hotelSlug: HOTEL, date: WINDOW } });
    expect(rows.every((row) => row.stopSell)).toBe(true);
  });

  it('refuses a room type belonging to another property', async () => {
    const elsewhere = await findRoom('ooty', 'Deluxe Room');
    const state = await submit(
      rateFormData({ roomTypeId: elsewhere.roomTypeId, ratePlanId: elsewhere.ratePlanId }),
    );

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/do not belong to this property/i);
    expect(await prisma.roomInventory.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });

  it('refuses a rate plan that belongs to a different room type', async () => {
    const otherRoom = await findRoom(HOTEL, 'Deluxe Family Room');
    const state = await submit(rateFormData({ ratePlanId: otherRoom.ratePlanId }));

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/do not belong to this property/i);
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

  it('writes nothing without a valid session', async () => {
    mockState.cookieValue = undefined;
    const state = await submit(rateFormData());

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/session has ended/i);
    expect(await prisma.roomInventory.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });

  it('rejects a forged session cookie', async () => {
    mockState.cookieValue = 'not-a-real-session-token';
    const state = await submit(rateFormData());

    expect(state.status).toBe('error');
    expect(await prisma.roomInventory.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });
});

describe('who may load rates', () => {
  it.each(['RESERVATIONS', 'HOTEL', 'VIEWER'] as const)('refuses a %s user', async (role) => {
    mockState.cookieValue = (await createTestStaff({ role, hotels: [HOTEL] })).token;

    const state = await submit(rateFormData());

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/permission/i);
    expect(await prisma.roomInventory.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });

  it.each(['ADMIN', 'REVENUE'] as const)('allows a %s user', async (role) => {
    mockState.cookieValue = (await createTestStaff({ role })).token;
    expect((await submit(rateFormData())).status).toBe('success');
  });

  it('refuses a user restricted to other properties', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'REVENUE', hotels: ['ooty'] })).token;

    const state = await submit(rateFormData());

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/not one you have access to/i);
    expect(await prisma.roomInventory.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });

  it('allows a user restricted to this property', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'REVENUE', hotels: [HOTEL] })).token;
    expect((await submit(rateFormData())).status).toBe('success');
  });
});

describe('the confirmation step', () => {
  it('writes nothing until the change is confirmed', async () => {
    const state = await submit(rateFormData({ confirmed: '' }));

    expect(state.status).toBe('preview');
    expect(state.preview?.nights).toBe(5);
    expect(state.preview?.existing).toBe(0);
    expect(state.preview?.changing).toBe(0);
    expect(await prisma.roomInventory.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(0);
  });

  it('counts how many nights are already loaded and how many actually differ', async () => {
    await submit(rateFormData({ to: dateKey(addDays(FROM, 2)) }));

    const state = await submit(rateFormData({ confirmed: '', rate: '6900' }));

    expect(state.preview).toMatchObject({ nights: 5, existing: 3, changing: 3 });
  });

  it('does not count a night re-saved at the values it already holds', async () => {
    await submit(rateFormData());

    const state = await submit(rateFormData({ confirmed: '' }));

    expect(state.preview).toMatchObject({ nights: 5, existing: 5, changing: 0 });
  });

  it('counts a night whose rate changed even when its inventory did not', async () => {
    await submit(rateFormData());

    const state = await submit(rateFormData({ confirmed: '', rate: '7777' }));

    expect(state.preview).toMatchObject({ existing: 5, changing: 5 });
  });

  it('carries the ids back so the confirmation can resubmit them', async () => {
    const state = await submit(rateFormData({ confirmed: '' }));
    expect(state.preview).toMatchObject({
      hotelSlug: HOTEL,
      roomTypeId: room.roomTypeId,
      ratePlanId: room.ratePlanId,
    });
  });
});

describe('day-of-week filtering', () => {
  it('writes only the nights falling on the selected days', async () => {
    const onlyThatDay = FROM.getUTCDay();
    const state = await submit(rateFormData({ to: dateKey(addDays(FROM, 13)) }, [onlyThatDay]));

    expect(state.status).toBe('success');
    const rows = await prisma.roomInventory.findMany({
      where: { hotelSlug: HOTEL, date: WINDOW },
      orderBy: { date: 'asc' },
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.date.getUTCDay() === onlyThatDay)).toBe(true);
  });

  it('treats no days ticked as every night, not none', async () => {
    expect((await submit(rateFormData({}, []))).status).toBe('success');
    expect(await prisma.roomInventory.count({ where: { hotelSlug: HOTEL, date: WINDOW } })).toBe(5);
  });

  it('leaves the other days of an existing season untouched', async () => {
    await submit(rateFormData({ to: dateKey(addDays(FROM, 13)) }));
    const weekendDay = FROM.getUTCDay();

    await submit(
      rateFormData({ to: dateKey(addDays(FROM, 13)), rate: '9900', totalRooms: '1' }, [weekendDay]),
    );

    const rows = await prisma.roomInventory.findMany({ where: { hotelSlug: HOTEL, date: WINDOW } });
    expect(rows).toHaveLength(14);
    expect(rows.filter((r) => r.roomsOnSale === 1)).toHaveLength(2);
    expect(rows.filter((r) => r.roomsOnSale === 4)).toHaveLength(12);
  });

  it('refuses a range that contains none of the selected days', async () => {
    const missing = (FROM.getUTCDay() + 4) % 7;
    const state = await submit(rateFormData({ to: dateKey(addDays(FROM, 2)) }, [missing]));

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/none of the days|no nights in that range/i);
  });
});

describe('the audit log', () => {
  it('records what was written, by whom, and what it replaced', async () => {
    await submit(rateFormData({ rate: '5000', totalRooms: '3' }));
    await submit(rateFormData({ rate: '7000', totalRooms: '2' }));

    const events = await prisma.auditEvent.findMany({
      where: { hotelSlug: HOTEL, action: 'rates.updated' },
      orderBy: { at: 'asc' },
    });

    expect(events).toHaveLength(2);
    expect(events[1]?.summary).toMatch(/5 nights written, 5 changed/);
    // A real person, not a shared login.
    expect(events[1]?.actorLabel).toMatch(/@vitest-staff\.invalid>/);
    expect(events[1]?.actorUserId).toBeTruthy();

    const after = events[1]?.after as { rate: number; roomsOnSale: number };
    expect(after).toMatchObject({ rate: 7000, roomsOnSale: 2 });

    const before = events[1]?.before as Array<{ rate: number; roomsOnSale: number }>;
    expect(before).toHaveLength(5);
    expect(before[0]).toMatchObject({ rate: 5000, roomsOnSale: 3 });
  });

  it('records the write but no replacement when nothing actually changed', async () => {
    await submit(rateFormData());
    await submit(rateFormData());

    const events = await prisma.auditEvent.findMany({
      where: { hotelSlug: HOTEL, action: 'rates.updated' },
      orderBy: { at: 'asc' },
    });

    expect(events[1]?.summary).toMatch(/5 nights written, 0 changed/);
    expect(events[1]?.before).toEqual([]);
  });

  it('writes no audit entry for a rejected submission', async () => {
    const elsewhere = await findRoom('ooty', 'Deluxe Room');
    await submit(
      rateFormData({ roomTypeId: elsewhere.roomTypeId, ratePlanId: elsewhere.ratePlanId }),
    );

    expect(
      await prisma.auditEvent.count({ where: { hotelSlug: HOTEL, action: 'rates.updated' } }),
    ).toBe(0);
  });
});
