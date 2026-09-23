'use client';

import { DatePicker } from '@/components/ui/date-picker';
import { useState } from 'react';

// A plain GET form: the browser downloads the response, so there is no action
// state to hold and nothing to do on the way back. The date pickers are the
// site's own rather than <input type="date">, whose popup is the OS's and
// cannot be styled to match anything around it.
export function BookingsExportForm({ from, to }: { from: string; to: string }) {
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [basis, setBasis] = useState<'booked' | 'stay'>('booked');

  return (
    <form
      method="get"
      action="/admin/bookings/export"
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="from" value={start} />
      <input type="hidden" name="to" value={end} />
      <input type="hidden" name="basis" value={basis} />

      {/* Two dates mean two different questions — "what did we sell in
          September" and "who is staying in September" — and they return
          different bookings. */}
      <div className="flex shrink-0 rounded border border-ink/15 p-0.5">
        {(
          [
            ['booked', 'Booked'],
            ['stay', 'Check-in'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setBasis(value)}
            aria-pressed={basis === value}
            className={`rounded px-2.5 py-1 text-xs transition ${
              basis === value ? 'bg-forest text-cream' : 'text-ink/60 hover:text-forest'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <DatePicker value={start} onChange={setStart} label="Export from date" />
      <DatePicker value={end} onChange={setEnd} min={start} label="Export to date" />

      <button
        type="submit"
        disabled={!start || !end}
        className="shrink-0 whitespace-nowrap rounded border border-forest/40 px-3 py-1.5 text-sm font-medium text-forest transition hover:bg-forest hover:text-cream disabled:opacity-40"
      >
        Export
      </button>
    </form>
  );
}
