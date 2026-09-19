import { dateKey, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { monthKey, monthsAhead } from '@/lib/rate-plan';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestStaff, createTestStaff } from '../../../../test-utils/auth';
import { type LoadedRoom, findRoom } from '../../../../test-utils/inventory';
import { saveDailyRate, saveMonthlyRates } from './plan-actions';

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'rates-plan-test',
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

const HOTEL = 'siliguri';
const ROOM = 'Garden Suite';
const TEST_EMAIL_DOMAIN = 'vitest-rate-plan.invalid';

// The eleventh month ahead: far enough that no other suite is loading it, and
// still inside the twelve the screen offers.
const MONTH = monthsAhead(todayUtc(), 12)[10] as string;
const [MONTH_YEAR, MONTH_NUMBER] = MONTH.split('-').map(Number) as [number, number];
const MONTH_START = new Date(Date.UTC(MONTH_YEAR, MONTH_NUMBER - 1, 1));
const MONTH_END = new Date(Date.UTC(MONTH_YEAR, MONTH_NUMBER, 1));
const NIGHTS_IN_MONTH = Math.round((MONTH_END.getTime() - MONTH_START.getTime()) / 86_400_000);
const MID_MONTH = new Date(Date.UTC(MONTH_YEAR, MONTH_NUMBER - 1, 15));

let room: LoadedRoom;
let staffUser: Awaited<ReturnType<typeof createTestStaff>>;

function monthlyForm(
  cells: Array<{ roomTypeId: string; month: string; roomsOnSale?: number; rate?: number }>,
  options: { overrides?: 'keep' | 'replace'; confirmed?: boolean } = {},
): FormData {
  const data = new FormData();
  data.append('hotelSlug', HOTEL);
  data.append('cells', JSON.stringify(cells));
  data.append('overrides', options.overrides ?? 'keep');
  if (options.confirmed !== false) data.append('confirmed', 'on');
  return data;
}

function dailyForm(fields: Record<string, string>): FormData {
  const data = new FormData();
  data.append('hotelSlug', HOTEL);
  data.append('roomTypeId', room.roomTypeId);
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const saveMonth = (formData: FormData) => saveMonthlyRates({ status: 'idle' }, formData);
const saveDay = (formData: FormData) => saveDailyRate({ status: 'idle' }, formData);

async function clearMonth() {
  await prisma.roomInventory.deleteMany({
    where: { hotelSlug: HOTEL, date: { gte: MONTH_START, lt: MONTH_END } },
  });
  await prisma.ratePrice.deleteMany({
    where: { hotelSlug: HOTEL, date: { gte: MONTH_START, lt: MONTH_END } },
  });
}

async function inventoryRows() {
  return prisma.roomInventory.findMany({
    where: { roomTypeId: room.roomTypeId, date: { gte: MONTH_START, lt: MONTH_END } },
    orderBy: { date: 'asc' },
  });
}

async function priceRows() {
  return prisma.ratePrice.findMany({
    where: { ratePlanId: room.ratePlanId, date: { gte: MONTH_START, lt: MONTH_END } },
    orderBy: { date: 'asc' },
  });
}

describe('the monthly and daily rate screens', () => {
  beforeEach(async () => {
    room = await findRoom(HOTEL, ROOM);
    await clearMonth();
    await prisma.booking.deleteMany({
      where: { hotelSlug: HOTEL, guestEmail: { endsWith: TEST_EMAIL_DOMAIN } },
    });
    await cleanupTestStaff();
    staffUser = await createTestStaff({ role: 'REVENUE' });
    mockState.cookieValue = staffUser.token;
  });

  afterAll(async () => {
    await clearMonth();
    await prisma.booking.deleteMany({
      where: { hotelSlug: HOTEL, guestEmail: { endsWith: TEST_EMAIL_DOMAIN } },
    });
    await cleanupTestStaff();
    await prisma.$disconnect();
  });

  describe('saving a month', () => {
    it('writes one value to every night in it', async () => {
      const result = await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );

      expect(result.status).toBe('success');
      const inventory = await inventoryRows();
      const prices = await priceRows();
      expect(inventory).toHaveLength(NIGHTS_IN_MONTH);
      expect(prices).toHaveLength(NIGHTS_IN_MONTH);
      expect(inventory.every((row) => row.roomsOnSale === 4)).toBe(true);
      expect(prices.every((row) => row.amount.toNumber() === 6000)).toBe(true);
      expect(inventory.every((row) => row.source === 'MONTHLY')).toBe(true);
    });

    it('previews before writing anything', async () => {
      const result = await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }], {
          confirmed: false,
        }),
      );

      expect(result.status).toBe('preview');
      expect(result.preview?.nights).toBe(NIGHTS_IN_MONTH);
      expect(result.preview?.changing).toBe(NIGHTS_IN_MONTH);
      expect(await inventoryRows()).toHaveLength(0);
    });

    it('counts a re-save at the same values as an overwrite, not a change', async () => {
      const cells = [{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }];
      await saveMonth(monthlyForm(cells));

      const again = await saveMonth(monthlyForm(cells, { confirmed: false }));
      expect(again.preview?.nights).toBe(NIGHTS_IN_MONTH);
      expect(again.preview?.changing).toBe(0);
    });

    it('changes the allotment without touching the price when only rooms are given', async () => {
      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );
      await saveMonth(monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 2 }]));

      expect((await inventoryRows()).every((row) => row.roomsOnSale === 2)).toBe(true);
      expect((await priceRows()).every((row) => row.amount.toNumber() === 6000)).toBe(true);
    });

    it('refuses a month outside the twelve on offer', async () => {
      const result = await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: '2099-01', roomsOnSale: 4 }]),
      );

      expect(result.status).toBe('error');
      expect(result.message).toMatch(/outside the twelve months/i);
    });

    it('refuses cutting the allotment below what is already sold, and writes nothing', async () => {
      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );
      const suffix = Math.random().toString(36).slice(2, 10);
      await prisma.booking.create({
        data: {
          reference: `PLAN-${suffix}`,
          viewToken: `plan-${suffix}`,
          hotelSlug: HOTEL,
          roomTypeId: room.roomTypeId,
          ratePlanId: room.ratePlanId,
          roomName: room.roomName,
          checkIn: MID_MONTH,
          checkOut: new Date(MID_MONTH.getTime() + 86_400_000),
          rooms: 3,
          adults: 2,
          guestName: 'Plan Guest',
          guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
          guestPhone: '+91 98300 00000',
          billingAddress: 'Somewhere',
          roomTotal: 1,
          taxTotal: 0,
          total: 1,
          status: 'CONFIRMED',
        },
      });

      const result = await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 1 }]),
      );

      expect(result.status).toBe('error');
      expect(result.conflicts?.[0]).toMatchObject({ sold: 3, attempted: 1 });
      // untouched: the whole save is refused, not the offending night alone
      expect((await inventoryRows()).every((row) => row.roomsOnSale === 4)).toBe(true);
    });

    it('records the save in the audit log', async () => {
      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );

      const event = await prisma.auditEvent.findFirst({
        where: { action: 'rates.month_saved', hotelSlug: HOTEL },
        orderBy: { at: 'desc' },
      });
      expect(event?.summary).toMatch(/₹6,000 a night/);
      expect(event?.actorLabel).toContain(staffUser.email);
    });
  });

  describe('a daily override', () => {
    it('saves only that night, and marks it as set daily', async () => {
      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );

      const result = await saveDay(
        dailyForm({ date: dateKey(MID_MONTH), rate: '9000', roomsOnSale: '2' }),
      );
      expect(result.status).toBe('success');

      const rows = await inventoryRows();
      const overridden = rows.filter((row) => row.source === 'DAILY');
      expect(overridden).toHaveLength(1);
      expect(dateKey(overridden[0]?.date as Date)).toBe(dateKey(MID_MONTH));
      expect(overridden[0]?.roomsOnSale).toBe(2);
      expect(rows.filter((row) => row.roomsOnSale === 4)).toHaveLength(NIGHTS_IN_MONTH - 1);
    });

    it('survives the next monthly save when overrides are kept', async () => {
      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );
      await saveDay(dailyForm({ date: dateKey(MID_MONTH), rate: '9000' }));

      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, rate: 7000 }], {
          overrides: 'keep',
        }),
      );

      const prices = await priceRows();
      const pinned = prices.find((row) => dateKey(row.date) === dateKey(MID_MONTH));
      expect(pinned?.amount.toNumber()).toBe(9000);
      expect(prices.filter((row) => row.amount.toNumber() === 7000)).toHaveLength(
        NIGHTS_IN_MONTH - 1,
      );
    });

    it('is flattened when staff choose to replace overrides', async () => {
      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );
      await saveDay(dailyForm({ date: dateKey(MID_MONTH), rate: '9000' }));

      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, rate: 7000 }], {
          overrides: 'replace',
        }),
      );

      const prices = await priceRows();
      expect(prices.every((row) => row.amount.toNumber() === 7000)).toBe(true);
      expect(prices.every((row) => row.source === 'MONTHLY')).toBe(true);
    });

    it('is counted in the preview so staff are asked before it is replaced', async () => {
      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );
      await saveDay(dailyForm({ date: dateKey(MID_MONTH), rate: '9000' }));

      const preview = await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, rate: 7000 }], {
          confirmed: false,
        }),
      );

      expect(preview.preview?.overrides).toBe(1);
      expect(preview.preview?.nights).toBe(NIGHTS_IN_MONTH - 1);
    });

    it('refuses a night in the past', async () => {
      const yesterday = new Date(todayUtc().getTime() - 86_400_000);
      const result = await saveDay(dailyForm({ date: dateKey(yesterday), rate: '9000' }));

      expect(result.status).toBe('error');
      expect(result.message).toMatch(/in the past/i);
    });

    it('refuses an empty submission rather than writing nothing quietly', async () => {
      const result = await saveDay(dailyForm({ date: dateKey(MID_MONTH) }));

      expect(result.status).toBe('error');
      expect(result.message).toMatch(/price, an allotment, or both/i);
    });

    it('refuses to cut a night below what is already sold', async () => {
      await saveMonth(
        monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
      );
      const suffix = Math.random().toString(36).slice(2, 10);
      await prisma.booking.create({
        data: {
          reference: `PLAN-${suffix}`,
          viewToken: `plan-${suffix}`,
          hotelSlug: HOTEL,
          roomTypeId: room.roomTypeId,
          ratePlanId: room.ratePlanId,
          roomName: room.roomName,
          checkIn: MID_MONTH,
          checkOut: new Date(MID_MONTH.getTime() + 86_400_000),
          rooms: 2,
          adults: 2,
          guestName: 'Plan Guest',
          guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
          guestPhone: '+91 98300 00000',
          billingAddress: 'Somewhere',
          roomTotal: 1,
          taxTotal: 0,
          total: 1,
          status: 'CONFIRMED',
        },
      });

      const result = await saveDay(dailyForm({ date: dateKey(MID_MONTH), roomsOnSale: '1' }));

      expect(result.status).toBe('error');
      expect(result.conflict).toMatchObject({ sold: 2, attempted: 1 });
    });

    it('records the override in the audit log', async () => {
      await saveDay(dailyForm({ date: dateKey(MID_MONTH), rate: '9000' }));

      const event = await prisma.auditEvent.findFirst({
        where: { action: 'rates.day_overridden', hotelSlug: HOTEL },
        orderBy: { at: 'desc' },
      });
      expect(event?.summary).toContain(dateKey(MID_MONTH));
    });
  });

  it('refuses a user without rates:write', async () => {
    await cleanupTestStaff();
    const staff = await createTestStaff({ role: 'RESERVATIONS' });
    mockState.cookieValue = staff.token;

    const result = await saveMonth(
      monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4 }]),
    );

    expect(result.status).toBe('error');
    expect(await inventoryRows()).toHaveLength(0);
  });

  it('is scoped to a hotel the user may touch', async () => {
    await cleanupTestStaff();
    const staff = await createTestStaff({ role: 'REVENUE', hotels: ['gangtok'] });
    mockState.cookieValue = staff.token;

    const result = await saveMonth(
      monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4 }]),
    );

    expect(result.status).toBe('error');
    expect(await inventoryRows()).toHaveLength(0);
  });

  it('keeps the month key and the written dates in step', async () => {
    await saveMonth(
      monthlyForm([{ roomTypeId: room.roomTypeId, month: MONTH, roomsOnSale: 4, rate: 6000 }]),
    );

    const rows = await inventoryRows();
    expect(rows.every((row) => monthKey(row.date) === MONTH)).toBe(true);
  });
});
