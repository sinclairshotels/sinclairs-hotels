import { availability } from '@/lib/availability';
import { addDays, eachNight, todayInIndia } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestStaff, createTestStaff } from '../../../../test-utils/auth';
import { type LoadedRoom, findRoom, loadNights } from '../../../../test-utils/inventory';
import { saveHotelSetup } from './room-actions';

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'room-actions-test',
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
let staffUser: Awaited<ReturnType<typeof createTestStaff>>;

function setupForm(fields: Record<string, string>): FormData {
  const data = new FormData();
  data.append('hotelSlug', HOTEL);
  // The two age fields are always on the form, so a test that is not about
  // them still has to post them — as the browser would.
  const withAges = { childFreeUnder: '5', childMaxAge: '12', ...fields };
  for (const [key, value] of Object.entries(withAges)) data.append(key, value);
  return data;
}

beforeEach(async () => {
  staffUser = await createTestStaff({ role: 'USER', sections: { rates: 'EDIT' } });
  mockState.cookieValue = staffUser.token;
});

afterAll(async () => {
  await cleanupTestStaff();
});

describe('saveHotelSetup', () => {
  it('stores a changed breakfast supplement', async () => {
    await saveHotelSetup(
      { status: 'idle' },
      setupForm({ breakfastSupplement: '450', refundableUpliftPct: '', freeCancellationDays: '' }),
    );
    const first = await prisma.hotelSettings.findUnique({ where: { hotelSlug: HOTEL } });
    expect(first?.breakfastSupplement.toNumber()).toBe(450);

    const result = await saveHotelSetup(
      { status: 'idle' },
      setupForm({ breakfastSupplement: '500', refundableUpliftPct: '', freeCancellationDays: '' }),
    );
    const second = await prisma.hotelSettings.findUnique({ where: { hotelSlug: HOTEL } });
    expect(result.status).toBe('success');
    expect(second?.breakfastSupplement.toNumber()).toBe(500);
  });

  it('keeps the refundable policy while only breakfast changes', async () => {
    await saveHotelSetup(
      { status: 'idle' },
      setupForm({
        breakfastSupplement: '450',
        refundableUpliftPct: '15',
        freeCancellationDays: '3',
      }),
    );
    const result = await saveHotelSetup(
      { status: 'idle' },
      setupForm({
        breakfastSupplement: '600',
        refundableUpliftPct: '15',
        freeCancellationDays: '3',
      }),
    );
    const row = await prisma.hotelSettings.findUnique({ where: { hotelSlug: HOTEL } });
    expect(result.status).toBe('success');
    expect(row?.breakfastSupplement.toNumber()).toBe(600);
    expect(row?.refundableUpliftPct?.toNumber()).toBe(15);
  });
});

// The reported symptom: a supplement changed on Set-up that the rest of the
// screen — and the booking engine — carries on quoting at the old figure.
describe('a changed supplement reaches what is quoted', () => {
  const checkIn = addDays(todayInIndia(), 210);
  const checkOut = addDays(checkIn, 1);
  let room: LoadedRoom;

  const withBreakfast = async () => {
    const result = await availability(prisma, {
      hotelSlug: HOTEL,
      checkIn,
      checkOut,
      rooms: 1,
      adults: 2,
      children: 0,
    });
    return result.offers.find(
      (offer) => offer.ratePlanCode === 'CP' && offer.roomTypeId === room.roomTypeId,
    );
  };

  beforeEach(async () => {
    room = await findRoom(HOTEL, 'Garden Suite');
    await loadNights(room, HOTEL, eachNight(checkIn, addDays(checkOut, 1)), {
      rate: 5000,
      roomsOnSale: 3,
    });
  });

  it('prices With Breakfast from the supplement in force now', async () => {
    await saveHotelSetup(
      { status: 'idle' },
      setupForm({ breakfastSupplement: '450', refundableUpliftPct: '', freeCancellationDays: '' }),
    );
    expect((await withBreakfast())?.nightlyRates[0]).toBe(5000 + 450 * 2);

    await saveHotelSetup(
      { status: 'idle' },
      setupForm({ breakfastSupplement: '500', refundableUpliftPct: '', freeCancellationDays: '' }),
    );
    expect((await withBreakfast())?.nightlyRates[0]).toBe(5000 + 500 * 2);
  });

  it('stops offering With Breakfast when the supplement goes back to nothing', async () => {
    await saveHotelSetup(
      { status: 'idle' },
      setupForm({ breakfastSupplement: '450', refundableUpliftPct: '', freeCancellationDays: '' }),
    );
    expect(await withBreakfast()).toBeDefined();

    await saveHotelSetup(
      { status: 'idle' },
      setupForm({ breakfastSupplement: '0', refundableUpliftPct: '', freeCancellationDays: '' }),
    );
    expect(await withBreakfast()).toBeUndefined();
  });
});

// The reported bug, in one test: an uplift with no deadline is refused — which
// is right — but the refusal used to blame the breakfast supplement, so a
// property in that state could never save a supplement and was told the
// supplement was the problem.
describe('when the save is refused', () => {
  it('says what is actually wrong rather than blaming breakfast', async () => {
    const result = await saveHotelSetup(
      { status: 'idle' },
      setupForm({
        breakfastSupplement: '500',
        refundableUpliftPct: '15',
        freeCancellationDays: '',
      }),
    );

    expect(result.status).toBe('error');
    expect(result.message).toBe(
      'Set both the uplift and the free-cancellation days, or leave both blank.',
    );
    expect(result.message).not.toMatch(/breakfast/i);
  });

  it('saves the supplement once the policy is whole', async () => {
    await saveHotelSetup(
      { status: 'idle' },
      setupForm({
        breakfastSupplement: '500',
        refundableUpliftPct: '15',
        freeCancellationDays: '3',
      }),
    );
    const row = await prisma.hotelSettings.findUnique({ where: { hotelSlug: HOTEL } });
    expect(row?.breakfastSupplement.toNumber()).toBe(500);
  });
});

describe('child age brackets', () => {
  it('stores the property’s own ages', async () => {
    const result = await saveHotelSetup(
      { status: 'idle' },
      setupForm({
        breakfastSupplement: '450',
        refundableUpliftPct: '',
        freeCancellationDays: '',
        childFreeUnder: '3',
        childMaxAge: '10',
      }),
    );
    const row = await prisma.hotelSettings.findUnique({ where: { hotelSlug: HOTEL } });

    expect(result.status).toBe('success');
    expect(row?.childFreeUnder).toBe(3);
    expect(row?.childMaxAge).toBe(10);
  });

  it('refuses a band that ends before it begins', async () => {
    const result = await saveHotelSetup(
      { status: 'idle' },
      setupForm({
        breakfastSupplement: '450',
        refundableUpliftPct: '',
        freeCancellationDays: '',
        childFreeUnder: '12',
        childMaxAge: '5',
      }),
    );
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/child age band/i);
  });

  it('charges a child by the ages the property set, not the group defaults', async () => {
    const checkIn = addDays(todayInIndia(), 212);
    const checkOut = addDays(checkIn, 1);
    const room = await findRoom(HOTEL, 'Garden Suite');
    await loadNights(room, HOTEL, eachNight(checkIn, addDays(checkOut, 1)), {
      rate: 5000,
      roomsOnSale: 3,
    });
    await prisma.roomType.update({
      where: { id: room.roomTypeId },
      data: { baseOccupancy: 2, maxAdults: 3, maxChildren: 2, extraChildCharge: 800 },
    });

    const quoteFor = async (childAges: number[]) => {
      const result = await availability(prisma, {
        hotelSlug: HOTEL,
        checkIn,
        checkOut,
        rooms: 1,
        adults: 2,
        children: childAges.length,
        childAges,
      });
      return result.offers.find(
        (offer) => offer.ratePlanCode === 'EP' && offer.roomTypeId === room.roomTypeId,
      )?.quote.roomTotal;
    };

    await saveHotelSetup(
      { status: 'idle' },
      setupForm({
        breakfastSupplement: '0',
        refundableUpliftPct: '',
        freeCancellationDays: '',
        childFreeUnder: '5',
        childMaxAge: '12',
      }),
    );
    // Four is free here, six is not.
    expect(await quoteFor([4])).toBe(5000);
    expect(await quoteFor([6])).toBe(5800);

    await saveHotelSetup(
      { status: 'idle' },
      setupForm({
        breakfastSupplement: '0',
        refundableUpliftPct: '',
        freeCancellationDays: '',
        childFreeUnder: '3',
        childMaxAge: '12',
      }),
    );
    // Same four-year-old, now inside the charged band.
    expect(await quoteFor([4])).toBe(5800);
  });
});
