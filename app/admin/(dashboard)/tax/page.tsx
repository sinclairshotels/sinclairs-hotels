import { TaxSettingForm } from '@/components/admin/tax-setting-form';
import { formatDate, formatTime } from '@/lib/admin-format';
import { can, getSession } from '@/lib/auth';
import { DEFAULT_TAX_SLAB } from '@/lib/booking';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function TaxPage() {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'tax:manage')) notFound();

  const [settings, history] = await Promise.all([
    prisma.taxSetting.findMany({ orderBy: { effectiveFrom: 'desc' }, take: 10 }),
    prisma.auditEvent.findMany({
      where: { action: 'tax.changed' },
      orderBy: { at: 'desc' },
      take: 10,
    }),
  ]);

  const current = settings[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Tax</p>
        <p className="mt-1 text-sm text-ink/60">
          GST on accommodation, charged per room per night.
        </p>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="max-w-3xl pb-6">
          <TaxSettingForm
            current={
              current
                ? {
                    threshold: current.threshold.toNumber(),
                    lowRate: current.lowRate.toNumber() * 100,
                    highRate: current.highRate.toNumber() * 100,
                    effectiveFrom: current.effectiveFrom.toISOString().slice(0, 10),
                  }
                : {
                    threshold: DEFAULT_TAX_SLAB.threshold,
                    lowRate: DEFAULT_TAX_SLAB.lowRate * 100,
                    highRate: DEFAULT_TAX_SLAB.highRate * 100,
                    effectiveFrom: '2025-09-22',
                  }
            }
            saved={Boolean(current)}
          />

          <section className="mt-8">
            <p className="font-display text-lg text-forest">Change log</p>
            <p className="mt-1 text-xs text-ink/50">Every change to the slab, newest first.</p>
            {history.length === 0 ? (
              <p className="mt-3 rounded border border-ink/10 bg-white p-6 text-sm text-ink/60">
                No changes recorded yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((event) => (
                  <li key={event.id} className="rounded-lg border border-ink/10 bg-white p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{event.summary}</p>
                      <p className="text-xs text-ink/50">
                        {formatDate(event.at)} {formatTime(event.at)} · {event.actorLabel}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
