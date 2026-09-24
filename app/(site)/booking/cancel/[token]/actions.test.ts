import { randomBytes } from 'node:crypto';
import { addDays, todayInIndia } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelFromLink } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => (name === 'x-real-ip' ? '198.51.100.7' : null) }),
}));
vi.mock('@/lib/mail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/mail')>()),
  sendMail: vi.fn(async () => undefined),
}));

const GUEST_DOMAIN = 'vitest-cancel-link.invalid';

async function makeBooking(
  overrides: Partial<Parameters<typeof prisma.booking.create>[0]['data']> = {},
) {
  const suffix = randomBytes(6).toString('hex');
  return prisma.booking.create({
    data: {
      reference: `CANCEL-${suffix}`,
      viewToken: `view-${suffix}`,
      cancelToken: `cancel-${suffix}`,
      hotelSlug: 'gangtok',
      roomName: 'Deluxe Room',
      checkIn: addDays(todayInIndia(), 30),
      checkOut: addDays(todayInIndia(), 32),
      rooms: 1,
      adults: 2,
      guestName: 'Link Guest',
      guestEmail: `guest-${suffix}@${GUEST_DOMAIN}`,
      guestPhone: '+91 98300 00000',
      billingAddress: 'Somewhere',
      roomTotal: 10000,
      taxTotal: 500,
      total: 10500,
      status: 'CONFIRMED',
      rateType: 'REFUNDABLE',
      cancellationDeadline: addDays(todayInIndia(), 25),
      ...overrides,
    },
  });
}

const form = (token: string) => {
  const data = new FormData();
  data.set('token', token);
  return data;
};

beforeEach(() => vi.clearAllMocks());

afterEach(async () => {
  await prisma.auditEvent.deleteMany({ where: { actorLabel: 'Guest (via email link)' } });
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: GUEST_DOMAIN } } });
});

describe('cancelFromLink', () => {
  it('cancels, owes a refund, and records the guest as the actor', async () => {
    const booking = await makeBooking();

    const result = await cancelFromLink({ status: 'idle' }, form(booking.cancelToken as string));
    expect(result.status).toBe('success');
    expect(result.message).toMatch(/refunded/i);

    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    // REFUND_DUE is the cancelled-and-money-owed state: it holds no rooms and
    // it is what puts the booking in front of somebody on Payments.
    expect(after.status).toBe('REFUND_DUE');
    expect(after.cancelledAt).not.toBeNull();

    const event = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: booking.id, action: 'booking.cancelled_by_guest' },
    });
    expect(event.actorLabel).toBe('Guest (via email link)');
    expect(event.actorUserId).toBeNull();
  });

  it('spends the link, so the same URL cannot cancel twice', async () => {
    const booking = await makeBooking();
    const token = booking.cancelToken as string;

    await cancelFromLink({ status: 'idle' }, form(token));
    const second = await cancelFromLink({ status: 'idle' }, form(token));

    expect(second.status).toBe('error');
    expect(second.message).toMatch(/already been used/i);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.cancelToken).toBeNull();
  });

  it('cancels a non-refundable booking without promising money back', async () => {
    const booking = await makeBooking({
      rateType: 'NON_REFUNDABLE',
      cancellationDeadline: null,
    });

    const result = await cancelFromLink({ status: 'idle' }, form(booking.cancelToken as string));
    expect(result.status).toBe('success');
    expect(result.message).not.toMatch(/refunded to your original/i);

    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe('CANCELLED');
  });

  // The link expires at check-in, and that is checked again here rather than
  // trusted from the page that drew the button.
  it('refuses once the stay has started', async () => {
    const booking = await makeBooking({
      checkIn: todayInIndia(),
      checkOut: addDays(todayInIndia(), 2),
    });

    const result = await cancelFromLink({ status: 'idle' }, form(booking.cancelToken as string));
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/stay has started/i);

    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe('CONFIRMED');
  });

  it('says nothing useful to a token that was never issued', async () => {
    const result = await cancelFromLink({ status: 'idle' }, form('not-a-real-token'));
    expect(result.status).toBe('error');
  });
});
