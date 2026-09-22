import { AssigneeSelect, StatusControls } from '@/components/admin/enquiry-controls';
import { EnquiryRowLink } from '@/components/admin/enquiry-row-link';
import {
  type NotificationAddress,
  NotificationEmailsPanel,
} from '@/components/admin/notification-emails-panel';
import { AdminPagination } from '@/components/admin/pagination';
import { StatTiles } from '@/components/admin/stat-tiles';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { formatDate, parsePageSize } from '@/lib/admin-format';
import { can, getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { STAFF_NOTIFY_EMAIL } from '@/lib/mail';
import { EnquiryStatus, EnquiryType, type Prisma } from '@prisma/client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// A new enquiry nobody has touched in a day is the thing this screen exists to
// surface. Same constant as the Today dashboard, so the two cannot disagree.
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// The imported legacy rows are all CLOSED-or-older and swamp the list, so the
// default view is the work still open. `status=ALL` is how you ask for
// everything — an absent parameter means "what still needs doing", not "all".
const OPEN_STATUSES: EnquiryStatus[] = ['NEW', 'CONTACTED'];

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

export const CLOSE_REASON_LABELS: Record<string, string> = {
  BOOKED: 'Booked',
  DECLINED: 'Declined',
  NO_RESPONSE: 'No response',
  SPAM: 'Spam',
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
    assignee?: string;
  }>;
}) {
  // The sidebar hides this link, and a hidden link is presentation,
  // never a permission — typing the URL has to hit the same wall.
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'enquiries:read')) notFound();

  const {
    q,
    page: pageParam,
    pageSize: pageSizeParam,
    status,
    type,
    property,
    assignee,
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
    ...(status && status in EnquiryStatus
      ? { status: status as EnquiryStatus }
      : status === 'ALL'
        ? {}
        : { status: { in: OPEN_STATUSES } }),
    ...(type && type in EnquiryType ? { type: type as EnquiryType } : {}),
    ...(property ? { property } : {}),
    ...(assignee === 'mine'
      ? { assignedToUserId: viewer.id }
      : assignee === 'none'
        ? { assignedToUserId: null }
        : assignee
          ? { assignedToUserId: assignee }
          : {}),
  };

  const isAdmin = viewer.role === 'ADMIN';

  const [enquiries, total, statusCounts, typeCounts, propertyCounts, staff, addresses] =
    await Promise.all([
      prisma.enquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: { assignedTo: { select: { id: true, name: true } } },
      }),
      prisma.enquiry.count({ where }),
      prisma.enquiry.groupBy({ by: ['status'], _count: true }),
      prisma.enquiry.groupBy({ by: ['type'], _count: true }),
      prisma.enquiry.groupBy({ by: ['property'], _count: true }),
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      isAdmin
        ? prisma.notificationEmail.findMany({ orderBy: { address: 'asc' } })
        : Promise.resolve([] as NotificationAddress[]),
    ]);

  const now = Date.now();

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
      ...(assignee ? { assignee } : {}),
      pageSize: String(pageSize),
      page: String(p),
    })}`;
  const buildPageSizeHref = (size: number) =>
    `/admin/enquiries?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(property ? { property } : {}),
      ...(assignee ? { assignee } : {}),
      pageSize: String(size),
      page: '1',
    })}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sizes to its content rather than a fixed 20%: the notification panel
          expands in here, and a fixed height sent it behind the table. */}
      <div className="shrink-0">
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
            <option value="">Open (new and contacted)</option>
            <option value="ALL">All statuses</option>
            {(Object.keys(STATUS_LABELS) as EnquiryStatus[])
              .filter((s) => countFor(s) > 0)
              .map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
          </select>
          <select
            name="assignee"
            defaultValue={assignee ?? ''}
            className="select w-auto shrink-0 py-1.5 text-sm"
          >
            <option value="">Anyone</option>
            <option value="mine">Mine</option>
            <option value="none">Unassigned</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
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
          {/* One click, because "what is on me right now" is the question this
              screen gets asked most and nobody should have to build it from
              three dropdowns. */}
          <Link
            href={assignee === 'mine' ? '/admin/enquiries' : '/admin/enquiries?assignee=mine'}
            className={`shrink-0 whitespace-nowrap rounded border px-4 py-1.5 text-sm transition ${
              assignee === 'mine'
                ? 'border-forest bg-forest/10 text-forest'
                : 'border-ink/20 text-ink/60 hover:border-forest/40 hover:text-forest'
            }`}
          >
            Mine
          </Link>
        </form>

        {isAdmin && (
          <div className="mt-3">
            <NotificationEmailsPanel
              properties={hotels.map((hotel) => ({ slug: hotel.slug, name: hotel.name }))}
              addresses={addresses}
              fallbacks={{
                central: STAFF_NOTIFY_EMAIL,
                perHotel: Object.fromEntries(
                  hotels.flatMap((hotel) =>
                    hotel.contact?.notificationEmail
                      ? [[hotel.slug, hotel.contact.notificationEmail]]
                      : [],
                  ),
                ),
              }}
            />
          </div>
        )}
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
              <th className="whitespace-nowrap px-4 py-3">Assigned</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((enquiry) => {
              const { main, legacyDetails } = splitLegacyMessage(enquiry.message);
              // Untouched for a day. Red rather than a badge because the point
              // is to be seen without reading the row.
              const stale =
                enquiry.status === 'NEW' && now - enquiry.createdAt.getTime() > STALE_AFTER_MS;
              return (
                <EnquiryRowLink
                  key={enquiry.id}
                  href={`/admin/enquiries/${enquiry.id}`}
                  className={`cursor-pointer border-b border-ink/5 align-top transition-colors last:border-0 hover:bg-forest/[0.08] ${
                    stale ? 'bg-red-50/70' : 'odd:bg-white even:bg-forest/[0.025]'
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                    {formatDate(enquiry.createdAt)}
                    {stale && (
                      <div className="mt-1 text-xs font-medium text-red-600">Waiting over 24h</div>
                    )}
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
                  {/* Four lines, then it stops. A long message used to set the
                      row height for every other row on the page; the whole of
                      it is one click away. */}
                  <td className="max-w-sm px-4 py-3 text-ink/70">
                    {main && <p className="line-clamp-4 whitespace-pre-line">{main}</p>}
                    {legacyDetails && !main && (
                      <p className="line-clamp-4 whitespace-pre-line text-xs text-ink/40">
                        {legacyDetails}
                      </p>
                    )}
                    {!main && !legacyDetails && <span className="text-ink/30">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <AssigneeSelect
                      enquiryId={enquiry.id}
                      value={enquiry.assignedToUserId}
                      staff={staff}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${statusStyles[enquiry.status] ?? 'bg-ink/10 text-ink/60'}`}
                    >
                      {STATUS_LABELS[enquiry.status]}
                      {enquiry.closeReason && ` · ${CLOSE_REASON_LABELS[enquiry.closeReason]}`}
                    </span>
                    {enquiry.statusChangedAt && (
                      <div className="mt-1 text-[11px] text-ink/45">
                        {enquiry.statusChangedLabel?.replace(/\s*<.*>$/, '')} ·{' '}
                        {formatDate(enquiry.statusChangedAt)}
                      </div>
                    )}
                    <div className="mt-1.5">
                      <StatusControls enquiryId={enquiry.id} status={enquiry.status} compact />
                    </div>
                  </td>
                </EnquiryRowLink>
              );
            })}
            {enquiries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink/50">
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
