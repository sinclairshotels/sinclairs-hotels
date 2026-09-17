'use client';

import { type DailyRateState, saveDailyRate } from '@/app/admin/(dashboard)/rates/plan-actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { dateKey, todayUtc } from '@/lib/booking';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initialState: DailyRateState = { status: 'idle' };

export interface DailyHotel {
  slug: string;
  name: string;
  rooms: Array<{ roomTypeId: string; roomName: string }>;
}

export function DailyRateForm({ hotels }: { hotels: DailyHotel[] }) {
  const [state, formAction, pending] = useActionState(saveDailyRate, initialState);
  const router = useRouter();

  const [hotelSlug, setHotelSlug] = useState(hotels[0]?.slug ?? '');
  const [roomTypeId, setRoomTypeId] = useState(hotels[0]?.rooms[0]?.roomTypeId ?? '');
  const [date, setDate] = useState(dateKey(todayUtc()));
  const [roomsOnSale, setRoomsOnSale] = useState('');
  const [rate, setRate] = useState('');

  const hotel = hotels.find((h) => h.slug === hotelSlug) ?? hotels[0];

  // Changing the property swaps the room Select's whole item set, and a
  // controlled Radix Select whose value is no longer among its items reports
  // back an empty string. Deriving the room from the property is what stops
  // the form posting nothing — see CLAUDE.md.
  const selectedRoom =
    hotel?.rooms.find((room) => room.roomTypeId === roomTypeId) ?? hotel?.rooms[0];

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state.status, router]);

  return (
    <form action={formAction} className="rounded-lg border border-ink/10 bg-white p-6">
      <input type="hidden" name="hotelSlug" value={hotel?.slug ?? ''} />
      <input type="hidden" name="roomTypeId" value={selectedRoom?.roomTypeId ?? ''} />
      <input type="hidden" name="date" value={date} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Property">
          <Select
            value={hotelSlug}
            onValueChange={(value) => {
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
          <Select value={selectedRoom?.roomTypeId ?? ''} onValueChange={setRoomTypeId}>
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
          <DatePicker value={date} onChange={setDate} min={dateKey(todayUtc())} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rooms on sale">
            <input
              type="number"
              min={0}
              max={500}
              name="roomsOnSale"
              value={roomsOnSale}
              onChange={(event) => setRoomsOnSale(event.target.value)}
              placeholder="unchanged"
              aria-label="Rooms on sale"
              className="input"
            />
          </Field>
          <Field label="Price per night">
            <input
              type="number"
              min={0}
              name="rate"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
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

      {state.status === 'error' && state.message && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
      {state.status === 'success' && state.message && (
        <p className="mt-4 rounded border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-forest">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save this night'}
      </button>
    </form>
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
