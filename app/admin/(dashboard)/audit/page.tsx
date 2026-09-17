import { AdminPagination } from '@/components/admin/pagination';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { formatDate, formatTime, parsePageSize } from '@/lib/admin-format';
import { can, getSession, hotelScopeFilter } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    hotel?: string;
    action?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'audit:read')) notFound();

  const { q, hotel, action, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const query = q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = parsePageSize(pageSizeParam);

  const where: Prisma.AuditEventWhereInput = {
    // Scoped even here: a Hotel user reading the audit log must not learn what
    // another property is doing with its rates.
    ...hotelScopeFilter(viewer),
    ...(query ? { actorLabel: { contains: query, mode: 'insensitive' } } : {}),
    ...(hotel ? { hotelSlug: hotel } : {}),
    ...(action ? { action: { startsWith: action } } : {}),
  };

  const [events, total, actions] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { at: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildQuery = (overrides: Record<string, string>) =>
    `/admin/audit?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(hotel ? { hotel } : {}),
      ...(action ? { action } : {}),
      pageSize: String(pageSize),
      ...overrides,
    })}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Audit log</p>
        <p className="mt-1 text-sm text-ink/60">
          Every rate, inventory, setup and booking change — who made it, when, and what it replaced.
        </p>

        <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by person"
            className="input min-w-[180px] flex-1 py-1.5 text-sm"
          />
          <select
            name="hotel"
            defaultValue={hotel ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All hotels</option>
            {hotels.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.name}
              </option>
            ))}
          </select>
          <select
            name="action"
            defaultValue={action ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All actions</option>
            {actions.map((row) => (
              <option key={row.action} value={row.action}>
                {row.action}
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
              <th className="whitespace-nowrap px-4 py-3">When</th>
              <th className="whitespace-nowrap px-4 py-3">Who</th>
              <th className="whitespace-nowrap px-4 py-3">Action</th>
              <th className="whitespace-nowrap px-4 py-3">Hotel</th>
              <th className="px-4 py-3">What changed</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-b border-ink/5 transition-colors last:border-0 odd:bg-white even:bg-forest/[0.025] hover:bg-forest/[0.08]"
              >
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  {formatDate(event.at)} {formatTime(event.at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">{event.actorLabel}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">{event.action}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  {event.hotelSlug
                    ? (getHotelBySlug(event.hotelSlug)?.name ?? event.hotelSlug)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-ink/70">{event.summary ?? '—'}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                  Nothing recorded yet.
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
        itemLabel="event"
        buildHref={(p) => buildQuery({ page: String(p) })}
        pageSize={pageSize}
        buildPageSizeHref={(size) => buildQuery({ pageSize: String(size), page: '1' })}
      />
    </div>
  );
}
