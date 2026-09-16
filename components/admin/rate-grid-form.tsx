'use client';

import { type RateFormState, saveRates } from '@/app/admin/(dashboard)/rates/actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Hotel } from '@/content/types';
import { addDays, dateKey, todayUtc } from '@/lib/booking';
import { useActionState, useState } from 'react';

const initialState: RateFormState = { status: 'idle' };

export function RateGridForm({ hotels }: { hotels: Hotel[] }) {
  const [state, formAction, pending] = useActionState(saveRates, initialState);
  const today = dateKey(todayUtc());

  const [hotelSlug, setHotelSlug] = useState(hotels[0]?.slug ?? '');
  const [roomName, setRoomName] = useState(hotels[0]?.rooms[0]?.name ?? '');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(dateKey(addDays(todayUtc(), 30)));

  const rooms = hotels.find((hotel) => hotel.slug === hotelSlug)?.rooms ?? [];

  // Room types belong to a property, so changing the property has to reset
  // the room — leaving the old one selected would submit a room name the new
  // hotel does not have, which the action rejects.
  const handleHotel = (slug: string) => {
    setHotelSlug(slug);
    setRoomName(hotels.find((hotel) => hotel.slug === slug)?.rooms[0]?.name ?? '');
  };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hotelSlug" value={hotelSlug} />
      <input type="hidden" name="roomName" value={roomName} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />

      {state.status !== 'idle' && state.message && (
        <p
          className={`rounded border px-4 py-3 text-sm ${
            state.status === 'success'
              ? 'border-forest/30 bg-forest/5 text-forest'
              : 'border-red-300 bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Property">
          <Select value={hotelSlug} onValueChange={handleHotel}>
            <SelectTrigger />
            <SelectContent>
              {hotels.map((hotel) => (
                <SelectItem key={hotel.slug} value={hotel.slug}>
                  {hotel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Room Type">
          <Select value={roomName} onValueChange={setRoomName}>
            <SelectTrigger />
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.name} value={room.name}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="First Night">
          <DatePicker value={from} onChange={setFrom} min={today} />
        </Field>

        <Field label="Last Night">
          <DatePicker value={to} onChange={setTo} min={from} />
        </Field>

        <Field label="Rate per night (₹)" htmlFor="rate" error={state.fieldErrors?.rate?.[0]}>
          <input
            id="rate"
            name="rate"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={4500}
            className="input"
          />
        </Field>

        <Field
          label="Rooms on sale"
          htmlFor="totalRooms"
          error={state.fieldErrors?.totalRooms?.[0]}
        >
          <input
            id="totalRooms"
            name="totalRooms"
            type="number"
            min={0}
            max={500}
            step={1}
            required
            defaultValue={5}
            className="input"
          />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink/70">
        <input type="checkbox" name="closed" className="mt-0.5" />
        <span>
          <span className="font-medium text-ink">Stop sell</span> — keep the rate loaded but take
          these nights off sale.
        </span>
      </label>

      <p className="text-xs leading-relaxed text-ink/50">
        This replaces whatever is currently loaded for that room across those nights, inclusive of
        both dates. Rooms on sale is the allotment this website may sell — hold it back in STAAH so
        the same room is not sold twice.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save Rates'}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  // Only the native inputs get one — the Radix triggers are buttons, which a
  // label cannot be associated with.
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const Label = htmlFor ? 'label' : 'span';
  return (
    <div>
      <Label
        {...(htmlFor ? { htmlFor } : {})}
        className="text-xs uppercase tracking-wider text-ink/60"
      >
        {label}
      </Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
