import { AdminPagination } from '@/components/admin/pagination';
import { RefundForm } from '@/components/admin/refund-form';
import { StatTiles } from '@/components/admin/stat-tiles';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { formatDate, formatTime, maskedInstrument, parsePageSize } from '@/lib/admin-format';
import { can, canAccessHotel, getSession } from '@/lib/auth';
import { formatInr, formatReference } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { hotelScopeFilter } from '@/lib/roles';
import { PaymentStatus, type Prisma } from '@prisma/client';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const statusStyles: Record<string, string> = {
  SUCCESS: 'bg-forest/10 text-forest',
  INITIATED: 'bg-gold/20 text-forest-dark',
  FAILURE: 'bg-red-100 text-red-700',
  ABORTED: 'bg-ink/10 text-ink/60',
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  SUCCESS: 'Success',
  INITIATED: 'Initiated',
  FAILURE: 'Failure',
  ABORTED: 'Aborted',
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    status?: string;
    hotel?: string;
  }>;
}) {
  // The sidebar hides this link, and a hidden link is presentation,
  // never a permission — typing the URL has to hit the same wall.
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'payments:read')) notFound();

  const { q, page: pageParam, pageSize: pageSizeParam, status, hotel } = await searchParams;
  const query = q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = parsePageSize(pageSizeParam);

  const where: Prisma.PaymentWhereInput = {
    ...(query
      ? {
          OR: [
            { guestName: { contains: query, mode: 'insensitive' } },
            { guestEmail: { contains: query, mode: 'insensitive' } },
            { orderId: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(status && status in PaymentStatus ? { status: status as PaymentStatus } : {}),
    ...(hotel ? { hotelSlug: hotel } : {}),
  };

  const [payments, total, statusCounts, hotelCounts] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: { refunds: { orderBy: { createdAt: 'desc' } } },
    }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ['status'], _count: true }),
    prisma.payment.groupBy({ by: ['hotelSlug'], _count: true }),
  ]);

  // Money owed to somebody, at the top of the screen where refunds are made.
  // Read from the booking rather than written as a second record: a refund
  // task that is its own row is a row that can disagree with the booking it
  // is about. Scoped like everything else here.
  const refundsDue = await prisma.booking.findMany({
    where: {
      status: 'REFUND_DUE',
      ...(hotel ? { hotelSlug: hotel } : {}),
      ...hotelScopeFilter(viewer),
    },
    orderBy: { cancelledAt: 'desc' },
    take: 25,
    select: {
      id: true,
      reference: true,
      hotelSlug: true,
      guestName: true,
      total: true,
      cancelledAt: true,
      payment: { select: { orderId: true } },
    },
  });

  const countFor = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const availableHotels = hotelCounts
    .map((h) => h.hotelSlug)
    .sort((a, b) => (getHotelBySlug(a)?.name ?? a).localeCompare(getHotelBySlug(b)?.name ?? b));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildHref = (p: number) =>
    `/admin/payments?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      ...(hotel ? { hotel } : {}),
      pageSize: String(pageSize),
      page: String(p),
    })}`;
  const buildPageSizeHref = (size: number) =>
    `/admin/payments?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      ...(hotel ? { hotel } : {}),
      pageSize: String(size),
      page: '1',
    })}`;

  // /ipay/result lives on the public host, not staff.* — proxy.ts redirects any
  // non-/admin path on the staff host, so a relative link would bounce
  // straight back to /admin/payments (same reasoning as the Vouchers page).
  // Protocol can't be hardcoded to https: local dev serves plain http.
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const publicHost = host.replace(/^staff\./, '');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (publicHost.startsWith('localhost') ? 'http' : 'https');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="h-[20%] shrink-0">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-xl text-forest">Payments</p>
          <StatTiles
            tiles={[
              { label: 'Success', value: countFor('SUCCESS') },
              { label: 'Initiated', value: countFor('INITIATED') },
              { label: 'Failed/Aborted', value: countFor('FAILURE') + countFor('ABORTED') },
            ]}
          />
        </div>

        {refundsDue.length > 0 && (
          <div className="mt-3 rounded border border-red-300 bg-red-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-red-700">
              {refundsDue.length} refund{refundsDue.length === 1 ? '' : 's'} due
            </p>
            <ul className="mt-1.5 space-y-1 text-sm text-ink/80">
              {refundsDue.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{formatReference(booking.reference)}</span>
                  <span className="text-ink/55">
                    {getHotelBySlug(booking.hotelSlug)?.name ?? booking.hotelSlug} ·{' '}
                    {booking.guestName}
                  </span>
                  <span className="font-medium">{formatInr(booking.total.toNumber())}</span>
                  {booking.payment?.orderId && (
                    <Link
                      href={`/admin/payments?q=${encodeURIComponent(booking.payment.orderId)}`}
                      className="text-xs uppercase tracking-wider text-forest underline"
                    >
                      Find the payment
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-ink/55">
              Refunds are made by hand, from the row below. Nothing here moves money on its own.
            </p>
          </div>
        )}

        <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by guest name, email, or transaction no."
            className="input min-w-[180px] flex-1 py-1.5 text-sm"
          />
          <select
            name="status"
            defaultValue={status ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as PaymentStatus[])
              .filter((s) => countFor(s) > 0)
              .map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
          </select>
          <select
            name="hotel"
            defaultValue={hotel ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All hotels</option>
            {availableHotels.map((slug) => (
              <option key={slug} value={slug}>
                {getHotelBySlug(slug)?.name ?? slug}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="shrink-0 whitespace-nowrap rounded bg-forest px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-forest-dark"
          >
            Filter
          </button>
        </form>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-ink/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gold/40 bg-forest text-[11px] uppercase tracking-wide text-cream/90">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Date</th>
              <th className="whitespace-nowrap px-4 py-3">Transaction No.</th>
              <th className="whitespace-nowrap px-4 py-3">Guest</th>
              <th className="whitespace-nowrap px-4 py-3">Hotel</th>
              <th className="whitespace-nowrap px-4 py-3">Amount</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="whitespace-nowrap px-4 py-3">Gateway Ref.</th>
              <th className="whitespace-nowrap px-4 py-3">Refund</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr
                key={payment.id}
                className="border-b border-ink/5 align-top transition-colors last:border-0 odd:bg-white even:bg-forest/[0.025] hover:bg-forest/[0.08]"
              >
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  {formatDate(payment.createdAt)}
                  <div className="text-xs text-ink/40">{formatTime(payment.createdAt)}</div>
                </td>
                <td className="px-4 py-3 font-medium">
                  <a
                    href={`${protocol}://${publicHost}/ipay/result?t=${payment.viewToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-forest underline"
                  >
                    {payment.orderId}
                  </a>
                  {payment.legacySource && (
                    <div
                      className="mt-1 text-xs font-normal text-ink/40"
                      title={`Imported from the legacy ${payment.legacySource} table`}
                    >
                      Legacy
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{payment.guestName}</div>
                  <div className="text-xs text-ink/60">{payment.guestEmail}</div>
                  <div className="text-xs text-ink/60">{payment.guestPhone}</div>
                </td>
                <td className="px-4 py-3">
                  {getHotelBySlug(payment.hotelSlug)?.name ?? payment.hotelSlug}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  INR {payment.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[payment.status] ?? 'bg-ink/10 text-ink/60'}`}
                  >
                    {payment.status}
                  </span>
                  {payment.failureMessage && (
                    <div className="mt-1 max-w-[16rem] text-xs text-ink/50">
                      {payment.failureMessage}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink/60">
                  {payment.trackingId && <div>Txn: {payment.trackingId}</div>}
                  {payment.bankRefNo && <div>Ref: {payment.bankRefNo}</div>}
                  {!payment.trackingId && !payment.bankRefNo && '—'}
                </td>
                <td className="px-4 py-3">
                  {/* Only where a Refund link would otherwise have been: a
                      legacy FAILURE/ABORTED/INITIATED row has nothing to refund
                      either way, so it stays blank as it always did. */}
                  {payment.legacySource && payment.status === 'SUCCESS' && (
                    <span
                      className="text-xs text-ink/50"
                      title="This payment predates the current gateway — ICICI has no record of it. Refund it directly with the bank."
                    >
                      Via bank
                    </span>
                  )}
                  {!payment.legacySource &&
                    payment.status === 'SUCCESS' &&
                    (() => {
                      const refundedTotal = payment.refunds
                        .filter((r) => r.status === 'SUCCESS')
                        .reduce((sum, r) => sum + Number(r.amount), 0);
                      const remaining = Number(payment.amount) - refundedTotal;
                      return (
                        <RefundForm
                          orderId={payment.orderId}
                          remaining={remaining}
                          sourceLabel={maskedInstrument(payment.paymentMode, payment.paymentInstId)}
                          history={payment.refunds.map((refund) => ({
                            id: refund.id,
                            amount: Number(refund.amount),
                            status: refund.status,
                            txnID: refund.txnID,
                            respDescription: refund.respDescription,
                            date: formatDate(refund.createdAt),
                            time: formatTime(refund.createdAt),
                          }))}
                        />
                      );
                    })()}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink/50">
                  {query || status || hotel
                    ? 'No payments match the current filters.'
                    : 'No payments yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        total={total}
        itemLabel="payment"
        buildHref={buildHref}
        pageSize={pageSize}
        buildPageSizeHref={buildPageSizeHref}
      />
    </div>
  );
}
