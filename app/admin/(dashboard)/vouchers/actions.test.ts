import { prisma } from '@/lib/db';
import { sendMail } from '@/lib/mail';
import { voucherGuestFields } from '@/lib/voucher-view';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestStaff, createTestStaff } from '../../../../test-utils/auth';
import { createVoucher } from './actions';

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'actions-test-default',
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

vi.mock('@/lib/mail', () => ({
  sendMail: vi.fn(),
  STAFF_NOTIFY_EMAIL: 'staff@example.com',
  VOUCHER_OFFICE_EMAIL: 'office@example.com',
}));

// A distinctive, non-routable guest email so cleanup can safely target only
// rows this file created, never real data.
const TEST_EMAIL_DOMAIN = 'vitest-voucher-test.invalid';

function voucherFormData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    hotelSlug: 'burdwan',
    guestName: 'Jane Doe',
    guestPhone: '+91 9876543210',
    guestEmail: `jane@${TEST_EMAIL_DOMAIN}`,
    addressLine1: '123 Example Street',
    addressLine2: '',
    city: 'Kolkata',
    state: 'West Bengal',
    pin: '700017',
    country: 'India',
    rooms: '2',
    checkIn: '2026-01-10',
    checkOut: '2026-01-12',
    rate: '4500',
    taxes: '540',
    issuerName: 'Front Desk',
    issuerPhone: '+91 9123456789',
    bookingOffice: 'Sinclairs Hotels — Head Office',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('createVoucher', () => {
  beforeAll(() => {});

  beforeEach(() => {
    mockState.cookieValue = undefined;
    mockState.ip = `actions-test-${Math.random()}`;
    vi.mocked(sendMail).mockClear();
  });

  afterAll(async () => {
    await prisma.voucher.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  });

  it('rejects an unauthenticated request without creating a row', async () => {
    const before = await prisma.voucher.count();

    const result = await createVoucher(
      { status: 'idle' },
      voucherFormData({ guestEmail: `unauth@${TEST_EMAIL_DOMAIN}` }),
    );

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/session has ended/i);
    expect(await prisma.voucher.count()).toBe(before);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects invalid input with field errors and does not create a row', async () => {
    mockState.cookieValue = (
      await createTestStaff({ role: 'USER', sections: { vouchers: 'EDIT' } })
    ).token;
    const before = await prisma.voucher.count();

    const result = await createVoucher(
      { status: 'idle' },
      voucherFormData({ hotelSlug: '', guestEmail: `invalid@${TEST_EMAIL_DOMAIN}` }),
    );

    expect(result.status).toBe('error');
    expect(result.fieldErrors?.hotelSlug).toBeTruthy();
    expect(await prisma.voucher.count()).toBe(before);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('creates a voucher row and emails the guest and office copies', async () => {
    mockState.cookieValue = (
      await createTestStaff({ role: 'USER', sections: { vouchers: 'EDIT' } })
    ).token;
    const guestEmail = `created-${Math.random()}@${TEST_EMAIL_DOMAIN}`;

    const result = await createVoucher({ status: 'idle' }, voucherFormData({ guestEmail }));

    expect(result.status).toBe('success');
    expect(result.voucherNo).toBeTypeOf('number');

    const voucher = await prisma.voucher.findUnique({ where: { voucherNo: result.voucherNo } });
    expect(voucher).not.toBeNull();
    expect(voucher?.guestName).toBe('Jane Doe');
    expect(voucher?.hotelSlug).toBe('burdwan');
    expect(voucher?.rooms).toBe(2);
    expect(voucher?.viewToken).toHaveLength(43); // base64url of 32 random bytes

    expect(sendMail).toHaveBeenCalledTimes(2);
    const guestSend = vi.mocked(sendMail).mock.calls.find((call) => call[0].to === guestEmail);
    expect(guestSend?.[0].subject).toContain(String(result.voucherNo));
  });

  it('rate-limits repeated submissions from the same IP', async () => {
    mockState.cookieValue = (
      await createTestStaff({ role: 'USER', sections: { vouchers: 'EDIT' } })
    ).token;
    mockState.ip = `actions-test-rate-limit-${Math.random()}`;

    const attempts = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        createVoucher(
          { status: 'idle' },
          voucherFormData({ guestEmail: `rl-${i}-${Math.random()}@${TEST_EMAIL_DOMAIN}` }),
        ),
      ),
    );

    const rateLimited = attempts.filter(
      (r) => r.status === 'error' && /too many/i.test(r.message ?? ''),
    );
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  // "Sinclairs Yangang" is a property the group no longer sells, carried
  // verbatim on the vouchers imported from the legacy site. It must stay
  // readable and filterable, and must never be written again.
  describe('a property that is no longer sold', () => {
    it('refuses a new voucher for it', async () => {
      mockState.cookieValue = (
        await createTestStaff({ role: 'USER', sections: { vouchers: 'EDIT' } })
      ).token;
      const result = await createVoucher(
        { status: 'idle' },
        voucherFormData({ hotelSlug: 'Sinclairs Yangang' }),
      );

      expect(result.status).toBe('error');
      expect(result.fieldErrors?.hotelSlug).toBeDefined();
      const written = await prisma.voucher.count({ where: { hotelSlug: 'Sinclairs Yangang' } });
      expect(written).toBe(0);
    });

    it('still lists and filters the ones already written', async () => {
      const existing = await prisma.voucher.create({
        data: {
          viewToken: `yangang-${Math.random().toString(36).slice(2, 10)}`,
          hotelSlug: 'Sinclairs Yangang',
          guestName: 'Legacy Guest',
          guestPhone: '+91 98300 00000',
          guestEmail: `legacy@${TEST_EMAIL_DOMAIN}`,
          billingAddress: 'Somewhere',
          rooms: 1,
          checkIn: new Date('2019-05-01T00:00:00.000Z'),
          checkOut: new Date('2019-05-03T00:00:00.000Z'),
          rate: 4000,
          taxes: 400,
          issuerName: 'Legacy Issuer',
          issuerPhone: '+91 98300 00000',
          bookingOffice: 'Kolkata',
        },
      });

      const grouped = await prisma.voucher.groupBy({ by: ['hotelSlug'], _count: true });
      expect(grouped.map((row) => row.hotelSlug)).toContain('Sinclairs Yangang');

      await prisma.voucher.delete({ where: { id: existing.id } });
    });
  });

  describe('the fields reservations asked for', () => {
    it('stores the room category and meal plan, and prints both on the voucher', async () => {
      mockState.cookieValue = (
        await createTestStaff({ role: 'USER', sections: { vouchers: 'EDIT' } })
      ).token;
      const result = await createVoucher(
        { status: 'idle' },
        voucherFormData({
          roomCategory: 'Premier Room',
          mealPlan: 'With Breakfast (CP)',
          depositAmount: '5000',
          depositReceiptDate: '2026-10-01',
          billingInstructions: 'Room and taxes to company; extras to guest.',
        }),
      );
      expect(result.status).toBe('success');

      const voucher = await prisma.voucher.findFirstOrThrow({
        where: { voucherNo: result.voucherNo },
      });
      expect(voucher.roomCategory).toBe('Premier Room');
      expect(voucher.mealPlan).toBe('With Breakfast (CP)');

      // The guest's own copy, which is what prints.
      const labels = voucherGuestFields(voucher).map(([label]) => label);
      expect(labels).toContain('Room Category');
      expect(labels).toContain('Meal Plan');
      expect(labels).toContain('Advance Paid');
      expect(labels).toContain('Advance Paid On');
      expect(labels).toContain('Billing Instructions');
    });
  });
});
