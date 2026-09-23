'use client';

import {
  type SetupState,
  addNonRefundableWindow,
  removeNonRefundableWindow,
} from '@/app/admin/(dashboard)/rates/room-actions';
import { DatePicker } from '@/components/ui/date-picker';
import { useActionState, useEffect, useState } from 'react';

const initial: SetupState = { status: 'idle' };

export interface WindowRow {
  id: string;
  startDate: string;
  endDate: string;
  label: string | null;
  span: string;
  past: boolean;
}

export function NonRefundableWindows({
  hotelSlug,
  windows,
  today,
  coveredTo,
}: {
  hotelSlug: string;
  windows: WindowRow[];
  today: string;
  // The last date any loaded window reaches, or null if none is still ahead.
  coveredTo: string | null;
}) {
  const [state, formAction, pending] = useActionState(addNonRefundableWindow, initial);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    if (state.status === 'success') {
      setStart('');
      setEnd('');
    }
  }, [state.status]);

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <p className="text-sm font-medium text-ink">Non-refundable only</p>
      <p className="mt-1 text-xs text-ink/55">
        Dates this property sells on non-refundable terms only.
      </p>

      {windows.length === 0 ? (
        <p className="mt-3 text-xs text-ink/50">None.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {windows.map((window) => (
            <li key={window.id} className="flex items-center gap-2 text-xs">
              <span className={window.past ? 'text-ink/35 line-through' : 'text-ink/80'}>
                {window.span}
              </span>
              {window.label && <span className="text-ink/45">{window.label}</span>}
              {window.past && <span className="text-ink/35">past</span>}
              <RemoveButton hotelSlug={hotelSlug} id={window.id} span={window.span} />
            </li>
          ))}
        </ul>
      )}

      {/* The windows are dates, not a rule that repeats itself, so they run out.
          Saying when is the difference between a policy and a policy that
          quietly stopped applying one Christmas. */}
      {coveredTo === null && windows.length > 0 && (
        <p className="mt-2 text-xs text-gold-dark">
          Every period loaded here is in the past. Add next season&rsquo;s dates.
        </p>
      )}

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="hotelSlug" value={hotelSlug} />
        <input type="hidden" name="startDate" value={start} />
        <input type="hidden" name="endDate" value={end} />

        {/* A div rather than a label: the picker's trigger is a button, which a
            <label> cannot name. Its own `label` prop is what gives it one. */}
        <div>
          <span className="block text-[9px] uppercase tracking-wider text-ink/40">First date</span>
          <DatePicker
            value={start}
            onChange={setStart}
            min={today}
            label="First non-refundable date"
            placeholder="First date"
          />
        </div>
        <div>
          <span className="block text-[9px] uppercase tracking-wider text-ink/40">Last date</span>
          <DatePicker
            value={end}
            onChange={setEnd}
            min={start || today}
            label="Last non-refundable date"
            placeholder="Last date"
          />
        </div>
        <label className="block">
          <span className="block text-[9px] uppercase tracking-wider text-ink/40">
            Name (optional)
          </span>
          <input
            name="label"
            maxLength={60}
            placeholder="Peak season"
            aria-label="Name for this period"
            className="input px-2 py-1 text-xs"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !start || !end}
          className="rounded border border-forest/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add period'}
        </button>
      </form>

      {state.message && (
        <p
          className={`mt-2 text-[11px] ${state.status === 'error' ? 'text-red-700' : 'text-forest'}`}
          aria-live="polite"
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

function RemoveButton({
  hotelSlug,
  id,
  span,
}: {
  hotelSlug: string;
  id: string;
  span: string;
}) {
  const [state, formAction, pending] = useActionState(removeNonRefundableWindow, initial);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="hotelSlug" value={hotelSlug} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Remove ${span}`}
        className="text-[10px] uppercase tracking-wider text-red-700 transition hover:text-red-900 disabled:opacity-50"
      >
        Remove
      </button>
      {state.status === 'error' && (
        <span className="text-[10px] text-red-700">{state.message}</span>
      )}
    </form>
  );
}
