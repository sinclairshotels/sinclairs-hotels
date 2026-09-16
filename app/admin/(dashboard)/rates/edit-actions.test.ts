import { addDays, dateKey, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestStaff, createTestStaff } from '../../../../test-utils/auth';
import {
  type LoadedRoom,
  clearNights,
  findRoom,
  loadNights,
} from '../../../../test-utils/inventory';
import { copyRoomRates, copyWeek, editRates } from './edit-actions';

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'rates-edit-test',
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'staff_session' && mockState.cookieValue
        ? { value: mockState.cookieValue }
        : undefined,
  }),
  headers: async () => ({ get: (name: string) => (name === 'x-real-ip' ? mockState.ip : null) }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const HOTEL = 'gangtok';
const ROOM = 'Deluxe Room';
const OTHER_ROOM = 'Deluxe Family Room';
const TEST_EMAIL_DOMAIN = 'vitest-rate-edit.invalid';

// Far enough out that this file owns the window outright.
const FIRST = addDays(todayUtc(), 500);
const WINDOW = { gte: addDays(todayUtc(), 490), lt: addDays(todayUtc(), 540) };

let room: LoadedRoom;
let otherRoom: LoadedRoom;

const night = (offset: number) => addDays(FIRST, offset);
const nights = (count: number, start = 0) =>
  Array.from({ length: count }, (_, i) => night(start + i));

const NO_CHANGE: Record<string, string> = {
  rateMode: 'none',
  roomsMode: 'none',
  stopSell: 'none',
  minStayMode: 'none',
  closedToArrival: 'none',
  closedToDeparture: 'none',
};

function editFormData(
  overrides: Record<string, string> = {},
  { rows, dates }: { rows?: string[]; dates?: Date[] } = {},
): FormData {
  const data = new FormData();
  const fields = { hotelSlug: HOTEL, confirmed: 'on', ...NO_CHANGE, ...overrides };
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  for (const row of rows ?? [`${room.roomTypeId}:${room.ratePlanId}`]) data.append('rows', row);
  for (const date of dates ?? nights(3)) data.append('dates', dateKey(date));
  return data;
}

const submitEdit = (formData: FormData) => editRates({ status: 'idle' }, formData);

async function bookRooms(rooms: number, checkIn: Date, checkOut: Date) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return prisma.booking.create({
    data: {
      reference: `EDIT-${suffix}`,
      viewToken: `edit-${suffix}`,
      hotelSlug: HOTEL,
      roomTypeId: room.roomTypeId,
      ratePlanId: room.ratePlanId,
      roomName: room.roomName,
      checkIn,
      checkOut,
      rooms,
      adults: 2,
      guestName: 'Edit Guest',
      guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: 'Somewhere',
      roomTotal: 1,
      taxTotal: 0,
      total: 1,
      status: 'CONFIRMED',
    },
  });
}

async function inventoryRows() {
  return prisma.roomInventory.findMany({
    where: { roomTypeId: room.roomTypeId, date: WINDOW },
    orderBy: { date: 'asc' },
  });
}

async function priceRows(ratePlanId?: string) {
  return prisma.ratePrice.findMany({
    where: { ratePlanId: ratePlanId ?? room.ratePlanId, date: WINDOW },
    orderBy: { date: 'asc' },
  });
}

async function cleanup() {
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await clearNights(HOTEL, WINDOW);
  await prisma.auditEvent.deleteMany({ where: { hotelSlug: HOTEL } });
  await cleanupTestStaff();
}

beforeEach(async () => {
  await cleanup();
  room = await findRoom(HOTEL, ROOM);
  otherRoom = await findRoom(HOTEL, OTHER_ROOM);
  mockState.cookieValue = (await createTestStaff({ role: 'REVENUE' })).token;
  mockState.ip = `rates-edit-${Math.random()}`;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('editRates', () => {
  it('loads rate and allotment onto nights that had nothing', async () => {
    const state = await submitEdit(
      editFormData({ rateMode: 'set', rateValue: '6000', roomsMode: 'set', roomsValue: '4' }),
    );

    expect(state.status).toBe('success');
    const inventory = await inventoryRows();
    expect(inventory).toHaveLength(3);
    expect(inventory.every((row) => row.roomsOnSale === 4)).toBe(true);
    expect((await priceRows()).every((row) => row.amount.toNumber() === 6000)).toBe(true);
  });

  it('adjusts an existing rate by a percentage without touching the allotment', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 3 });

    await submitEdit(editFormData({ rateMode: 'increasePercent', rateValue: '10' }));

    expect((await priceRows()).every((row) => row.amount.toNumber() === 5500)).toBe(true);
    expect((await inventoryRows()).every((row) => row.roomsOnSale === 3)).toBe(true);
  });

  it('changes only the fields asked for, leaving restrictions alone', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 3, minStay: 2 });

    await submitEdit(editFormData({ stopSell: 'on' }));

    const inventory = await inventoryRows();
    expect(
      inventory.every((row) => row.stopSell && row.minStay === 2 && row.roomsOnSale === 3),
    ).toBe(true);
    expect((await priceRows()).every((row) => row.amount.toNumber() === 5000)).toBe(true);
  });

  it('sets and clears the stay restrictions', async () => {
    await loadNights(room, HOTEL, nights(3), { roomsOnSale: 3 });

    await submitEdit(
      editFormData({
        minStayMode: 'set',
        minStayValue: '3',
        closedToArrival: 'on',
        closedToDeparture: 'on',
      }),
    );
    let inventory = await inventoryRows();
    expect(
      inventory.every((r) => r.minStay === 3 && r.closedToArrival && r.closedToDeparture),
    ).toBe(true);

    await submitEdit(editFormData({ minStayMode: 'clear', closedToArrival: 'off' }));
    inventory = await inventoryRows();
    expect(
      inventory.every((r) => r.minStay === null && !r.closedToArrival && r.closedToDeparture),
    ).toBe(true);
  });

  it('narrows a selection to the days of the week chosen', async () => {
    await loadNights(room, HOTEL, nights(14), { rate: 5000, roomsOnSale: 3 });
    const weekday = FIRST.getUTCDay();

    const data = editFormData({ rateMode: 'set', rateValue: '9000' }, { dates: nights(14) });
    data.append('weekdays', String(weekday));
    await submitEdit(data);

    const prices = await priceRows();
    expect(prices.filter((row) => row.amount.toNumber() === 9000)).toHaveLength(2);
    expect(prices.filter((row) => row.amount.toNumber() === 5000)).toHaveLength(12);
  });

  it('applies to a date range when no explicit nights are selected', async () => {
    const data = new FormData();
    for (const [key, value] of Object.entries({
      hotelSlug: HOTEL,
      confirmed: 'on',
      ...NO_CHANGE,
      rateMode: 'set',
      rateValue: '4200',
      roomsMode: 'set',
      roomsValue: '2',
      from: dateKey(FIRST),
      to: dateKey(night(6)),
    })) {
      data.append(key, value);
    }
    data.append('rows', `${room.roomTypeId}:${room.ratePlanId}`);

    expect((await submitEdit(data)).status).toBe('success');
    expect(await inventoryRows()).toHaveLength(7);
  });

  it('edits several rows at once, writing one inventory row per room type', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 3 });
    await loadNights(otherRoom, HOTEL, nights(3), { rate: 8000, roomsOnSale: 2 });

    await submitEdit(
      editFormData(
        { roomsMode: 'set', roomsValue: '5' },
        {
          rows: [
            `${room.roomTypeId}:${room.ratePlanId}`,
            `${otherRoom.roomTypeId}:${otherRoom.ratePlanId}`,
          ],
        },
      ),
    );

    expect((await inventoryRows()).every((r) => r.roomsOnSale === 5)).toBe(true);
    const otherInventory = await prisma.roomInventory.findMany({
      where: { roomTypeId: otherRoom.roomTypeId, date: WINDOW },
    });
    expect(otherInventory.every((r) => r.roomsOnSale === 5)).toBe(true);
  });
});

describe('the oversell guard', () => {
  it('refuses to cut the allotment below what is already sold, and writes nothing', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 4 });
    await bookRooms(3, night(0), night(2));

    const state = await submitEdit(editFormData({ roomsMode: 'set', roomsValue: '1' }));

    expect(state.status).toBe('error');
    expect(state.conflicts).toHaveLength(2);
    expect(state.conflicts?.[0]).toMatchObject({ sold: 3, attempted: 1, roomName: ROOM });
    // Nothing at all was written, including the nights that had no conflict.
    expect((await inventoryRows()).every((row) => row.roomsOnSale === 4)).toBe(true);
  });

  it('allows cutting exactly to what is sold', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 4 });
    await bookRooms(2, night(0), night(3));

    expect((await submitEdit(editFormData({ roomsMode: 'set', roomsValue: '2' }))).status).toBe(
      'success',
    );
  });

  it('ignores bookings that hold nothing', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 4 });
    const booking = await bookRooms(4, night(0), night(3));
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });

    expect((await submitEdit(editFormData({ roomsMode: 'set', roomsValue: '1' }))).status).toBe(
      'success',
    );
  });
});

describe('the confirmation step', () => {
  it('writes nothing until confirmed, and reports what would change', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 3 });

    const state = await submitEdit(
      editFormData({ confirmed: '', rateMode: 'set', rateValue: '7000' }),
    );

    expect(state.status).toBe('preview');
    expect(state.preview).toMatchObject({ cells: 3, changing: 3 });
    expect(state.preview?.summary).toEqual(['Rate set to ₹7,000']);
    expect(state.preview?.sample[0]?.before).toContain('₹5,000');
    expect(state.preview?.sample[0]?.after).toContain('₹7,000');
    expect((await priceRows()).every((row) => row.amount.toNumber() === 5000)).toBe(true);
  });

  it('counts a re-save at the same values as no change', async () => {
    await loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 3 });

    const state = await submitEdit(
      editFormData({ confirmed: '', rateMode: 'set', rateValue: '5000' }),
    );

    expect(state.preview).toMatchObject({ cells: 3, changing: 0 });
  });

  it('refuses a submission that changes nothing at all', async () => {
    const state = await submitEdit(editFormData({ confirmed: '' }));
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/at least one field/i);
  });
});

describe('who may edit rates', () => {
  it.each(['RESERVATIONS', 'HOTEL', 'VIEWER'] as const)('refuses a %s user', async (role) => {
    mockState.cookieValue = (await createTestStaff({ role, hotels: [HOTEL] })).token;

    const state = await submitEdit(editFormData({ roomsMode: 'set', roomsValue: '9' }));

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/permission/i);
    expect(await inventoryRows()).toHaveLength(0);
  });

  it('refuses a user restricted to another property', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'REVENUE', hotels: ['ooty'] })).token;

    const state = await submitEdit(editFormData({ roomsMode: 'set', roomsValue: '9' }));

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/not one you have access to/i);
  });

  it('refuses a row belonging to another property', async () => {
    const elsewhere = await findRoom('ooty', 'Deluxe Room');

    const state = await submitEdit(
      editFormData(
        { roomsMode: 'set', roomsValue: '9' },
        { rows: [`${elsewhere.roomTypeId}:${elsewhere.ratePlanId}`] },
      ),
    );

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/do not belong to this property/i);
  });

  it('records the change against the person who made it', async () => {
    await submitEdit(editFormData({ roomsMode: 'set', roomsValue: '4' }));

    const event = await prisma.auditEvent.findFirst({
      where: { hotelSlug: HOTEL, action: 'rates.bulk_edited' },
    });
    expect(event?.actorLabel).toMatch(/@vitest-staff\.invalid>/);
    expect(event?.summary).toMatch(/4 rooms on sale/);
  });
});

describe('copyWeek', () => {
  function copyFormData(overrides: Record<string, string> = {}): FormData {
    const data = new FormData();
    const fields = {
      hotelSlug: HOTEL,
      roomTypeId: room.roomTypeId,
      ratePlanId: room.ratePlanId,
      sourceWeekStart: dateKey(FIRST),
      targetFrom: dateKey(night(7)),
      targetTo: dateKey(night(20)),
      confirmed: 'on',
      ...overrides,
    };
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    return data;
  }

  it('repeats a week by day of week', async () => {
    // A cheap week with one expensive day in it.
    await loadNights(room, HOTEL, nights(7), { rate: 4000, roomsOnSale: 3 });
    await loadNights(room, HOTEL, [night(5)], { rate: 9000, roomsOnSale: 2 });

    expect((await copyWeek({ status: 'idle' }, copyFormData())).status).toBe('success');

    const prices = await priceRows();
    // The expensive weekday recurs twice more across the fortnight copied.
    expect(prices.filter((row) => row.amount.toNumber() === 9000)).toHaveLength(3);
  });

  it('previews before writing', async () => {
    await loadNights(room, HOTEL, nights(7), { rate: 4000, roomsOnSale: 3 });

    const state = await copyWeek({ status: 'idle' }, copyFormData({ confirmed: '' }));

    expect(state.status).toBe('preview');
    expect(state.nights).toBe(14);
    expect(
      await prisma.ratePrice.count({ where: { ratePlanId: room.ratePlanId, date: WINDOW } }),
    ).toBe(7);
  });

  it('refuses when the source week has nothing loaded', async () => {
    const state = await copyWeek({ status: 'idle' }, copyFormData());
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/nothing loaded/i);
  });

  it('will not copy an allotment over nights already sold beyond it', async () => {
    await loadNights(room, HOTEL, nights(7), { rate: 4000, roomsOnSale: 1 });
    await bookRooms(3, night(7), night(9));

    const state = await copyWeek({ status: 'idle' }, copyFormData());

    expect(state.status).toBe('error');
    expect(state.conflicts?.length).toBeGreaterThan(0);
  });
});

describe('copyRoomRates', () => {
  function copyFormData(overrides: Record<string, string> = {}): FormData {
    const data = new FormData();
    const fields = {
      hotelSlug: HOTEL,
      sourceRatePlanId: room.ratePlanId,
      targetRatePlanId: otherRoom.ratePlanId,
      from: dateKey(FIRST),
      to: dateKey(night(2)),
      differenceMode: 'same',
      confirmed: 'on',
      ...overrides,
    };
    for (const [key, value] of Object.entries(fields)) data.append(key, value);
    return data;
  }

  beforeEach(() => loadNights(room, HOTEL, nights(3), { rate: 5000, roomsOnSale: 3 }));

  it('copies prices across at the same rate', async () => {
    expect((await copyRoomRates({ status: 'idle' }, copyFormData())).status).toBe('success');

    const target = await priceRows(otherRoom.ratePlanId);
    expect(target).toHaveLength(3);
    expect(target.every((row) => row.amount.toNumber() === 5000)).toBe(true);
  });

  it.each([
    ['amount', '2000', 7000],
    ['percent', '20', 6000],
  ] as const)('applies a %s difference', async (differenceMode, differenceValue, expected) => {
    await copyRoomRates({ status: 'idle' }, copyFormData({ differenceMode, differenceValue }));

    expect(
      (await priceRows(otherRoom.ratePlanId)).every((r) => r.amount.toNumber() === expected),
    ).toBe(true);
  });

  it('does not touch the target room’s allotment', async () => {
    await loadNights(otherRoom, HOTEL, nights(3), { rate: 1, roomsOnSale: 9 });

    await copyRoomRates({ status: 'idle' }, copyFormData());

    const inventory = await prisma.roomInventory.findMany({
      where: { roomTypeId: otherRoom.roomTypeId, date: WINDOW },
    });
    expect(inventory.every((row) => row.roomsOnSale === 9)).toBe(true);
  });

  it('refuses to copy a room onto itself', async () => {
    const state = await copyRoomRates(
      { status: 'idle' },
      copyFormData({ targetRatePlanId: room.ratePlanId }),
    );
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/two different/i);
  });

  it('refuses when the source has no prices in the range', async () => {
    await clearNights(HOTEL, WINDOW);
    const state = await copyRoomRates({ status: 'idle' }, copyFormData());
    expect(state.status).toBe('error');
    expect(state.message).toMatch(/no prices/i);
  });
});
