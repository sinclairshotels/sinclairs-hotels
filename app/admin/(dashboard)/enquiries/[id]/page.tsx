import { BackLink } from '@/components/admin/back-link';
import {
  AssigneeSelect,
  ForwardForm,
  NotesThread,
  StatusControls,
} from '@/components/admin/enquiry-controls';
import { getHotelBySlug } from '@/content/hotels';
import { formatDate, formatTime } from '@/lib/admin-format';
import { can, canAccessHotel, getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CLOSE_REASON_LABELS } from '../page';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  HOTEL: 'Hotel Booking',
  WEDDING: 'Wedding',
  MEETINGS: 'Meetings & Events',
};

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'enquiries:read')) notFound();

  const { id } = await params;
  const enquiry = await prisma.enquiry.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      notes: { orderBy: { at: 'desc' } },
    },
  });
  // notFound() rather than a refusal: someone typing a URL for a property they
  // do not have should not learn that the enquiry exists.
  if (!enquiry || !canAccessHotel(viewer, enquiry.property)) notFound();

  const [staff, history] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.auditEvent.findMany({
      where: { entity: 'Enquiry', entityId: id },
      orderBy: { at: 'desc' },
      take: 20,
    }),
  ]);

  const propertyName = getHotelBySlug(enquiry.property)?.name ?? enquiry.property;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <BackLink href="/admin/enquiries" label="All enquiries" />
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-display text-xl text-forest">
            {enquiry.name}
            <span className="ml-3 text-sm font-normal text-ink/50">{propertyName}</span>
          </p>
          <p className="text-sm text-ink/50">
            {formatDate(enquiry.createdAt)} · {formatTime(enquiry.createdAt)}
            {enquiry.legacyTicket && ` · ${enquiry.legacyTicket}`}
          </p>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-5">
            <section className="rounded-lg border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-ink/50">Message</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                {enquiry.message}
              </p>
            </section>

            <section className="rounded-lg border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-ink/50">Notes</p>
              <p className="mt-1 text-xs text-ink/50">
                What was said back. Newest first, and nothing here is overwritten.
              </p>
              <div className="mt-3">
                <NotesThread
                  enquiryId={enquiry.id}
                  notes={enquiry.notes.map((note) => ({
                    id: note.id,
                    body: note.body,
                    authorLabel: note.authorLabel,
                    at: `${formatDate(note.at)} · ${formatTime(note.at)}`,
                  }))}
                />
              </div>
            </section>

            <section className="rounded-lg border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-ink/50">Forward</p>
              <p className="mt-1 text-xs text-ink/50">
                Sends the guest&rsquo;s details and message to any address, and records that it
                went.
              </p>
              <div className="mt-3">
                <ForwardForm enquiryId={enquiry.id} />
              </div>
            </section>

            {history.length > 0 && (
              <section className="rounded-lg border border-ink/10 bg-white p-5">
                <p className="text-xs uppercase tracking-wider text-ink/50">History</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {history.map((event) => (
                    <li key={event.id} className="flex flex-wrap gap-x-2 text-ink/70">
                      <span className="text-ink/45">{formatDate(event.at)}</span>
                      <span>{event.summary}</span>
                      <span className="text-ink/45">
                        — {event.actorLabel.replace(/\s*<.*>$/, '')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="space-y-5">
            <section className="rounded-lg border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-ink/50">Guest</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Email">
                  <a href={`mailto:${enquiry.email}`} className="text-forest hover:text-gold-dark">
                    {enquiry.email}
                  </a>
                </Row>
                <Row label="Phone">
                  <a href={`tel:${enquiry.phone}`} className="text-forest hover:text-gold-dark">
                    {enquiry.phone}
                  </a>
                </Row>
                <Row label="Type">{TYPE_LABELS[enquiry.type] ?? enquiry.type}</Row>
                <Row label="Dates">
                  {enquiry.checkIn ? formatDate(enquiry.checkIn) : '—'} →{' '}
                  {enquiry.checkOut ? formatDate(enquiry.checkOut) : '—'}
                </Row>
                {enquiry.guests !== null && <Row label="Guests">{enquiry.guests}</Row>}
              </dl>
            </section>

            <section className="rounded-lg border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-ink/50">Assigned to</p>
              <div className="mt-2">
                <AssigneeSelect
                  enquiryId={enquiry.id}
                  value={enquiry.assignedToUserId}
                  staff={staff}
                />
              </div>
              {enquiry.assignedAt && (
                <p className="mt-1.5 text-xs text-ink/45">since {formatDate(enquiry.assignedAt)}</p>
              )}
            </section>

            <section className="rounded-lg border border-ink/10 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-ink/50">Status</p>
              <p className="mt-2 text-sm text-ink/80">
                {enquiry.status === 'CLOSED' && enquiry.closeReason
                  ? `Closed — ${CLOSE_REASON_LABELS[enquiry.closeReason]}`
                  : enquiry.status === 'CONTACTED'
                    ? 'Contacted'
                    : 'New'}
              </p>
              {enquiry.statusChangedAt && (
                <p className="mt-1 text-xs text-ink/45">
                  {enquiry.statusChangedLabel?.replace(/\s*<.*>$/, '')} ·{' '}
                  {formatDate(enquiry.statusChangedAt)}
                </p>
              )}
              <div className="mt-3">
                <StatusControls enquiryId={enquiry.id} status={enquiry.status} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-ink/50">{label}</dt>
      <dd className="text-right text-ink/80">{children}</dd>
    </div>
  );
}
