'use client';

import {
  type CopyState,
  copyRoomRates,
  copyWeek,
} from '@/app/admin/(dashboard)/rates/edit-actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { addDays, dateKey, todayUtc } from '@/lib/booking';
import type { RateCalendar } from '@/lib/rate-calendar';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initialState: CopyState = { status: 'idle' };

export function CopyToolsPanel({ calendar }: { calendar: RateCalendar }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <CopyWeekForm calendar={calendar} />
      <CopyRoomForm calendar={calendar} />
    </div>
  );
}

function useCopyForm(action: typeof copyWeek) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state.status, router]);

  return { state, formAction, pending };
}

function CopyWeekForm({ calendar }: { calendar: RateCalendar }) {
  const { state, formAction, pending } = useCopyForm(copyWeek);
  const today = dateKey(todayUtc());

  const [row, setRow] = useState(
    calendar.rows[0] ? `${calendar.rows[0].roomTypeId}:${calendar.rows[0].ratePlanId}` : '',
  );
  const [sourceWeekStart, setSourceWeekStart] = useState(calendar.dates[0] ?? today);
  const [targetFrom, setTargetFrom] = useState(dateKey(addDays(todayUtc(), 7)));
  const [targetTo, setTargetTo] = useState(dateKey(addDays(todayUtc(), 60)));

  const [roomTypeId, ratePlanId] = row.split(':');
  const confirming = state.status === 'preview';

  return (
    <form action={formAction} className="rounded-lg border border-ink/10 bg-white p-5">
      <input type="hidden" name="hotelSlug" value={calendar.hotelSlug} />
      <input type="hidden" name="roomTypeId" value={roomTypeId ?? ''} />
      <input type="hidden" name="ratePlanId" value={ratePlanId ?? ''} />
      <input type="hidden" name="sourceWeekStart" value={sourceWeekStart} />
      <input type="hidden" name="targetFrom" value={targetFrom} />
      <input type="hidden" name="targetTo" value={targetTo} />
      <input type="hidden" name="confirmed" value={confirming ? 'on' : ''} />

      <p className="font-display text-base text-forest">Copy a week across a range</p>
      <p className="mt-1 text-xs text-ink/50">
        Takes seven nights and repeats them by day of week. A weekday with nothing loaded in the
        source week is left alone rather than blanked.
      </p>

      <Message state={state} />

      <div className="mt-4 space-y-3">
        <Labelled label="Room and plan">
          <Select value={row} onValueChange={setRow}>
            <SelectTrigger />
            <SelectContent>
              {calendar.rows.map((option) => (
                <SelectItem
                  key={`${option.roomTypeId}:${option.ratePlanId}`}
                  value={`${option.roomTypeId}:${option.ratePlanId}`}
                >
                  {option.roomName} · {option.ratePlanName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labelled>

        <Labelled label="Week starting">
          <DatePicker value={sourceWeekStart} onChange={setSourceWeekStart} />
        </Labelled>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Copy from">
            <DatePicker value={targetFrom} onChange={setTargetFrom} min={today} />
          </Labelled>
          <Labelled label="Copy to">
            <DatePicker value={targetTo} onChange={setTargetTo} min={targetFrom} />
          </Labelled>
        </div>
      </div>

      <SubmitButton pending={pending} confirming={confirming} nights={state.nights} />
    </form>
  );
}

function CopyRoomForm({ calendar }: { calendar: RateCalendar }) {
  const { state, formAction, pending } = useCopyForm(copyRoomRates);
  const today = dateKey(todayUtc());

  const [source, setSource] = useState(calendar.rows[0]?.ratePlanId ?? '');
  const [target, setTarget] = useState(calendar.rows[1]?.ratePlanId ?? '');
  const [differenceMode, setDifferenceMode] = useState('same');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(dateKey(addDays(todayUtc(), 60)));

  const confirming = state.status === 'preview';

  return (
    <form action={formAction} className="rounded-lg border border-ink/10 bg-white p-5">
      <input type="hidden" name="hotelSlug" value={calendar.hotelSlug} />
      <input type="hidden" name="sourceRatePlanId" value={source} />
      <input type="hidden" name="targetRatePlanId" value={target} />
      <input type="hidden" name="differenceMode" value={differenceMode} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="confirmed" value={confirming ? 'on' : ''} />

      <p className="font-display text-base text-forest">Price one room off another</p>
      <p className="mt-1 text-xs text-ink/50">
        Copies prices only. The target room keeps its own allotment and restrictions.
      </p>

      <Message state={state} />

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Labelled label="From">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger />
              <SelectContent>
                {calendar.rows.map((option) => (
                  <SelectItem key={option.ratePlanId} value={option.ratePlanId}>
                    {option.roomName} · {option.ratePlanName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labelled>
          <Labelled label="Onto">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger />
              <SelectContent>
                {calendar.rows.map((option) => (
                  <SelectItem key={option.ratePlanId} value={option.ratePlanId}>
                    {option.roomName} · {option.ratePlanName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labelled>
        </div>

        <Labelled label="Difference">
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={differenceMode} onValueChange={setDifferenceMode}>
                <SelectTrigger />
                <SelectContent>
                  <SelectItem value="same">Same price</SelectItem>
                  <SelectItem value="amount">Plus/minus ₹</SelectItem>
                  <SelectItem value="percent">Plus/minus %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <input
              name="differenceValue"
              type="number"
              step="0.01"
              disabled={differenceMode === 'same'}
              placeholder="0"
              className="input w-24 disabled:opacity-40"
              aria-label="Difference value"
            />
          </div>
        </Labelled>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label="From date">
            <DatePicker value={from} onChange={setFrom} min={today} />
          </Labelled>
          <Labelled label="To date">
            <DatePicker value={to} onChange={setTo} min={from} />
          </Labelled>
        </div>
      </div>

      <SubmitButton pending={pending} confirming={confirming} nights={state.nights} />
    </form>
  );
}

function Message({ state }: { state: CopyState }) {
  if (state.status === 'idle' || !state.message) return null;

  const tone =
    state.status === 'error'
      ? 'border-red-300 bg-red-50 text-red-700'
      : state.status === 'success'
        ? 'border-forest/30 bg-forest/5 text-forest'
        : 'border-gold/50 bg-gold/10 text-ink';

  return (
    <div className={`mt-3 rounded border px-4 py-3 text-sm ${tone}`}>
      <p>{state.message}</p>
      {state.conflicts && state.conflicts.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {state.conflicts.slice(0, 6).map((conflict) => (
            <li key={`${conflict.roomTypeId}-${conflict.date}`}>
              {conflict.date} · {conflict.roomName}: {conflict.sold} already sold, you set{' '}
              {conflict.attempted}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmitButton({
  pending,
  confirming,
  nights,
}: {
  pending: boolean;
  confirming: boolean;
  nights?: number;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 rounded bg-forest px-5 py-2 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
    >
      {pending ? 'Working…' : confirming ? `Apply to ${nights ?? 0} nights` : 'Review'}
    </button>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-ink/60">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}
