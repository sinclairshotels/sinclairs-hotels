import { addDays, dateKey, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
const CHECK_IN = addDays(todayUtc(), 300);
const CHECK_OUT = addDays(CHECK_IN, 2);
const RATE_WINDOW = { gte: addDays(todayUtc(), 290), lt: addDays(todayUtc(), 320) };

async function loadRates(totalRooms: number, rate = 4000) {
  for (let i = 0; i < 2; i++) {
    const date = addDays(CHECK_IN, i);
    await prisma.roomRate.upsert({
      where: { hotelSlug_roomName_date: { hotelSlug: HOTEL, roomName: ROOM, date } },
      update: { rate, totalRooms, closed: false },
      create: { hotelSlug: HOTEL, roomName: ROOM, date, rate, totalRooms, closed: false },
    });
  }
}

function bookingFormData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    hotelSlug: HOTEL,
    roomName: ROOM,
    checkIn: dateKey(CHECK_IN),
    checkOut: dateKey(CHECK_OUT),
    rooms: '1',
    adults: '2',
    children: '0',
    guestName: 'Test Guest',
    guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
    guestPhone: '+91 98300 00000',
    billingAddress: '12 Camac Street, Kolkata',
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
  await prisma.roomRate.deleteMany({ where: { hotelSlug: HOTEL, date: RATE_WINDOW } });
}

beforeEach(async () => {
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
    expect(booking?.taxTotal.toNumber()).toBe(1440);
    expect(booking?.total.toNumber()).toBe(9440);
    expect(booking?.reference).toMatch(/^SNC-/);
    // The payment carries the same amount and points back at the booking.
    expect(booking?.payment?.amount.toNumber()).toBe(9440);
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
    expect(booking?.total.toNumber()).toBe(9440);
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
        checkIn: dateKey(addDays(todayUtc(), -3)),
        checkOut: dateKey(addDays(todayUtc(), -1)),
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
