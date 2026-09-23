import { CancelVoucherButton } from '@/components/admin/cancel-voucher-button';
import { AdminPagination } from '@/components/admin/pagination';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { formatDate, parsePageSize } from '@/lib/admin-format';
import { can, canAccessHotel, getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; hotel?: string }>;
}) {
  // The sidebar hides this link, and a hidden link is presentation,
  // never a permission — typing the URL has to hit the same wall.
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'vouchers:read')) notFound();

  const mayCancel = can(viewer, 'vouchers:write');

  const { q, page: pageParam, pageSize: pageSizeParam, hotel } = await searchParams;
  const query = q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = parsePageSize(pageSizeParam);

  // At ~10k vouchers/year, "just show the latest 100" stops being able to find
  // anything issued more than a few days ago — search + pagination is load-bearing
  // here, not a nice-to-have.
  const where: Prisma.VoucherWhereInput = {
    ...(query
      ? {
          OR: [
            { guestName: { contains: query, mode: 'insensitive' } },
            ...(Number.isInteger(Number(query)) ? [{ voucherNo: Number(query) }] : []),
          ],
        }
      : {}),
    ...(hotel ? { hotelSlug: hotel } : {}),
  };

  const [vouchers, total, hotelCounts] = await Promise.all([
    prisma.voucher.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.voucher.count({ where }),
    prisma.voucher.groupBy({ by: ['hotelSlug'], _count: true }),
  ]);

  const availableHotels = hotelCounts
    .map((h) => h.hotelSlug)
    .sort((a, b) => (getHotelBySlug(a)?.name ?? a).localeCompare(getHotelBySlug(b)?.name ?? b));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildHref = (p: number) =>
    `/admin/vouchers?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(hotel ? { hotel } : {}),
      pageSize: String(pageSize),
      page: String(p),
    })}`;
  const buildPageSizeHref = (size: number) =>
    `/admin/vouchers?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(hotel ? { hotel } : {}),
      pageSize: String(size),
      page: '1',
    })}`;

  // The view page lives on the public host, not staff.* — proxy.ts redirects
  // any non-/admin path on the staff host, so a relative link would bounce
  // straight back to /admin/vouchers. Protocol can't be hardcoded to https:
  // local dev serves plain http, and a hardcoded https:// link to localhost
  // just fails to connect — x-forwarded-proto (set by Vercel) gives the real
  // scheme in production; localhost is the only case without that header.
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const publicHost = host.replace(/^staff\./, '');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (publicHost.startsWith('localhost') ? 'http' : 'https');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-4">
          <p className="font-display text-xl text-forest">Vouchers</p>
          <Link
            href="/admin/vouchers/new"
            className="shrink-0 rounded bg-forest px-4 py-2 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark"
          >
            New Voucher
          </Link>
        </div>

        <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by guest name or voucher #"
            className="input min-w-[180px] flex-1 py-1.5 text-sm"
          />
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
              <th className="whitespace-nowrap px-4 py-3">Created</th>
              <th className="whitespace-nowrap px-4 py-3">Voucher #</th>
              <th className="whitespace-nowrap px-4 py-3">Guest</th>
              <th className="whitespace-nowrap px-4 py-3">Hotel</th>
              <th className="whitespace-nowrap px-4 py-3">Check-in</th>
              <th className="whitespace-nowrap px-4 py-3">Check-out</th>
              <th className="whitespace-nowrap px-4 py-3">View Link</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((voucher) => (
              <tr
                key={voucher.id}
                className="border-b border-ink/5 transition-colors last:border-0 odd:bg-white even:bg-forest/[0.025] hover:bg-forest/[0.08]"
              >
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  {formatDate(voucher.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium">{voucher.voucherNo}</td>
                <td className="px-4 py-3">{voucher.guestName}</td>
                <td className="px-4 py-3">
                  {getHotelBySlug(voucher.hotelSlug)?.name ?? voucher.hotelSlug}
                </td>
                <td className="px-4 py-3">{formatDate(voucher.checkIn)}</td>
                <td className="px-4 py-3">{formatDate(voucher.checkOut)}</td>
                <td className="px-4 py-3">
                  <a
                    href={`${protocol}://${publicHost}/v/${voucher.viewToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-forest underline"
                  >
                    Open
                  </a>
                </td>
                <td className="px-4 py-3">
                  {mayCancel ? (
                    <CancelVoucherButton
                      id={voucher.id}
                      voucherNo={voucher.voucherNo}
                      cancelledReason={
                        voucher.cancelledAt ? `Cancelled — ${voucher.cancelledReason ?? ''}` : null
                      }
                    />
                  ) : (
                    <span className="text-xs text-ink/50">
                      {voucher.cancelledAt ? 'Cancelled' : 'Live'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {vouchers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink/50">
                  {query || hotel ? 'No vouchers match the current filters.' : 'No vouchers yet.'}
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
        itemLabel="voucher"
        buildHref={buildHref}
        pageSize={pageSize}
        buildPageSizeHref={buildPageSizeHref}
      />
    </div>
  );
}
