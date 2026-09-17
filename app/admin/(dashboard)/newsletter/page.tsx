import { AdminPagination } from '@/components/admin/pagination';
import { StatTiles } from '@/components/admin/stat-tiles';
import { formatDate, parsePageSize } from '@/lib/admin-format';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function NewsletterSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; status?: string }>;
}) {
  const { q, page: pageParam, pageSize: pageSizeParam, status } = await searchParams;
  const query = q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = parsePageSize(pageSizeParam);

  const where: Prisma.NewsletterWhereInput = {
    ...(query ? { email: { contains: query, mode: 'insensitive' } } : {}),
    ...(status === 'active' ? { unsubscribedAt: null } : {}),
    ...(status === 'unsubscribed' ? { unsubscribedAt: { not: null } } : {}),
  };

  const [subscribers, total, activeTotal, allTotal] = await Promise.all([
    prisma.newsletter.findMany({
      where,
      orderBy: { subscribedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.newsletter.count({ where }),
    prisma.newsletter.count({ where: { unsubscribedAt: null } }),
    prisma.newsletter.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildHref = (p: number) =>
    `/admin/newsletter?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      pageSize: String(pageSize),
      page: String(p),
    })}`;
  const buildPageSizeHref = (size: number) =>
    `/admin/newsletter?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      pageSize: String(size),
      page: '1',
    })}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="h-[20%] shrink-0">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-xl text-forest">Newsletter Subscribers</p>
          <StatTiles
            tiles={[
              { label: 'Active', value: activeTotal },
              { label: 'Unsubscribed', value: allTotal - activeTotal },
            ]}
          />
        </div>

        <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by email"
            className="input min-w-[180px] flex-1 py-1.5 text-sm"
          />
          <select
            name="status"
            defaultValue={status ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All subscribers</option>
            {activeTotal > 0 && <option value="active">Active</option>}
            {allTotal - activeTotal > 0 && <option value="unsubscribed">Unsubscribed</option>}
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
              <th className="whitespace-nowrap px-4 py-3">Email</th>
              <th className="whitespace-nowrap px-4 py-3">Subscribed</th>
              <th className="whitespace-nowrap px-4 py-3">IP</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr
                key={subscriber.id}
                className="border-b border-ink/5 transition-colors last:border-0 odd:bg-white even:bg-forest/[0.025] hover:bg-forest/[0.08]"
              >
                <td className="px-4 py-3 font-medium">{subscriber.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  {formatDate(subscriber.subscribedAt)}
                </td>
                <td className="px-4 py-3 text-ink/60">{subscriber.ip ?? '—'}</td>
                <td className="px-4 py-3">
                  {subscriber.unsubscribedAt ? (
                    <span className="rounded-full bg-ink/10 px-2 py-1 text-xs font-medium text-ink/60">
                      Unsubscribed
                    </span>
                  ) : (
                    <span className="rounded-full bg-forest/10 px-2 py-1 text-xs font-medium text-forest">
                      Active
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink/50">
                  No subscribers match the current filters.
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
        itemLabel="subscriber"
        buildHref={buildHref}
        pageSize={pageSize}
        buildPageSizeHref={buildPageSizeHref}
      />
    </div>
  );
}
