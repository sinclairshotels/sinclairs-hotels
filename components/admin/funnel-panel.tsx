import type { Funnel } from '@/lib/funnel';

// One property's funnel, or the whole estate's. Drop-off is against the step
// above, which is the number a person actually acts on: "we lose 80% between
// room views and guest details" names where to look.
export function FunnelPanel({ funnel }: { funnel: Funnel }) {
  const top = funnel.rows[0]?.count ?? 0;

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-5">
      <p className="text-sm font-medium text-ink">{funnel.hotelName}</p>
      <ul className="mt-3 space-y-2">
        {funnel.rows.map((row) => (
          <li key={row.step}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink/70">
                {row.label}
                {row.fromBrowser && (
                  <span className="ml-1 text-[10px] uppercase tracking-wider text-ink/30">
                    browser
                  </span>
                )}
              </span>
              <span className="tabular-nums text-ink">
                {row.count.toLocaleString('en-IN')}
                {row.dropOff !== null && (
                  <span
                    className={`ml-2 text-xs ${row.dropOff >= 80 ? 'text-red-700' : 'text-ink/50'}`}
                  >
                    −{row.dropOff}%
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forest/10">
              <div
                className="h-full rounded-full bg-forest"
                style={{ width: `${top > 0 ? Math.round((row.count / top) * 100) : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
