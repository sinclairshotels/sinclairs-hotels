import { CancelBookingButton } from '@/components/admin/cancel-booking-button';
import { AdminPagination } from '@/components/admin/pagination';
import { getHotelBySlug } from '@/content/hotels';
import { formatDate, parsePageSize } from '@/lib/admin-format';
import { can, getSession } from '@/lib/auth';
import { formatInr, formatReference } from '@/lib/booking';
import { prisma } from '@/lib/db';
import type { BookingStatus, Prisma } from '@prisma/client';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: 'Confirmed',
  PENDING_PAYMENT: 'Awaiting payment',
  PAYMENT_FAILED: 'Payment failed',
  CANCELLED: 'Cancelled',
  REFUND_DUE: 'Refund due',
};

const STATUS_STYLE: Record<BookingStatus, string> = {
  CONFIRMED: 'bg-forest/10 text-forest',
  PENDING_PAYMENT: 'bg-gold/20 text-gold-dark',
  PAYMENT_FAILED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-ink/10 text-ink/60',
  // Paid but unconfirmed and owing the guest money — the one status on this
  // page that is a task rather than a state.
  REFUND_DUE: 'bg-red-700 text-white',
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    hotel?: string;
    status?: string;
  }>;
}) {
  // The sidebar hides this link, and a hidden link is presentation,
  // never a permission — typing the URL has to hit the same wall.
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'bookings:read')) notFound();

  const { q, page: pageParam, pageSize: pageSizeParam, hotel, status } = await searchParams;
  const query = q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = parsePageSize(pageSizeParam);
  const statusFilter = status && status in STATUS_LABEL ? (status as BookingStatus) : undefined;

  const where: Prisma.BookingWhereInput = {
    ...(query
      ? {
          OR: [
            { guestName: { contains: query, mode: 'insensitive' } },
            { reference: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(hotel ? { hotelSlug: hotel } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [bookings, total, hotelCounts] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.booking.count({ where }),
    prisma.booking.groupBy({ by: ['hotelSlug'], _count: true }),
  ]);

  const availableHotels = hotelCounts
    .map((row) => row.hotelSlug)
    .sort((a, b) => (getHotelBySlug(a)?.name ?? a).localeCompare(getHotelBySlug(b)?.name ?? b));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildQuery = (overrides: Record<string, string>) =>
    `/admin/bookings?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(hotel ? { hotel } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      pageSize: String(pageSize),
      ...overrides,
    })}`;

  // The guest-facing booking page lives on the public host, not staff.* —
  // proxy.ts redirects any non-/admin path there, so a relative link would
  // bounce straight back. Same pattern as the vouchers page.
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const publicHost = host.replace(/^staff\./, '');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (publicHost.startsWith('localhost') ? 'http' : 'https');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Bookings</p>
        <p className="mt-1 text-sm text-ink/60">
          Direct bookings taken on the website. Rooms are held against the allotment loaded in
          Set-up.
        </p>

        <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by guest name or reference"
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
          <select
            name="status"
            defaultValue={statusFilter ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
              <th className="whitespace-nowrap px-4 py-3">Booked</th>
              <th className="whitespace-nowrap px-4 py-3">Reference</th>
              <th className="whitespace-nowrap px-4 py-3">Guest</th>
              <th className="whitespace-nowrap px-4 py-3">Hotel</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Stay</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Total</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              {/* Pinned: this column holds Cancel, and the table is wider than
                  the screen. An action that releases a paid room must not be
                  something staff have to scroll sideways to discover. */}
              <th className="sticky right-0 whitespace-nowrap bg-forest px-4 py-3 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]" />
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                // The stripe and hover are opaque rather than forest at low alpha
                // because the pinned last column inherits this background: a
                // translucent one lets the columns scrolling beneath show
                // through it. These are the same colours the alphas resolved to
                // over white, so nothing looks different.
                className="border-b border-ink/5 transition-colors last:border-0 odd:bg-white even:bg-[#f9fafa] hover:bg-[#eceff0]"
              >
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  {formatDate(booking.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  <Link href={`/admin/bookings/${booking.id}`} className="text-forest underline">
                    {formatReference(booking.reference)}
                  </Link>
                  <a
                    href={`${protocol}://${publicHost}/booking/${booking.viewToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="The guest's own page"
                    className="ml-2 text-xs text-ink/40 hover:text-forest"
                  >
                    guest view
                  </a>
                </td>
                <td className="px-4 py-3">{booking.guestName}</td>
                <td className="px-4 py-3">
                  {getHotelBySlug(booking.hotelSlug)?.name ?? booking.hotelSlug}
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {booking.roomName}
                  {booking.rooms > 1 && (
                    <span className="whitespace-nowrap text-ink/50"> ×{booking.rooms}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/70">
                  <span className="whitespace-nowrap">{formatDate(booking.checkIn)} –</span>{' '}
                  <span className="whitespace-nowrap">{formatDate(booking.checkOut)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink/70">
                  {formatInr(booking.total.toNumber())}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${STATUS_STYLE[booking.status]}`}
                  >
                    {STATUS_LABEL[booking.status]}
                  </span>
                </td>
                <td className="sticky right-0 z-[1] whitespace-nowrap bg-inherit px-4 py-3 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
                  {booking.status !== 'CANCELLED' && (
                    <CancelBookingButton id={booking.id} reference={booking.reference} />
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink/50">
                  {query || hotel || statusFilter
                    ? 'No bookings match the current filters.'
                    : 'No direct bookings yet.'}
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
        itemLabel="booking"
        buildHref={(p) => buildQuery({ page: String(p) })}
        pageSize={pageSize}
        buildPageSizeHref={(size) => buildQuery({ pageSize: String(size), page: '1' })}
      />
    </div>
  );
}
