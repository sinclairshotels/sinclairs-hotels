import { prisma } from '@/lib/db';
import { sendMail } from '@/lib/mail';
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
    billingAddress: '123 Example Street, Kolkata',
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
});
