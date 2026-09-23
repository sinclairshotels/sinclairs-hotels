import { PositionForm } from '@/components/admin/position-form';
import { PositionOpenToggle } from '@/components/admin/position-open-toggle';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { can, getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function CareersAdminPage() {
  const viewer = await getSession();
  // The nav hides this, but a hidden link is presentation and never a
  // permission — someone typing the URL gets the same answer.
  if (!viewer || !can(viewer, 'careers:read')) notFound();

  const mayEdit = can(viewer, 'careers:write');

  const [positions, applications] = await Promise.all([
    prisma.jobPosition.findMany({
      orderBy: [{ open: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { applications: true } } },
    }),
    prisma.jobApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
  ]);

  const byPosition = new Map<string, typeof applications>();
  for (const application of applications) {
    const key = application.positionId ?? 'general';
    byPosition.set(key, [...(byPosition.get(key) ?? []), application]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Careers</p>
        <p className="mt-1 text-sm text-ink/60">
          Positions and the people who applied to them. Only open positions appear on the site;
          closing one takes it down without touching its applications.
        </p>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-8 overflow-y-auto pb-6 pr-1">
        {mayEdit && (
          <section className="rounded-lg border border-ink/10 bg-white p-5">
            <p className="font-display text-lg text-forest">Add a position</p>
            <PositionForm properties={hotels.map((h) => ({ slug: h.slug, name: h.name }))} />
          </section>
        )}

        <section>
          <p className="text-xs uppercase tracking-wider text-ink/60">
            Positions ({positions.length})
          </p>
          {positions.length === 0 ? (
            <p className="mt-2 rounded border border-ink/10 bg-white p-5 text-sm text-ink/60">
              Nothing added yet. The careers page shows “No current openings” and still takes
              general applications.
            </p>
          ) : (
            <div className="mt-2 space-y-4">
              {positions.map((position) => {
                const where = position.hotelSlug
                  ? (getHotelBySlug(position.hotelSlug)?.name ?? position.hotelSlug)
                  : 'Across the group';
                const rows = byPosition.get(position.id) ?? [];
                return (
                  <div key={position.id} className="rounded-lg border border-ink/10 bg-white p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">{position.title}</p>
                        <p className="text-xs text-ink/50">
                          {where} · {position.department} · added {formatDate(position.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs uppercase tracking-wider ${
                            position.open ? 'bg-forest/10 text-forest' : 'bg-ink/10 text-ink/50'
                          }`}
                        >
                          {position.open ? 'Open' : 'Closed'}
                        </span>
                        {mayEdit && <PositionOpenToggle id={position.id} open={position.open} />}
                      </div>
                    </div>

                    {position.jdUrl && (
                      <p className="mt-2 text-xs">
                        <a
                          href={position.jdUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-forest underline"
                        >
                          {position.jdFileName ?? 'Job description'}
                        </a>
                      </p>
                    )}

                    <p className="mt-3 text-xs uppercase tracking-wider text-ink/50">
                      Applications ({position._count.applications})
                    </p>
                    {rows.length === 0 ? (
                      <p className="mt-1 text-sm text-ink/50">Nobody has applied yet.</p>
                    ) : (
                      <ApplicationTable rows={rows} mayDownload={mayEdit} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <p className="text-xs uppercase tracking-wider text-ink/60">General applications</p>
          {(byPosition.get('general') ?? []).length === 0 ? (
            <p className="mt-2 rounded border border-ink/10 bg-white p-5 text-sm text-ink/60">
              None yet.
            </p>
          ) : (
            <div className="mt-2 rounded-lg border border-ink/10 bg-white p-5">
              <ApplicationTable rows={byPosition.get('general') ?? []} mayDownload={mayEdit} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ApplicationTable({
  rows,
  mayDownload,
}: {
  rows: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    city: string | null;
    message: string | null;
    cvUrl: string | null;
    cvFileName: string | null;
    cvSize: number | null;
    createdAt: Date;
    positionLabel: string;
  }>;
  // View can see that somebody applied; downloading the CV is Edit, because a
  // CV is personal data rather than a list entry.
  mayDownload: boolean;
}) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink/50">
            <th className="whitespace-nowrap px-2 py-2">Applied</th>
            <th className="whitespace-nowrap px-2 py-2">Name</th>
            <th className="whitespace-nowrap px-2 py-2">Contact</th>
            <th className="px-2 py-2">Message</th>
            <th className="whitespace-nowrap px-2 py-2">CV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-ink/5 align-top">
              <td className="whitespace-nowrap px-2 py-2 text-ink/60">
                {formatDate(row.createdAt)}
              </td>
              <td className="whitespace-nowrap px-2 py-2 font-medium text-ink">
                {row.name}
                {row.city && <span className="block text-xs text-ink/50">{row.city}</span>}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-ink/70">
                <a href={`mailto:${row.email}`} className="text-forest underline">
                  {row.email}
                </a>
                <span className="block text-xs text-ink/50">{row.phone}</span>
              </td>
              <td className="px-2 py-2 text-ink/70">
                <span className="line-clamp-3">{row.message ?? '—'}</span>
              </td>
              <td className="whitespace-nowrap px-2 py-2">
                {row.cvUrl ? (
                  mayDownload ? (
                    <a
                      href={row.cvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-forest underline"
                    >
                      Download
                      <span className="block text-xs text-ink/40">{formatSize(row.cvSize)}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-ink/40">Attached</span>
                  )
                ) : (
                  <span className="text-xs text-ink/40">None</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
