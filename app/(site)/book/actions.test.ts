import { addDays, dateKey, todayInIndia } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { type LoadedRoom, clearNights, findRoom, loadNights } from '../../../test-utils/inventory';
import { createBooking } from './actions';

const mockState = vi.hoisted(() => ({
  ip: 'booking-actions-test',
  sale: { ok: true, redirectUrl: 'https://gateway.example/pay' } as
    | { ok: true; redirectUrl: string }
    | { ok: false; reason: string; message: string; detail?: string },
  configured: true,
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name === 'x-real-ip' ? mockState.ip : null) }),
}));

// redirect() throws a control-flow error in real Next; a plain throw with a
// recognisable shape lets the test assert the redirect happened.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock('@/lib/ipay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ipay')>();
  return {
    ...actual,
    ipayConfigured: () => mockState.configured,
    startSale: async () => mockState.sale,
  };
});

const HOTEL = 'gangtok';
const ROOM = 'Deluxe Room';
const TEST_EMAIL_DOMAIN = 'vitest-booking-action.invalid';

// Far enough out that these rows can never collide with real data, and
// cleanup can safely target the whole window.
const CHECK_IN = addDays(todayInIndia(), 300);
const CHECK_OUT = addDays(CHECK_IN, 2);
const RATE_WINDOW = { gte: addDays(todayInIndia(), 290), lt: addDays(todayInIndia(), 320) };

let room: LoadedRoom;

async function loadRates(roomsOnSale: number, rate = 4000) {
  await loadNights(room, HOTEL, [CHECK_IN, addDays(CHECK_IN, 1)], { rate, roomsOnSale });
}

function bookingFormData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    hotelSlug: HOTEL,
    roomTypeId: room.roomTypeId,
    ratePlanId: room.ratePlanId,
    checkIn: dateKey(CHECK_IN),
    checkOut: dateKey(CHECK_OUT),
    rooms: '1',
    adults: '2',
    children: '0',
    guestName: 'Test Guest',
    guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
    guestPhone: '+91 98300 00000',
    addressLine1: '12 Camac Street',
    addressLine2: '',
    city: 'Kolkata',
    state: 'West Bengal',
    pin: '700017',
    country: 'India',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

// The action redirects on success, which the mock above turns into a throw.
async function submit(formData: FormData) {
  try {
    return { state: await createBooking({ status: 'idle' }, formData), redirectedTo: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.startsWith('REDIRECT:')) {
      return { state: null, redirectedTo: message.slice('REDIRECT:'.length) };
    }
    throw err;
  }
}

async function cleanup() {
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await prisma.payment.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await clearNights(HOTEL, RATE_WINDOW);
  await prisma.nonRefundableWindow.deleteMany({ where: { hotelSlug: HOTEL } });
  await prisma.hotelSettings.update({
    where: { hotelSlug: HOTEL },
    data: { refundableUpliftPct: null, freeCancellationDays: null },
  });
}

beforeEach(async () => {
  room = await findRoom(HOTEL, ROOM);
  mockState.ip = `booking-${Math.random()}`;
  mockState.sale = { ok: true, redirectUrl: 'https://gateway.example/pay' };
  mockState.configured = true;
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('createBooking', () => {
  // The form posts a rateType, and the transaction re-prices from the
  // property's own settings rather than trusting it. On dates sold as
  // non-refundable only there is no refundable offer to find, so a submission
  // asking for one is refused rather than written at the non-refundable price
  // with refundable terms attached.
  it('refuses a refundable booking on dates sold as non-refundable only', async () => {
    await loadRates(3, 4000);
    await prisma.hotelSettings.update({
      where: { hotelSlug: HOTEL },
      data: { refundableUpliftPct: 15, freeCancellationDays: 2 },
    });

    const refundableFirst = await submit(bookingFormData({ rateType: 'REFUNDABLE' }));
    expect(refundableFirst.redirectedTo).toBeTruthy();
    await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
    await prisma.payment.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });

    await prisma.nonRefundableWindow.create({
      data: { hotelSlug: HOTEL, startDate: CHECK_IN, endDate: CHECK_IN, label: 'Peak season' },
    });

    const { state } = await submit(bookingFormData({ rateType: 'REFUNDABLE' }));
    expect(state?.status).toBe('error');
    expect(await prisma.booking.count({ where: { hotelSlug: HOTEL, checkIn: CHECK_IN } })).toBe(0);

    // The non-refundable rate is still on sale for the same dates.
    const { redirectedTo } = await submit(bookingFormData({ rateType: 'NON_REFUNDABLE' }));
    expect(redirectedTo).toBeTruthy();
  });

  it('creates a held booking priced from the rate rows and sends the guest to the gateway', async () => {
    await loadRates(3, 4000);

    const { state, redirectedTo } = await submit(bookingFormData());

    expect(state).toBeNull();
    expect(redirectedTo).toBe('https://gateway.example/pay');

    const booking = await prisma.booking.findFirst({
      where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } },
      include: { payment: true },
    });

    expect(booking?.status).toBe('PENDING_PAYMENT');
    expect(booking?.roomTotal.toNumber()).toBe(8000);
    expect(booking?.taxTotal.toNumber()).toBe(400);
    expect(booking?.total.toNumber()).toBe(8400);
    expect(booking?.reference).toMatch(/^SNC-/);
    // Snapshots of what was sold, so the booking still reads correctly after
    // the plan is renamed.
    expect(booking?.planName).toBe('Room Only');
    expect(booking?.breakfastGuests).toBe(0);
    // The payment carries the same amount and points back at the booking.
    expect(booking?.payment?.amount.toNumber()).toBe(8400);
    expect(booking?.payment?.status).toBe('INITIATED');
    expect(booking?.payment?.reservationNo).toBe(booking?.reference);
  });

  it('prices from the database, never from anything the form could carry', async () => {
    await loadRates(3, 4000);

    // A tampered submission adding its own totals must not change the price.
    const { redirectedTo } = await submit(
      bookingFormData({ roomTotal: '1', taxTotal: '0', total: '1', rate: '1' }),
    );

    expect(redirectedTo).not.toBeNull();
    const booking = await prisma.booking.findFirst({
      where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } },
    });
    expect(booking?.total.toNumber()).toBe(8400);
  });

  it('refuses to oversell the last room', async () => {
    await loadRates(1);
    await submit(bookingFormData());

    const { state } = await submit(bookingFormData({ guestName: 'Second Guest' }));

    expect(state?.status).toBe('error');
    expect(state?.message).toMatch(/taken while you were booking/i);
    expect(
      await prisma.booking.count({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } }),
    ).toBe(1);
  });

  it('refuses a room with no rates loaded', async () => {
    const { state } = await submit(bookingFormData());
    expect(state?.status).toBe('error');
    expect(state?.message).toMatch(/taken while you were booking/i);
  });

  it('rejects a stay in the past even though the dates arrive in a hidden field', async () => {
    await loadRates(3);
    const { state } = await submit(
      bookingFormData({
        checkIn: dateKey(addDays(todayInIndia(), -3)),
        checkOut: dateKey(addDays(todayInIndia(), -1)),
      }),
    );
    expect(state?.status).toBe('error');
    expect(state?.message).toMatch(/valid check-in and check-out/i);
  });

  it('rejects a check-out that is not after check-in', async () => {
    await loadRates(3);
    const { state } = await submit(bookingFormData({ checkOut: dateKey(CHECK_IN) }));
    expect(state?.status).toBe('error');
  });

  it('rejects more guests than the rooms can hold', async () => {
    await loadRates(3);
    const { state } = await submit(bookingFormData({ rooms: '1', adults: '5', children: '4' }));
    expect(state?.status).toBe('error');
    expect(state?.message).toMatch(/more rooms/i);
  });

  it('rejects an invalid email without writing anything', async () => {
    await loadRates(3);
    const { state } = await submit(bookingFormData({ guestEmail: 'not-an-email' }));
    expect(state?.status).toBe('error');
    expect(state?.fieldErrors?.guestEmail?.[0]).toBeTruthy();
    expect(await prisma.booking.count({ where: { hotelSlug: HOTEL, checkIn: CHECK_IN } })).toBe(0);
  });

  it('silently drops a bot submission that fills the honeypot', async () => {
    await loadRates(3);
    const { state } = await submit(bookingFormData({ company: 'spam-bot' }));
    expect(state?.status).toBe('error');
    expect(await prisma.booking.count({ where: { hotelSlug: HOTEL, checkIn: CHECK_IN } })).toBe(0);
  });

  it('closes the booking and releases its rooms when the gateway will not open a sale', async () => {
    await loadRates(1);
    mockState.sale = { ok: false, reason: 'rejected', message: 'Declined.', detail: 'NO' };

    const { state } = await submit(bookingFormData());

    expect(state?.status).toBe('error');
    const booking = await prisma.booking.findFirst({
      where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } },
      include: { payment: true },
    });
    expect(booking?.status).toBe('PAYMENT_FAILED');
    expect(booking?.payment?.status).toBe('FAILURE');

    // Released immediately, so the next guest can have the room.
    const { redirectedTo } = await submit(bookingFormData({ guestName: 'Next Guest' }));
    expect(redirectedTo).toBeNull();
  });

  it('hands back what the guest typed, so a refused booking is not retyped', async () => {
    await loadRates(3);
    mockState.configured = false;

    const { state } = await submit(
      bookingFormData({
        guestName: 'Retyping Is Rude',
        guestPhone: '+91 90000 11111',
        addressLine1: '12 Test Lane',
        city: 'Kolkata',
        specialRequests: 'A quiet floor, please.',
      }),
    );

    expect(state?.status).toBe('error');
    expect(state?.values).toMatchObject({
      guestName: 'Retyping Is Rude',
      guestPhone: '+91 90000 11111',
      addressLine1: '12 Test Lane',
      city: 'Kolkata',
      specialRequests: 'A quiet floor, please.',
    });
  });

  it('hands the values back on a rejected field too, alongside the field errors', async () => {
    await loadRates(3);

    const { state } = await submit(
      bookingFormData({ guestEmail: 'not-an-email', guestName: 'Still Here' }),
    );

    expect(state?.fieldErrors?.guestEmail).toBeDefined();
    expect(state?.values?.guestName).toBe('Still Here');
    expect(state?.values?.guestEmail).toBe('not-an-email');
  });

  it('writes nothing when the gateway is not configured', async () => {
    await loadRates(3);
    mockState.configured = false;

    const { state } = await submit(bookingFormData());

    expect(state?.status).toBe('error');
    expect(state?.message).toMatch(/temporarily unavailable/i);
    expect(await prisma.booking.count({ where: { hotelSlug: HOTEL, checkIn: CHECK_IN } })).toBe(0);
    expect(
      await prisma.payment.count({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } }),
    ).toBe(0);
  });

  it('rate-limits a flood of submissions from one address', async () => {
    await loadRates(20);
    mockState.ip = 'flooding-client';

    const results = [];
    for (let i = 0; i < 8; i++) {
      results.push(await submit(bookingFormData({ guestName: `Guest ${i}` })));
    }

    expect(results.some((r) => r.state?.message?.match(/too many requests/i))).toBe(true);
  });
});
