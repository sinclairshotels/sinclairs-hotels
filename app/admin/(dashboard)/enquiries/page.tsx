import { AdminPagination } from '@/components/admin/pagination';
import { StatTiles } from '@/components/admin/stat-tiles';
import { getHotelBySlug } from '@/content/hotels';
import { formatDate, parsePageSize } from '@/lib/admin-format';
import { prisma } from '@/lib/db';
import { EnquiryStatus, EnquiryType, type Prisma } from '@prisma/client';
import type { Metadata } from 'next';

const STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
};

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const statusStyles: Record<string, string> = {
  NEW: 'bg-gold/20 text-forest-dark',
  CONTACTED: 'bg-forest/10 text-forest',
  CLOSED: 'bg-ink/10 text-ink/60',
};

const typeLabels: Record<string, string> = {
  GENERAL: 'General',
  HOTEL: 'Hotel Booking',
  WEDDING: 'Wedding',
  MEETINGS: 'Meetings & Events',
};

// Imported legacy rows (scripts/migrate-legacy-data.ts) fold fields the
// current schema has no column for — subject/room/persons/source — into this
// message, marked off after the guest's own query text. Live enquiries
// submitted through the actual site (app/(site)/contact/actions.ts) never
// contain this marker — enquirySchema requires a real 10-2000 char message,
// so those always render as plain text with no legacy block below.
const LEGACY_MESSAGE_MARKER = '[Legacy enquiry details]';

function splitLegacyMessage(message: string): { main: string; legacyDetails: string | null } {
  const idx = message.indexOf(LEGACY_MESSAGE_MARKER);
  if (idx === -1) return { main: message, legacyDetails: null };
  const main = message.slice(0, idx).trim();
  const legacyDetails = message.slice(idx + LEGACY_MESSAGE_MARKER.length).trim();
  return { main, legacyDetails: legacyDetails || null };
}

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    status?: string;
    type?: string;
    property?: string;
  }>;
}) {
  const {
    q,
    page: pageParam,
    pageSize: pageSizeParam,
    status,
    type,
    property,
  } = await searchParams;
  const query = q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = parsePageSize(pageSizeParam);

  const where: Prisma.EnquiryWhereInput = {
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { legacyTicket: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(status && status in EnquiryStatus ? { status: status as EnquiryStatus } : {}),
    ...(type && type in EnquiryType ? { type: type as EnquiryType } : {}),
    ...(property ? { property } : {}),
  };

  const [enquiries, total, statusCounts, typeCounts, propertyCounts] = await Promise.all([
    prisma.enquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.enquiry.count({ where }),
    prisma.enquiry.groupBy({ by: ['status'], _count: true }),
    prisma.enquiry.groupBy({ by: ['type'], _count: true }),
    prisma.enquiry.groupBy({ by: ['property'], _count: true }),
  ]);

  const countFor = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const availableTypes = typeCounts.map((t) => t.type);
  const availableProperties = propertyCounts
    .map((p) => p.property)
    .sort((a, b) => (getHotelBySlug(a)?.name ?? a).localeCompare(getHotelBySlug(b)?.name ?? b));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildHref = (p: number) =>
    `/admin/enquiries?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(property ? { property } : {}),
      pageSize: String(pageSize),
      page: String(p),
    })}`;
  const buildPageSizeHref = (size: number) =>
    `/admin/enquiries?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(property ? { property } : {}),
      pageSize: String(size),
      page: '1',
    })}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="h-[20%] shrink-0">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-xl text-forest">Enquiries</p>
          <StatTiles
            tiles={[
              { label: 'New', value: countFor('NEW') },
              { label: 'Contacted', value: countFor('CONTACTED') },
              { label: 'Closed', value: countFor('CLOSED') },
            ]}
          />
        </div>

        <form method="get" className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name, email, phone, or ticket"
            className="input min-w-[180px] flex-1 py-1.5 text-sm"
          />
          <select
            name="status"
            defaultValue={status ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABELS) as EnquiryStatus[])
              .filter((s) => countFor(s) > 0)
              .map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
          </select>
          <select
            name="type"
            defaultValue={type ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t] ?? t}
              </option>
            ))}
          </select>
          <select
            name="property"
            defaultValue={property ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">All properties</option>
            {availableProperties.map((p) => (
              <option key={p} value={p}>
                {getHotelBySlug(p)?.name ?? p}
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
              <th className="whitespace-nowrap px-4 py-3">Guest</th>
              <th className="whitespace-nowrap px-4 py-3">Type</th>
              <th className="whitespace-nowrap px-4 py-3">Property</th>
              <th className="whitespace-nowrap px-4 py-3">Dates</th>
              <th className="whitespace-nowrap px-4 py-3">Message</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((enquiry) => {
              const { main, legacyDetails } = splitLegacyMessage(enquiry.message);
              return (
                <tr
                  key={enquiry.id}
                  className="border-b border-ink/5 align-top transition-colors last:border-0 odd:bg-white even:bg-forest/[0.025] hover:bg-forest/[0.08]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                    {formatDate(enquiry.createdAt)}
                    {enquiry.legacyTicket && (
                      <div className="mt-1 text-xs text-ink/40">{enquiry.legacyTicket}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{enquiry.name}</div>
                    <div className="text-xs text-ink/60">{enquiry.email}</div>
                    <div className="text-xs text-ink/60">{enquiry.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {typeLabels[enquiry.type] ?? enquiry.type}
                  </td>
                  <td className="px-4 py-3">
                    {getHotelBySlug(enquiry.property)?.name ?? enquiry.property}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                    {enquiry.checkIn ? formatDate(enquiry.checkIn) : '—'}
                    {' → '}
                    {enquiry.checkOut ? formatDate(enquiry.checkOut) : '—'}
                    {enquiry.guests && (
                      <div className="text-xs text-ink/50">{enquiry.guests} guests</div>
                    )}
                  </td>
                  <td className="max-w-sm px-4 py-3 text-ink/70">
                    {main && <p className="whitespace-pre-line">{main}</p>}
                    {legacyDetails && (
                      <p
                        className={`whitespace-pre-line text-xs text-ink/40 ${main ? 'mt-2' : ''}`}
                      >
                        {legacyDetails}
                      </p>
                    )}
                    {!main && !legacyDetails && <span className="text-ink/30">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[enquiry.status] ?? 'bg-ink/10 text-ink/60'}`}
                    >
                      {enquiry.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {enquiries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink/50">
                  No enquiries match the current filters.
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
        itemLabel="enquiry"
        itemLabelPlural="enquiries"
        buildHref={buildHref}
        pageSize={pageSize}
        buildPageSizeHref={buildPageSizeHref}
      />
    </div>
  );
}
