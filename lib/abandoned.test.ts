import {
  ABANDONED_AFTER_MINUTES,
  abandonedBookings,
  markAbandonedEmailSent,
} from '@/lib/abandoned';
import { HOLD_MINUTES, addDays, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const TEST_EMAIL_DOMAIN = 'vitest-abandoned.invalid';
const MINUTE = 60_000;

async function booking({
  minutesAgo,
  status = 'PENDING_PAYMENT',
  emailSent = false,
}: {
  minutesAgo: number;
  status?: 'PENDING_PAYMENT' | 'CONFIRMED' | 'PAYMENT_FAILED';
  emailSent?: boolean;
}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  const today = todayUtc();
  return prisma.booking.create({
    data: {
      reference: `AB-${suffix}`,
      viewToken: `ab-${suffix}`,
      hotelSlug: 'gangtok',
      roomName: 'Deluxe Room',
      checkIn: addDays(today, 10),
      checkOut: addDays(today, 12),
      rooms: 1,
      adults: 2,
      guestName: 'Abandoned Guest',
      guestEmail: `guest-${suffix}@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: 'Somewhere',
      roomTotal: 5000,
      taxTotal: 250,
      total: 5250,
      status,
      createdAt: new Date(Date.now() - minutesAgo * MINUTE),
      ...(emailSent ? { abandonedEmailSentAt: new Date() } : {}),
    },
  });
}

const mine = (list: { reference: string }[]) => list.filter((b) => b.reference.startsWith('AB-'));

async function clear() {
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
}

// An hour after the hold let go — so the window opens at HOLD_MINUTES + 60.
const DUE = HOLD_MINUTES + ABANDONED_AFTER_MINUTES + 5;
const NOT_YET = HOLD_MINUTES + ABANDONED_AFTER_MINUTES - 5;

describe('abandonedBookings', () => {
  beforeEach(clear);
  afterAll(async () => {
    await clear();
    await prisma.$disconnect();
  });

  it('finds an unpaid booking an hour after its hold let go', async () => {
    await booking({ minutesAgo: DUE });
    expect(mine(await abandonedBookings())).toHaveLength(1);
  });

  it('leaves a guest who may still be on the bank’s page alone', async () => {
    await booking({ minutesAgo: NOT_YET });
    expect(mine(await abandonedBookings())).toHaveLength(0);
  });

  it('ignores a booking that was paid, or failed outright', async () => {
    await booking({ minutesAgo: DUE, status: 'CONFIRMED' });
    await booking({ minutesAgo: DUE, status: 'PAYMENT_FAILED' });
    expect(mine(await abandonedBookings())).toHaveLength(0);
  });

  it('never picks up a booking that has already been written to', async () => {
    await booking({ minutesAgo: DUE, emailSent: true });
    expect(mine(await abandonedBookings())).toHaveLength(0);
  });

  it('leaves history alone, so switching the cron on does not email everyone', async () => {
    await booking({ minutesAgo: 60 * 24 * 30 });
    expect(mine(await abandonedBookings())).toHaveLength(0);
  });

  it('claims a row once — a second run cannot send a second email', async () => {
    const row = await booking({ minutesAgo: DUE });

    expect(await markAbandonedEmailSent(row.id)).toBe(true);
    expect(await markAbandonedEmailSent(row.id)).toBe(false);
    expect(mine(await abandonedBookings())).toHaveLength(0);
  });
});
