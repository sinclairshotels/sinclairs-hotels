'use client';

import { type DailyRateState, saveDailyRate } from '@/app/admin/(dashboard)/rates/plan-actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { dateKey, todayInIndia } from '@/lib/booking';
import {
  MAX_NIGHTS_PER_OVERRIDE,
  describeNights,
  expandRange,
  parseNightKeys,
} from '@/lib/rate-nights';
import { useActionState, useEffect, useMemo, useState } from 'react';

const initialState: DailyRateState = { status: 'idle' };

export interface DailyHotel {
  slug: string;
  name: string;
  rooms: Array<{ roomTypeId: string; roomName: string }>;
}

export function DailyRateForm({ hotels }: { hotels: DailyHotel[] }) {
  const [state, formAction, pending] = useActionState(saveDailyRate, initialState);

  const [hotelSlug, setHotelSlug] = useState(hotels[0]?.slug ?? '');
  const [roomTypeId, setRoomTypeId] = useState(hotels[0]?.rooms[0]?.roomTypeId ?? '');
  // A range, plus any number of individual nights. One night is the range
  // with both ends on the same day, so there is no separate "single" mode to
  // get wrong.
  const [from, setFrom] = useState(dateKey(todayInIndia()));
  const [to, setTo] = useState(dateKey(todayInIndia()));
  const [extra, setExtra] = useState<string[]>([]);
  const [pick, setPick] = useState(dateKey(todayInIndia()));
  const [roomsOnSale, setRoomsOnSale] = useState('');
  const [rate, setRate] = useState('');
  // The success line describes the values that were saved. The moment any of
  // them moves it is describing something that is no longer on screen, so it
  // goes rather than sitting there looking like the state of the form.
  const [touchedSince, setTouchedSince] = useState(false);
  const settled = state.status !== 'idle' && !touchedSince;
  const change =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setTouchedSince(true);
      set(value);
    };

  const hotel = hotels.find((h) => h.slug === hotelSlug) ?? hotels[0];

  // What will actually be written, worked out in the browser and shown below
  // before anything is saved. The same two functions run on the server
  // against the same posted string, so the preview cannot promise one set of
  // nights and the save apply another.
  const nights = useMemo(
    () => parseNightKeys([...expandRange(from, to), ...extra].join(',')),
    [from, to, extra],
  );
  const tooMany = nights.length > MAX_NIGHTS_PER_OVERRIDE;

  // Changing the property swaps the room Select's whole item set, and a
  // controlled Radix Select whose value is no longer among its items reports
  // back an empty string. Deriving the room from the property is what stops
  // the form posting nothing — see CLAUDE.md.
  const selectedRoom =
    hotel?.rooms.find((room) => room.roomTypeId === roomTypeId) ?? hotel?.rooms[0];

  // No router.refresh() on success: it remounts this form, which loses the
  // property and room the person just chose along with the very message
  // saying the save worked. The action revalidates the page, so the list of
  // recent overrides is right again on the next visit.
  useEffect(() => {
    if (state.status !== 'idle') setTouchedSince(false);
  }, [state]);

  // The controls sit outside the <form> on purpose. React resets a form once
  // its action resolves, and that reset reaches the Radix Selects inside it —
  // which then report the reset back through onValueChange, losing the
  // property and room the person picked and marking the form dirty again, so
  // the message saying the save worked disappears with them. Everything posts
  // through hidden inputs instead; see booking-widget.tsx for the same shape.
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Property">
          <Select
            value={hotelSlug}
            onValueChange={(value) => {
              setTouchedSince(true);
              setHotelSlug(value);
              const next = hotels.find((h) => h.slug === value);
              setRoomTypeId(next?.rooms[0]?.roomTypeId ?? '');
            }}
          >
            <SelectTrigger />
            <SelectContent>
              {hotels.map((option) => (
                <SelectItem key={option.slug} value={option.slug}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Room">
          <Select value={selectedRoom?.roomTypeId ?? ''} onValueChange={change(setRoomTypeId)}>
            <SelectTrigger />
            <SelectContent>
              {(hotel?.rooms ?? []).map((room) => (
                <SelectItem key={room.roomTypeId} value={room.roomTypeId}>
                  {room.roomName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="From">
          <DatePicker
            value={from}
            onChange={(value) => {
              change(setFrom)(value);
              // A range that ends before it starts is a typo, not an
              // instruction: carry the far end along rather than silently
              // writing one night.
              if (to < value) setTo(value);
            }}
            min={dateKey(todayInIndia())}
            label="First night to override"
          />
        </Field>

        <Field label="To">
          <DatePicker value={to} onChange={change(setTo)} min={from} label="Last night" />
        </Field>

        <Field label="And these nights">
          <div className="flex items-center gap-2">
            <DatePicker
              value={pick}
              onChange={setPick}
              min={dateKey(todayInIndia())}
              label="Another night to include"
            />
            <button
              type="button"
              onClick={() => {
                setTouchedSince(true);
                setExtra((current) => (current.includes(pick) ? current : [...current, pick]));
              }}
              className="shrink-0 rounded border border-forest/40 px-3 py-2 text-xs uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream"
            >
              Add
            </button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rooms on sale">
            <input
              type="number"
              min={0}
              max={500}
              value={roomsOnSale}
              onChange={(event) => change(setRoomsOnSale)(event.target.value)}
              placeholder="unchanged"
              aria-label="Rooms on sale"
              className="input"
            />
          </Field>
          <Field label="Price per night">
            <input
              type="number"
              min={0}
              value={rate}
              onChange={(event) => change(setRate)(event.target.value)}
              placeholder="unchanged"
              aria-label="Price per night"
              className="input"
            />
          </Field>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink/50">Leave a box empty to leave it unchanged.</p>

      {/* The nights themselves, before the save rather than after it: a range
          and a handful of added dates is exactly the kind of thing that is one
          day out, and reading it back is the only way to catch that. */}
      <div className="mt-4 rounded border border-ink/10 bg-cream/60 px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-ink/50">
          {nights.length} {nights.length === 1 ? 'night' : 'nights'} will change
        </p>
        <p className="mt-1 text-sm text-ink/80">{describeNights(nights)}</p>
        {extra.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {extra.map((night) => (
              <li key={night}>
                <button
                  type="button"
                  onClick={() => {
                    setTouchedSince(true);
                    setExtra((current) => current.filter((value) => value !== night));
                  }}
                  className="rounded-full border border-forest/30 px-2.5 py-0.5 text-xs text-forest transition hover:border-red-400 hover:text-red-700"
                  aria-label={`Remove ${night}`}
                >
                  {night} &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        {tooMany && (
          <p className="mt-2 text-xs text-red-700">
            Up to {MAX_NIGHTS_PER_OVERRIDE} at a time here — use the monthly screen for a whole
            season.
          </p>
        )}
      </div>

      {settled && state.status === 'error' && state.message && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
      {settled && state.status === 'success' && state.message && (
        <p className="mt-4 rounded border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-forest">
          {state.message}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="hotelSlug" value={hotel?.slug ?? ''} />
        <input type="hidden" name="roomTypeId" value={selectedRoom?.roomTypeId ?? ''} />
        <input type="hidden" name="dates" value={nights.join(',')} />
        <input type="hidden" name="roomsOnSale" value={roomsOnSale} />
        <input type="hidden" name="rate" value={rate} />
        <button
          type="submit"
          disabled={pending || nights.length === 0 || tooMany}
          className="mt-5 rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending
            ? 'Saving…'
            : `Save ${nights.length} ${nights.length === 1 ? 'night' : 'nights'}`}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-wider text-ink/60">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}
