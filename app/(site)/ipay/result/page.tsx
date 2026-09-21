import { IpayResultTracking } from '@/components/ipay-result-tracking';
import { getHotelBySlug } from '@/content/hotels';
import { prisma } from '@/lib/db';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Payment Result',
    description: 'Your i-Pay transaction result.',
    path: '/ipay/result',
  }),
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function IpayResultPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  // Addressed by the token only. It used to accept ?order=, but the order
  // number is printed on receipts and quoted in email, so anyone who saw one
  // could open that payment's page. The guest reaches this from the bank's
  // redirect or their own email; staff read the same transaction, with the
  // guest's details attached, in /admin/payments.
  const { t } = await searchParams;
  const payment = t ? await prisma.payment.findUnique({ where: { viewToken: t } }) : null;

  if (!payment) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-display text-2xl text-forest">We couldn&rsquo;t find that payment</p>
        <p className="mt-3 text-sm text-ink/70">
          If you completed a payment and are seeing this message, please contact us with your
          transaction number so we can confirm it.
        </p>
        <Link
          href="/contact"
          className="mt-6 inline-block rounded bg-forest px-6 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark"
        >
          Contact Us
        </Link>
      </div>
    );
  }

  const hotelName = getHotelBySlug(payment.hotelSlug)?.name ?? payment.hotelSlug;
  const isSuccess = payment.status === 'SUCCESS';

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <IpayResultTracking
        status={payment.status}
        orderId={payment.orderId}
        amount={Number(payment.amount)}
        hotelSlug={payment.hotelSlug}
        hotelName={hotelName}
      />
      <p className={`font-display text-2xl ${isSuccess ? 'text-forest' : 'text-red-700'}`}>
        {isSuccess ? 'Payment Successful' : 'Payment Not Completed'}
      </p>
      <p className="mt-3 text-sm text-ink/70">
        {isSuccess
          ? 'Thank you — a confirmation has been sent to your email.'
          : 'Your payment could not be completed. No amount has been charged.'}
      </p>

      <dl className="mt-8 space-y-3 rounded-lg border border-forest/10 bg-white p-6 text-left text-sm shadow-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink/50">Transaction No.</dt>
          <dd className="text-right">{payment.orderId}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/50">Hotel/Resort</dt>
          <dd className="text-right">{hotelName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/50">Amount</dt>
          <dd className="text-right">INR {payment.amount.toFixed(2)}</dd>
        </div>
      </dl>

      {!isSuccess && (
        <Link
          href="/ipay"
          className="mt-6 inline-block rounded bg-gold px-6 py-3 text-sm uppercase tracking-wider text-forest transition hover:bg-gold-light"
        >
          Try Again
        </Link>
      )}
    </div>
  );
}
