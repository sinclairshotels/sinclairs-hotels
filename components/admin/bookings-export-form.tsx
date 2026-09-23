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
      className="flex flex-wrap items-end gap-2 rounded-lg border border-ink/10 bg-white p-3"
    >
      <input type="hidden" name="from" value={start} />
      <input type="hidden" name="to" value={end} />
      <input type="hidden" name="basis" value={basis} />

      <div>
        <span className="block text-[9px] uppercase tracking-wider text-ink/40">From</span>
        <DatePicker value={start} onChange={setStart} label="Export from date" />
      </div>
      <div>
        <span className="block text-[9px] uppercase tracking-wider text-ink/40">To</span>
        <DatePicker value={end} onChange={setEnd} min={start} label="Export to date" />
      </div>

      {/* Two dates mean two different questions — "what did we sell in
          September" and "who is staying in September" — and they return
          different bookings. */}
      <div className="flex rounded border border-ink/15 p-0.5">
        {(
          [
            ['booked', 'Booked date'],
            ['stay', 'Check-in date'],
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

      <button
        type="submit"
        disabled={!start || !end}
        className="rounded bg-forest px-4 py-1.5 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-40"
      >
        Export
      </button>
    </form>
  );
}
