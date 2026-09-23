'use client';

import { type DailyRateState, saveDailyRate } from '@/app/admin/(dashboard)/rates/plan-actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { dateKey, todayInIndia } from '@/lib/booking';
import { useActionState, useEffect, useState } from 'react';

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
  const [date, setDate] = useState(dateKey(todayInIndia()));
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

        <Field label="Date">
          <DatePicker
            value={date}
            onChange={change(setDate)}
            min={dateKey(todayInIndia())}
            label="Night to override"
          />
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

      <p className="mt-3 text-xs text-ink/50">
        Leave a box empty to leave that half alone. This night keeps these values even when the
        month around it is saved again — unless someone chooses to replace overrides.
      </p>

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
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="roomsOnSale" value={roomsOnSale} />
        <input type="hidden" name="rate" value={rate} />
        <button
          type="submit"
          disabled={pending}
          className="mt-5 rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save this night'}
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
