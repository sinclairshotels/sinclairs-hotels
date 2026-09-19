import { HOLD_MINUTES, addDays, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { hashV1 } from '@/lib/icici';
import { sendMail } from '@/lib/mail';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type LoadedRoom,
  clearNights,
  findRoom,
  loadNights,
} from '../../../../test-utils/inventory';
import { POST } from './route';

vi.mock('@/lib/mail', () => ({
  sendMail: vi.fn(),
  STAFF_NOTIFY_EMAIL: 'staff@example.com',
}));

// The route verifies ICICI's signature, so these tests sign their payloads
// with the same helper the gateway's own responses are checked against —
// a hand-written hash would only prove the test can copy a constant.
const HMAC_KEY = 'callback-test-hmac-key';
const originalHmacKey = process.env.ICICI_HMAC_KEY;

const HOTEL = 'gangtok';
const ROOM = 'Deluxe Room';
const TEST_EMAIL_DOMAIN = 'vitest-callback-test.invalid';
const CHECK_IN = addDays(todayUtc(), 250);
const CHECK_OUT = addDays(CHECK_IN, 2);
const RATE_WINDOW = { gte: addDays(todayUtc(), 240), lt: addDays(todayUtc(), 270) };

let orderCounter = 0;

let room: LoadedRoom;

async function loadRates(roomsOnSale: number) {
  await loadNights(room, HOTEL, [CHECK_IN, addDays(CHECK_IN, 1)], { rate: 5000, roomsOnSale });
}

async function createPendingBooking({
  createdAt,
  rooms = 1,
}: { createdAt?: Date; rooms?: number } = {}) {
  const suffix = `${Date.now()}-${orderCounter++}`;
  const payment = await prisma.payment.create({
    data: {
      orderId: `CBTEST${suffix}`,
      hotelSlug: HOTEL,
      amount: 11800,
      guestName: 'Test Guest',
      guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
    },
  });

  const booking = await prisma.booking.create({
    data: {
      reference: `SNC-CB-${suffix}`,
      viewToken: `cbtoken-${suffix}`,
      hotelSlug: HOTEL,
      roomTypeId: room.roomTypeId,
      ratePlanId: room.ratePlanId,
      roomName: room.roomName,
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      rooms,
      adults: 2,
      guestName: 'Test Guest',
      guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: '12 Camac Street',
      roomTotal: 10000,
      taxTotal: 1800,
      total: 11800,
      paymentId: payment.id,
      ...(createdAt ? { createdAt } : {}),
    },
  });

  return { booking, payment };
}

// A rival booking that has already taken the room, as a separate guest would.
async function createCompetingBooking(rooms: number) {
  const suffix = `rival-${Date.now()}-${orderCounter++}`;
  return prisma.booking.create({
    data: {
      reference: `SNC-RIVAL-${suffix}`,
      viewToken: `rivaltoken-${suffix}`,
      hotelSlug: HOTEL,
      roomTypeId: room.roomTypeId,
      ratePlanId: room.ratePlanId,
      roomName: room.roomName,
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      rooms,
      adults: 2,
      guestName: 'Rival Guest',
      guestEmail: `rival@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00001',
      billingAddress: 'Elsewhere',
      roomTotal: 10000,
      taxTotal: 1800,
      total: 11800,
      status: 'CONFIRMED',
    },
  });
}

async function postCallback(orderId: string, overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    responseCode: '000',
    respDescription: 'Success',
    merchantId: 'TESTMERCHANT',
    merchantTxnNo: orderId,
    amount: '11800.00',
    txnID: 'TXN123',
    paymentID: 'PAY123',
    paymentMode: 'UPI',
    ...overrides,
  };

  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  body.append('secureHash', overrides.secureHash ?? hashV1(fields, HMAC_KEY));

  return POST(
    new Request('http://localhost:3000/api/ipay/callback', {
      method: 'POST',
      body,
      headers: { host: 'localhost:3000' },
    }),
  );
}

const expiredHold = () => new Date(Date.now() - (HOLD_MINUTES + 5) * 60_000);

async function cleanup() {
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await prisma.payment.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await clearNights(HOTEL, RATE_WINDOW);
}

beforeAll(() => {
  process.env.ICICI_HMAC_KEY = HMAC_KEY;
});

beforeEach(async () => {
  room = await findRoom(HOTEL, ROOM);
  vi.mocked(sendMail).mockClear();
  await cleanup();
});

afterAll(async () => {
  process.env.ICICI_HMAC_KEY = originalHmacKey;
  await cleanup();
  await prisma.$disconnect();
});

const mailKinds = () => vi.mocked(sendMail).mock.calls.map(([args]) => args.kind);

describe('i-Pay callback settling a booking', () => {
  it('confirms a booking whose hold has not expired', async () => {
    await loadRates(1);
    const { booking, payment } = await createPendingBooking();

    const response = await postCallback(payment.orderId);

    expect(response.headers.get('location')).toBe(
      `http://localhost:3000/booking/${booking.viewToken}`,
    );
    const settled = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(settled?.status).toBe('CONFIRMED');
    expect(mailKinds()).toEqual(['booking-guest', 'booking-hotel']);
  });

  it('confirms an expired hold when the room is still there — its own hold must not block it', async () => {
    // One room, and this booking is the only claim on it. If the re-check
    // counted the booking itself, this would wrongly come back oversold.
    await loadRates(1);
    const { booking, payment } = await createPendingBooking({ createdAt: expiredHold() });

    await postCallback(payment.orderId);

    const settled = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(settled?.status).toBe('CONFIRMED');
    expect(mailKinds()).toEqual(['booking-guest', 'booking-hotel']);
  });

  it('marks an expired hold for refund when the room was taken, instead of confirming', async () => {
    await loadRates(1);
    const { booking, payment } = await createPendingBooking({ createdAt: expiredHold() });
    await createCompetingBooking(1);

    const response = await postCallback(payment.orderId);

    const settled = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(settled?.status).toBe('REFUND_DUE');
    // Never silently: the guest is told, and staff get a task.
    expect(mailKinds()).toEqual(['booking-oversold-guest', 'booking-oversold-staff']);
    // The payment itself still succeeded — the money really was taken.
    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))?.status).toBe(
      'SUCCESS',
    );
    expect(response.headers.get('location')).toBe(
      `http://localhost:3000/booking/${booking.viewToken}`,
    );
  });

  it('marks for refund when only some of the rooms are left', async () => {
    await loadRates(3);
    const { booking, payment } = await createPendingBooking({
      createdAt: expiredHold(),
      rooms: 2,
    });
    await createCompetingBooking(2);

    await postCallback(payment.orderId);

    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe(
      'REFUND_DUE',
    );
  });

  it('marks for refund when the rate rows were withdrawn entirely', async () => {
    const { booking, payment } = await createPendingBooking({ createdAt: expiredHold() });

    await postCallback(payment.orderId);

    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe(
      'REFUND_DUE',
    );
  });

  it('does not re-check a failed payment — it fails the booking either way', async () => {
    await loadRates(1);
    const { booking, payment } = await createPendingBooking({ createdAt: expiredHold() });
    await createCompetingBooking(1);

    await postCallback(payment.orderId, { responseCode: '999', respDescription: 'Declined' });

    const settled = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(settled?.status).toBe('PAYMENT_FAILED');
    expect(mailKinds()).toEqual([]);
  });

  it('confirms nothing on a forged signature', async () => {
    await loadRates(1);
    const { booking, payment } = await createPendingBooking();

    await postCallback(payment.orderId, { secureHash: 'deadbeef' });

    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe(
      'PENDING_PAYMENT',
    );
    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))?.status).toBe(
      'INITIATED',
    );
    expect(mailKinds()).toEqual([]);
  });

  it('fails closed when the gateway reports an amount this order was not for', async () => {
    await loadRates(1);
    const { booking, payment } = await createPendingBooking();

    await postCallback(payment.orderId, { amount: '1.00' });

    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe(
      'PAYMENT_FAILED',
    );
  });

  it('lets only one of two simultaneous late callbacks take the last room', async () => {
    // The case the Serializable transaction exists for. Both bookings have
    // expired holds, so each re-checks availability; each excludes itself, so
    // without serialization both would read "1 room free" from the same
    // snapshot and both would confirm — two guests, one room.
    await loadRates(1);
    const first = await createPendingBooking({ createdAt: expiredHold() });
    const second = await createPendingBooking({ createdAt: expiredHold() });

    await Promise.all([postCallback(first.payment.orderId), postCallback(second.payment.orderId)]);

    const settled = await prisma.booking.findMany({
      where: { id: { in: [first.booking.id, second.booking.id] } },
      select: { status: true },
    });

    expect(settled.map((b) => b.status).sort()).toEqual(['CONFIRMED', 'REFUND_DUE']);
  });

  it('holds the line across several simultaneous late callbacks', async () => {
    await loadRates(2);
    const bookings = await Promise.all(
      Array.from({ length: 4 }, () => createPendingBooking({ createdAt: expiredHold() })),
    );

    await Promise.all(bookings.map((b) => postCallback(b.payment.orderId)));

    const settled = await prisma.booking.findMany({
      where: { id: { in: bookings.map((b) => b.booking.id) } },
      select: { status: true },
    });

    // Two rooms, four paid guests: never more than two confirmations, and
    // everyone else is owed a refund rather than left pending.
    const confirmed = settled.filter((b) => b.status === 'CONFIRMED').length;
    expect(confirmed).toBeLessThanOrEqual(2);
    expect(settled.filter((b) => b.status === 'REFUND_DUE').length).toBe(4 - confirmed);
  });

  it('is idempotent — a replayed callback neither re-mails nor changes state', async () => {
    await loadRates(1);
    const { booking, payment } = await createPendingBooking();

    await postCallback(payment.orderId);
    vi.mocked(sendMail).mockClear();
    const replay = await postCallback(payment.orderId);

    expect((await prisma.booking.findUnique({ where: { id: booking.id } }))?.status).toBe(
      'CONFIRMED',
    );
    expect(mailKinds()).toEqual([]);
    // A guest pressing back still lands on their booking, not the generic receipt.
    expect(replay.headers.get('location')).toBe(
      `http://localhost:3000/booking/${booking.viewToken}`,
    );
  });
});
