'use client';

import {
  type EditPreview,
  type RateEditState,
  editRates,
} from '@/app/admin/(dashboard)/rates/edit-actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { CalendarRow } from '@/lib/rate-calendar';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initialState: RateEditState = { status: 'idle' };

const RATE_MODES = [
  { value: 'none', label: 'Leave unchanged' },
  { value: 'set', label: 'Set to' },
  { value: 'increaseAmount', label: 'Increase by ₹' },
  { value: 'decreaseAmount', label: 'Decrease by ₹' },
  { value: 'increasePercent', label: 'Increase by %' },
  { value: 'decreasePercent', label: 'Decrease by %' },
];

const TRI_STATES = [
  { value: 'none', label: 'Leave unchanged' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
}

export function RateEditPanel({
  hotelSlug,
  rows,
  dates,
  onClear,
}: {
  hotelSlug: string;
  rows: CalendarRow[];
  dates: string[];
  onClear: () => void;
}) {
  const [state, formAction, pending] = useActionState(editRates, initialState);
  const router = useRouter();

  // Controlled, not uncontrolled: React resets a form's DOM values once its
  // action resolves, so after the preview came back an uncontrolled number
  // input would be empty again and the confirming submission would post
  // nothing — the preview would describe a change the write then skipped.
  const [rateMode, setRateMode] = useState('none');
  const [rateValue, setRateValue] = useState('');
  const [roomsMode, setRoomsMode] = useState('none');
  const [roomsValue, setRoomsValue] = useState('');
  const [minStayValue, setMinStayValue] = useState('');
  const [stopSell, setStopSell] = useState('none');
  const [minStayMode, setMinStayMode] = useState('none');
  const [closedToArrival, setClosedToArrival] = useState('none');
  const [closedToDeparture, setClosedToDeparture] = useState('none');
  // The selection only reaches as far as the visible window. Loading a season
  // means saying so explicitly rather than scrolling and shift-clicking across
  // three screens.
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [useRange, setUseRange] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(dates[0] ?? '');
  const [rangeTo, setRangeTo] = useState(dates[dates.length - 1] ?? '');

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
      onClear();
    }
  }, [state.status, router, onClear]);

  // Reopening the editor is per-preview rather than a boolean: every action
  // result is a fresh object, so a dismissed preview can never suppress the
  // next one.
  const [dismissed, setDismissed] = useState<EditPreview | undefined>(undefined);

  const cells = rows.length * dates.length;
  const preview =
    state.status === 'preview' && state.preview !== dismissed ? state.preview : undefined;
  const echo = preview?.submitted;
  const confirming = echo !== undefined;

  return (
    <form action={formAction} className="rounded-lg border border-forest/30 bg-forest/[0.03] p-5">
      <input type="hidden" name="hotelSlug" value={hotelSlug} />
      {/* The confirmation posts the previewed submission straight back instead
          of re-reading the controls. React resets this form once the preview
          action resolves, so a Select that has fallen back to "Leave
          unchanged" would otherwise write nothing while the banner above it
          still described a change. */}
      {echo ? (
        <>
          {echo.rows.map((row) => (
            <input key={row} type="hidden" name="rows" value={row} />
          ))}
          {echo.dates.map((date) => (
            <input key={date} type="hidden" name="dates" value={date} />
          ))}
          {echo.weekdays.map((day) => (
            <input key={day} type="hidden" name="weekdays" value={day} />
          ))}
          <input type="hidden" name="from" value={echo.from} />
          <input type="hidden" name="to" value={echo.to} />
          <input type="hidden" name="rateMode" value={echo.rateMode} />
          <input type="hidden" name="rateValue" value={echo.rateValue} />
          <input type="hidden" name="roomsMode" value={echo.roomsMode} />
          <input type="hidden" name="roomsValue" value={echo.roomsValue} />
          <input type="hidden" name="minStayMode" value={echo.minStayMode} />
          <input type="hidden" name="minStayValue" value={echo.minStayValue} />
          <input type="hidden" name="stopSell" value={echo.stopSell} />
          <input type="hidden" name="closedToArrival" value={echo.closedToArrival} />
          <input type="hidden" name="closedToDeparture" value={echo.closedToDeparture} />
          <input type="hidden" name="confirmed" value="on" />
        </>
      ) : (
        <>
          {rows.map((row) => (
            <input
              key={`${row.roomTypeId}:${row.ratePlanId}`}
              type="hidden"
              name="rows"
              value={`${row.roomTypeId}:${row.ratePlanId}`}
            />
          ))}
          {/* Either an explicit selection or a range — the action prefers dates
              when they are present, so only one is ever sent. */}
          {!useRange &&
            dates.map((date) => <input key={date} type="hidden" name="dates" value={date} />)}
          {useRange && (
            <>
              <input type="hidden" name="from" value={rangeFrom} />
              <input type="hidden" name="to" value={rangeTo} />
            </>
          )}
        </>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-lg text-forest">
          {useRange
            ? `${rows.length} ${rows.length === 1 ? 'row' : 'rows'} over a date range`
            : `${cells} ${cells === 1 ? 'night' : 'nights'} selected`}
        </p>
        <p className="text-xs text-ink/60">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'} · {formatDate(dates[0] ?? '')} –{' '}
          {formatDate(dates[dates.length - 1] ?? '')}
        </p>
      </div>

      {state.status === 'error' && state.message && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{state.message}</p>
          {state.conflicts && state.conflicts.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {state.conflicts.slice(0, 8).map((conflict) => (
                <li key={`${conflict.roomTypeId}-${conflict.date}`}>
                  {formatDate(conflict.date)} · {conflict.roomName}: {conflict.sold} already sold,
                  you set {conflict.attempted}
                </li>
              ))}
              {state.conflicts.length > 8 && <li>and {state.conflicts.length - 8} more</li>}
            </ul>
          )}
        </div>
      )}

      {preview && (
        <div className="mt-3 rounded border border-gold/50 bg-gold/10 px-4 py-3 text-sm">
          <p className="font-medium text-ink">
            {preview.summary.join(' · ')} — {preview.changing} of {preview.cells} nights actually
            change.
          </p>
          {preview.sample.length > 0 && (
            <table className="mt-2 w-full text-xs text-ink/70">
              <tbody>
                {preview.sample.map((row) => (
                  <tr key={`${row.roomName}-${row.ratePlanName}-${row.date}`}>
                    <td className="py-0.5 pr-3 whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="py-0.5 pr-3">
                      {row.roomName} · {row.ratePlanName}
                    </td>
                    <td className="py-0.5 pr-2 text-ink/50">{row.before}</td>
                    <td className="py-0.5">&rarr; {row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview.changing > preview.sample.length && (
            <p className="mt-1 text-xs text-ink/50">
              and {preview.changing - preview.sample.length} more
            </p>
          )}
        </div>
      )}

      {!confirming && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Rate">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={rateMode} onValueChange={setRateMode}>
                    <SelectTrigger />
                    <SelectContent>
                      {RATE_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <input
                  name="rateValue"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rateValue}
                  onChange={(event) => setRateValue(event.target.value)}
                  disabled={rateMode === 'none'}
                  placeholder="0"
                  className="input w-24 disabled:opacity-40"
                  aria-label="Rate value"
                />
              </div>
              <input type="hidden" name="rateMode" value={rateMode} />
            </Field>

            <Field label="Rooms on sale">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={roomsMode} onValueChange={setRoomsMode}>
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem value="none">Leave unchanged</SelectItem>
                      <SelectItem value="set">Set to</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <input
                  name="roomsValue"
                  type="number"
                  min={0}
                  max={500}
                  value={roomsValue}
                  onChange={(event) => setRoomsValue(event.target.value)}
                  disabled={roomsMode === 'none'}
                  placeholder="0"
                  className="input w-24 disabled:opacity-40"
                  aria-label="Rooms on sale"
                />
              </div>
              <input type="hidden" name="roomsMode" value={roomsMode} />
            </Field>

            <Field label="Minimum stay">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={minStayMode} onValueChange={setMinStayMode}>
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem value="none">Leave unchanged</SelectItem>
                      <SelectItem value="set">Set to</SelectItem>
                      <SelectItem value="clear">Clear</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <input
                  name="minStayValue"
                  type="number"
                  min={1}
                  max={30}
                  value={minStayValue}
                  onChange={(event) => setMinStayValue(event.target.value)}
                  disabled={minStayMode !== 'set'}
                  placeholder="0"
                  className="input w-24 disabled:opacity-40"
                  aria-label="Minimum stay nights"
                />
              </div>
              <input type="hidden" name="minStayMode" value={minStayMode} />
            </Field>

            <TriField label="Stop sell" name="stopSell" value={stopSell} onChange={setStopSell} />
            <TriField
              label="Closed to arrival"
              name="closedToArrival"
              value={closedToArrival}
              onChange={setClosedToArrival}
            />
            <TriField
              label="Closed to departure"
              name="closedToDeparture"
              value={closedToDeparture}
              onChange={setClosedToDeparture}
            />
          </div>

          <div className="mt-4 rounded border border-ink/10 bg-white p-4">
            <label className="flex items-start gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={useRange}
                onChange={(event) => setUseRange(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-ink">Apply to a date range instead</span> — for a
                whole season, rather than only the nights visible above.
              </span>
            </label>
            {useRange && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="First night">
                  <DatePicker value={rangeFrom} onChange={setRangeFrom} />
                </Field>
                <Field label="Last night">
                  <DatePicker value={rangeTo} onChange={setRangeTo} min={rangeFrom} />
                </Field>
              </div>
            )}
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs uppercase tracking-wider text-ink/60">
              Only these days of the week
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((label, value) => (
                <label
                  key={label}
                  className="flex cursor-pointer items-center gap-1.5 rounded border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink/70 transition has-[:checked]:border-forest has-[:checked]:bg-forest/5 has-[:checked]:text-forest"
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={value}
                    checked={weekdays.includes(value)}
                    onChange={(event) =>
                      setWeekdays((current) =>
                        event.target.checked
                          ? [...current, value]
                          : current.filter((day) => day !== value),
                      )
                    }
                    className="h-3.5 w-3.5"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink/50">
              Leave all unticked to change every night selected.
            </p>
          </fieldset>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending
            ? 'Working…'
            : confirming
              ? `Apply to ${preview?.changing ?? 0} nights`
              : 'Review changes'}
        </button>
        {confirming && (
          <button
            type="button"
            onClick={() => setDismissed(preview)}
            className="text-sm text-ink/50 transition hover:text-ink"
          >
            Change something
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="text-sm text-ink/50 transition hover:text-ink"
        >
          Clear selection
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-ink/60">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TriField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger />
        <SelectContent>
          {TRI_STATES.map((state) => (
            <SelectItem key={state.value} value={state.value}>
              {state.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </Field>
  );
}
