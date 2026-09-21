'use client';

import {
  type MonthlyPreview,
  type MonthlyRatesState,
  saveMonthlyRates,
} from '@/app/admin/(dashboard)/rates/plan-actions';
import { RoomSetupRow, type SetupRoom } from '@/components/admin/room-setup-row';
import { monthLabel, monthShortLabel } from '@/lib/rate-plan';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initialState: MonthlyRatesState = { status: 'idle' };

export type MonthlyRoom = SetupRoom;

export interface MonthlyBaseline {
  // "roomTypeId:YYYY-MM" -> what that month already holds, where it holds one
  // value throughout. A month whose nights differ has no single monthly value,
  // so the box shows blank — and says "mixed" rather than looking unloaded.
  [key: string]: {
    roomsOnSale: number | null;
    rate: number | null;
    roomsMixed?: boolean;
    rateMixed?: boolean;
  };
}

type Draft = Record<string, { roomsOnSale: string; rate: string }>;

const cellKey = (roomTypeId: string, month: string) => `${roomTypeId}:${month}`;

function buildDraft(rooms: MonthlyRoom[], months: string[], baseline: MonthlyBaseline): Draft {
  const draft: Draft = {};
  for (const room of rooms) {
    for (const month of months) {
      const key = cellKey(room.roomTypeId, month);
      const current = baseline[key];
      draft[key] = {
        roomsOnSale: current?.roomsOnSale === null ? '' : String(current?.roomsOnSale ?? ''),
        rate: current?.rate === null ? '' : String(current?.rate ?? ''),
      };
    }
  }
  return draft;
}

// Only what staff actually changed is sent. A month left exactly as it was
// loaded is not a save — sending it would rewrite the whole month as MONTHLY
// and quietly flatten any daily override inside it.
function changedCells(draft: Draft, original: Draft) {
  const cells: Array<{ roomTypeId: string; month: string; roomsOnSale?: number; rate?: number }> =
    [];

  for (const [key, value] of Object.entries(draft)) {
    const before = original[key];
    if (before && before.roomsOnSale === value.roomsOnSale && before.rate === value.rate) continue;

    const [roomTypeId, month] = key.split(':') as [string, string];
    const cell: { roomTypeId: string; month: string; roomsOnSale?: number; rate?: number } = {
      roomTypeId,
      month,
    };
    if (value.roomsOnSale.trim() !== '') cell.roomsOnSale = Number(value.roomsOnSale);
    if (value.rate.trim() !== '') cell.rate = Number(value.rate);
    if (cell.roomsOnSale === undefined && cell.rate === undefined) continue;
    cells.push(cell);
  }

  return cells;
}

export function MonthlyRatesTable({
  hotelSlug,
  rooms,
  months,
  baseline,
  overriddenByMonth,
}: {
  hotelSlug: string;
  rooms: MonthlyRoom[];
  months: string[];
  baseline: MonthlyBaseline;
  overriddenByMonth: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState(saveMonthlyRates, initialState);
  const router = useRouter();

  const [original, setOriginal] = useState(() => buildDraft(rooms, months, baseline));
  const [draft, setDraft] = useState(original);
  const [overrides, setOverrides] = useState<'keep' | 'replace'>('keep');
  // Reopening the editor is per-preview rather than a boolean: every action
  // result is a fresh object, so a dismissed preview cannot suppress the next.
  const [dismissed, setDismissed] = useState<MonthlyPreview | undefined>(undefined);

  // A fresh baseline means the server has re-read what is loaded — adopt it,
  // so the "changed" comparison is against what is really there now.
  useEffect(() => {
    const next = buildDraft(rooms, months, baseline);
    setOriginal(next);
    setDraft(next);
  }, [baseline, rooms, months]);

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state.status, router]);

  const pendingCells = changedCells(draft, original);
  const preview =
    state.status === 'preview' && state.preview !== dismissed ? state.preview : undefined;
  const confirming = Boolean(preview && state.submitted);
  const payload = confirming ? (state.submitted?.cells as string) : JSON.stringify(pendingCells);

  const touchedMonths = new Set(pendingCells.map((cell) => cell.month));
  const overriddenInPlay = [...touchedMonths].reduce(
    (total, month) => total + (overriddenByMonth[month] ?? 0),
    0,
  );

  const setCell = (key: string, field: 'roomsOnSale' | 'rate', value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { roomsOnSale: '', rate: '' }), [field]: value },
    }));
  };

  return (
    <div>
      <div className="max-h-[58vh] overflow-auto rounded-lg border border-ink/10 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 border-b border-ink/10 bg-white px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink/50"
              >
                Room
              </th>
              {months.map((month) => (
                <th
                  key={month}
                  scope="col"
                  className="min-w-[8.5rem] border-b border-ink/10 bg-white px-2 py-3 text-center text-xs font-medium text-ink/50"
                  title={monthLabel(month)}
                >
                  <span className="block text-sm text-ink">{monthShortLabel(month)}</span>
                  {overriddenByMonth[month] ? (
                    <span className="mt-0.5 block text-[10px] font-normal text-forest">
                      {overriddenByMonth[month]} overridden
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-[10px] font-normal text-ink/30">—</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.roomTypeId} className="border-b border-ink/5">
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-64 min-w-[16rem] border-r border-ink/10 bg-white px-3 py-2 text-left align-top font-normal"
                >
                  <RoomSetupRow hotelSlug={hotelSlug} room={room} />
                </th>
                {months.map((month) => {
                  const key = cellKey(room.roomTypeId, month);
                  const value = draft[key] ?? { roomsOnSale: '', rate: '' };
                  const before = original[key];
                  const dirty =
                    before &&
                    (before.roomsOnSale !== value.roomsOnSale || before.rate !== value.rate);

                  return (
                    <td key={month} className="p-1 align-top">
                      <div
                        className={`space-y-1 rounded p-1 ${dirty ? 'bg-gold/15 ring-1 ring-gold' : ''}`}
                      >
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={value.roomsOnSale}
                          onChange={(event) => setCell(key, 'roomsOnSale', event.target.value)}
                          placeholder={baseline[key]?.roomsMixed ? 'mixed' : 'rooms'}
                          disabled={Boolean(confirming)}
                          aria-label={`${room.roomName}, ${monthLabel(month)}, rooms on sale`}
                          className="input w-full px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={value.rate}
                          onChange={(event) => setCell(key, 'rate', event.target.value)}
                          placeholder={baseline[key]?.rateMixed ? 'mixed' : '₹ / night'}
                          disabled={Boolean(confirming)}
                          aria-label={`${room.roomName}, ${monthLabel(month)}, price per night`}
                          className="input w-full px-2 py-1 text-xs"
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-ink/50">
        Each value applies to <strong>every night of that month</strong>. Leave a box empty to leave
        that half alone — filling only the rooms box changes the allotment without touching the
        price. Price is the Room Only rate; With Breakfast follows it automatically. Nights already
        past are skipped.
      </p>

      {state.status === 'error' && state.message && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{state.message}</p>
          {state.conflicts && state.conflicts.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {state.conflicts.slice(0, 8).map((conflict) => (
                <li key={`${conflict.roomTypeId}-${conflict.date}`}>
                  {conflict.date} · {conflict.roomName}: {conflict.sold} already sold, you set{' '}
                  {conflict.attempted}
                </li>
              ))}
              {state.conflicts.length > 8 && <li>and {state.conflicts.length - 8} more</li>}
            </ul>
          )}
        </div>
      )}

      {state.status === 'success' && state.message && (
        <p className="mt-4 rounded border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-forest">
          {state.message}
        </p>
      )}

      {confirming && preview && (
        <div className="mt-4 rounded border border-gold/50 bg-gold/10 px-4 py-3 text-sm">
          <p className="font-medium text-ink">
            {preview.summary.join(' · ')} — {preview.changing} of {preview.nights} nights actually
            change, across {preview.months} {preview.months === 1 ? 'month' : 'months'} and{' '}
            {preview.rooms} {preview.rooms === 1 ? 'room' : 'rooms'}.
          </p>
          {preview.overrides > 0 && (
            <p className="mt-1 text-xs text-ink/70">
              {preview.overrides} {preview.overrides === 1 ? 'night was' : 'nights were'} set on the
              Daily screen and will be{' '}
              <strong>{state.submitted?.overrides === 'keep' ? 'left alone' : 'replaced'}</strong>.
            </p>
          )}
        </div>
      )}

      {!confirming && overriddenInPlay > 0 && (
        <fieldset className="mt-4 rounded border border-ink/15 bg-white p-4">
          <legend className="px-1 text-xs uppercase tracking-wider text-ink/60">
            {overriddenInPlay} overridden {overriddenInPlay === 1 ? 'night' : 'nights'} in the
            months you are saving
          </legend>
          <p className="text-xs text-ink/60">
            Those nights were set one at a time on the Daily screen. Saving a month does not touch
            them unless you say so.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="overridesChoice"
                value="keep"
                checked={overrides === 'keep'}
                onChange={() => setOverrides('keep')}
              />
              Keep them
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="overridesChoice"
                value="replace"
                checked={overrides === 'replace'}
                onChange={() => setOverrides('replace')}
              />
              Replace them with the monthly value
            </label>
          </div>
        </fieldset>
      )}

      <form action={formAction} className="mt-5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="hotelSlug" value={hotelSlug} />
        <input type="hidden" name="cells" value={payload} />
        <input
          type="hidden"
          name="overrides"
          value={confirming ? (state.submitted?.overrides as string) : overrides}
        />
        <input type="hidden" name="confirmed" value={confirming ? 'on' : ''} />
        <button
          type="submit"
          disabled={pending || (!confirming && pendingCells.length === 0)}
          className="rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-50"
        >
          {pending
            ? 'Working…'
            : confirming
              ? `Save ${state.preview?.changing ?? 0} nights`
              : 'Review changes'}
        </button>
        {!confirming && (
          <span className="text-xs text-ink/50">
            {pendingCells.length === 0
              ? 'Change a month to enable saving.'
              : `${pendingCells.length} ${pendingCells.length === 1 ? 'month' : 'months'} edited`}
          </span>
        )}
        {confirming && (
          <button
            type="button"
            onClick={() => setDismissed(preview)}
            className="text-sm text-ink/50 transition hover:text-ink"
          >
            Change something
          </button>
        )}
      </form>
    </div>
  );
}
