import { prisma } from '@/lib/db';
import { sendMail } from '@/lib/mail';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestStaff, createTestStaff } from '../../../../test-utils/auth';
import { refundPayment } from './actions';

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'refund-actions-test-default',
  refundResponse: null as unknown,
  refundShouldThrow: false,
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
}));

// Never hit the real ICICI sandbox from a test — the response shape is
// controlled per-test via mockState.refundResponse.
vi.mock('@/lib/icici', () => ({
  iciciConfig: () => ({
    merchantId: 'T_TEST',
    aggregatorID: 'A_TEST',
    hmacKey: 'test-key',
    baseUrl: 'https://example.invalid',
  }),
  callRefund: async () => {
    if (mockState.refundShouldThrow) throw new Error('network down');
    return mockState.refundResponse;
  },
  isRefundAccepted: (res: { responseCode: string }) => res.responseCode === 'R1000',
}));

const TEST_EMAIL_DOMAIN = 'vitest-refund-test.invalid';

async function createTestPayment(overrides: Partial<{ orderId: string; amount: number }> = {}) {
  const orderId = overrides.orderId ?? `REFTEST${Math.random()}`;
  return prisma.payment.create({
    data: {
      orderId,
      hotelSlug: 'burdwan',
      amount: overrides.amount ?? 100,
      guestName: 'Jane Doe',
      guestEmail: `jane-${Math.random()}@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '+91 9876543210',
      status: 'SUCCESS',
      trackingId: 'TRK1',
      bankRefNo: 'REF1',
    },
  });
}

function refundFormData(orderId: string, amount: string): FormData {
  const data = new FormData();
  data.set('orderId', orderId);
  data.set('amount', amount);
  return data;
}

describe('refundPayment', () => {
  beforeAll(() => {});

  beforeEach(() => {
    mockState.cookieValue = undefined;
    mockState.ip = `refund-actions-test-${Math.random()}`;
    mockState.refundResponse = null;
    mockState.refundShouldThrow = false;
    vi.mocked(sendMail).mockClear();
  });

  afterAll(async () => {
    const testPayments = await prisma.payment.findMany({
      where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } },
      select: { id: true },
    });
    const paymentIds = testPayments.map((p) => p.id);
    await prisma.refund.deleteMany({ where: { paymentId: { in: paymentIds } } });
    await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
  });

  it('rejects an unauthenticated request without creating a refund row', async () => {
    const payment = await createTestPayment();
    const before = await prisma.refund.count();

    const result = await refundPayment({ status: 'idle' }, refundFormData(payment.orderId, '10'));

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/session has ended/i);
    expect(await prisma.refund.count()).toBe(before);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects a refund for a payment that is not SUCCESS', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'ADMIN' })).token;
    const payment = await prisma.payment.create({
      data: {
        orderId: `REFTEST${Math.random()}`,
        hotelSlug: 'burdwan',
        amount: 100,
        guestName: 'Jane Doe',
        guestEmail: `jane-${Math.random()}@${TEST_EMAIL_DOMAIN}`,
        guestPhone: '+91 9876543210',
        status: 'INITIATED',
      },
    });

    const result = await refundPayment({ status: 'idle' }, refundFormData(payment.orderId, '10'));

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/only a successful payment/i);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects a refund for a legacy-imported payment without calling the gateway', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'ADMIN' })).token;
    // Deliberately SUCCESS: the ~4,191 imported cca_status rows with this
    // status are exactly the ones that used to render a working Refund button.
    const payment = await prisma.payment.create({
      data: {
        orderId: `REFTEST${Math.random()}`,
        hotelSlug: 'burdwan',
        amount: 100,
        guestName: 'Jane Doe',
        guestEmail: `jane-${Math.random()}@${TEST_EMAIL_DOMAIN}`,
        guestPhone: '',
        status: 'SUCCESS',
        legacySource: 'cca_status',
      },
    });
    // Would be accepted if the guard let the call through, so the assertions
    // below fail loudly rather than passing because the gateway happened to say no.
    mockState.refundResponse = { responseCode: 'R1000', respDescription: 'ok' };
    const before = await prisma.refund.count();

    const result = await refundPayment({ status: 'idle' }, refundFormData(payment.orderId, '10'));

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/predates the current gateway/i);
    expect(await prisma.refund.count()).toBe(before);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects a refund amount greater than the refundable balance', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'ADMIN' })).token;
    const payment = await createTestPayment({ amount: 100 });

    const result = await refundPayment({ status: 'idle' }, refundFormData(payment.orderId, '150'));

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/exceeds the refundable balance/i);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('records a SUCCESS refund and emails guest and staff when the gateway accepts it', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'ADMIN' })).token;
    const payment = await createTestPayment({ amount: 100 });
    mockState.refundResponse = {
      responseCode: 'R1000',
      respDescription: 'Request processed successfully',
      merchantId: 'T_TEST',
      merchantTxnNo: 'RF1',
      txnID: '7700216351944',
      secureHash: 'irrelevant-for-this-test',
    };

    const result = await refundPayment(
      { status: 'idle' },
      refundFormData(payment.orderId, '25.00'),
    );

    expect(result.status).toBe('success');

    const refund = await prisma.refund.findFirst({ where: { paymentId: payment.id } });
    expect(refund?.status).toBe('SUCCESS');
    expect(Number(refund?.amount)).toBe(25);
    expect(refund?.txnID).toBe('7700216351944');

    expect(sendMail).toHaveBeenCalledTimes(2);
    const guestSend = vi
      .mocked(sendMail)
      .mock.calls.find((call) => call[0].to === payment.guestEmail);
    expect(guestSend?.[0].subject).toContain(payment.orderId);
  });

  it('records a FAILURE refund when the gateway declines it, without blocking a later attempt', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'ADMIN' })).token;
    const payment = await createTestPayment({ amount: 100 });
    mockState.refundResponse = {
      responseCode: 'R1001',
      respDescription: 'Declined',
      merchantId: 'T_TEST',
      merchantTxnNo: 'RF2',
      secureHash: 'irrelevant-for-this-test',
    };

    const result = await refundPayment(
      { status: 'idle' },
      refundFormData(payment.orderId, '25.00'),
    );

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/declined/i);

    const refund = await prisma.refund.findFirst({ where: { paymentId: payment.id } });
    expect(refund?.status).toBe('FAILURE');

    // A FAILURE refund doesn't count against the refundable balance — a
    // retry for the full original amount should still be allowed through to
    // the gateway (this time accepted), not rejected as "exceeds balance".
    mockState.refundResponse = {
      responseCode: 'R1000',
      respDescription: 'Request processed successfully',
      merchantId: 'T_TEST',
      merchantTxnNo: 'RF2-retry',
      secureHash: 'irrelevant-for-this-test',
    };
    const secondResult = await refundPayment(
      { status: 'idle' },
      refundFormData(payment.orderId, '100.00'),
    );
    expect(secondResult.status).not.toBe('error');
  });

  it('rate-limits repeated submissions from the same IP', async () => {
    mockState.cookieValue = (await createTestStaff({ role: 'ADMIN' })).token;
    mockState.ip = `refund-actions-test-rate-limit-${Math.random()}`;
    mockState.refundResponse = {
      responseCode: 'R1000',
      respDescription: 'Request processed successfully',
      merchantId: 'T_TEST',
      merchantTxnNo: 'RF-RL',
      secureHash: 'irrelevant-for-this-test',
    };

    const attempts = await Promise.all(
      Array.from({ length: 6 }, async () => {
        const payment = await createTestPayment({ amount: 100 });
        return refundPayment({ status: 'idle' }, refundFormData(payment.orderId, '10'));
      }),
    );

    const rateLimited = attempts.filter(
      (r) => r.status === 'error' && /too many/i.test(r.message ?? ''),
    );
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
