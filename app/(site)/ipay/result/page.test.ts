import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import IpayResultPage from './page';

const TEST_EMAIL_DOMAIN = 'vitest-receipt-test.invalid';

async function makePayment() {
  return prisma.payment.create({
    data: {
      orderId: `RCPT${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
      viewToken: randomBytes(32).toString('base64url'),
      hotelSlug: 'gangtok',
      amount: 4321,
      guestName: 'Receipt Test',
      guestEmail: `guest@${TEST_EMAIL_DOMAIN}`,
      guestPhone: '9000000000',
      status: 'SUCCESS',
    },
  });
}

async function show(searchParams: { t?: string }) {
  render(await IpayResultPage({ searchParams: Promise.resolve(searchParams) }));
}

beforeEach(async () => {
  await prisma.payment.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { guestEmail: { endsWith: TEST_EMAIL_DOMAIN } } });
  await prisma.$disconnect();
});

// The order number is printed on receipts and quoted in email and over the
// phone. While the page was keyed on it, knowing one was enough to open that
// payment. The token is the only key now; staff read the same transaction,
// with the guest attached, in /admin/payments.
describe('/ipay/result', () => {
  it('shows the receipt to someone holding the token', async () => {
    const payment = await makePayment();
    await show({ t: payment.viewToken as string });
    expect(screen.getByText(payment.orderId)).toBeInTheDocument();
    expect(screen.getByText(/4321/)).toBeInTheDocument();
  });

  it('does not open a payment for someone holding only the order number', async () => {
    const payment = await makePayment();
    await show({ t: payment.orderId });
    expect(screen.queryByText(payment.orderId)).not.toBeInTheDocument();
    expect(screen.getByText(/couldn.t find that payment/i)).toBeInTheDocument();
  });

  it('shows nothing when asked with no token at all', async () => {
    await makePayment();
    await show({});
    expect(screen.getByText(/couldn.t find that payment/i)).toBeInTheDocument();
  });

  it('shows nothing for a token that matches no payment', async () => {
    await makePayment();
    await show({ t: randomBytes(32).toString('base64url') });
    expect(screen.getByText(/couldn.t find that payment/i)).toBeInTheDocument();
  });
});
