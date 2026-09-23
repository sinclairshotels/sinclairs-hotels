'use client';

import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Hotel } from '@/content/types';
import { hotelItem, pushEcommerceEvent, recordFunnelStep } from '@/lib/analytics';
import { addDays, dateKey, todayUtc } from '@/lib/booking';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ROOM_OPTIONS = [1, 2, 3, 4, 5];
const ADULT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const CHILD_OPTIONS = [0, 1, 2, 3, 4];

// Searches the allotment this site sells itself — see lib/availability.ts.
export function BookingSearchForm({
  hotels,
  defaultHotel,
  defaultCheckIn,
  defaultCheckOut,
  defaultRooms,
  defaultAdults,
  defaultChildren,
  compact = false,
}: {
  hotels: Hotel[];
  defaultHotel?: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultRooms?: number;
  defaultAdults?: number;
  defaultChildren?: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const today = dateKey(todayUtc());
  const tomorrow = dateKey(addDays(todayUtc(), 1));

  const [hotelSlug, setHotelSlug] = useState(defaultHotel ?? hotels[0]?.slug ?? '');
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? today);
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? tomorrow);
  const [rooms, setRooms] = useState(String(defaultRooms ?? 1));
  const [adults, setAdults] = useState(String(defaultAdults ?? 2));
  const [children, setChildren] = useState(String(defaultChildren ?? 0));

  // A check-out on or before check-in has no nights in it, so the search would
  // return nothing at all — nudge it forward instead of letting a guest submit
  // a stay that cannot exist.
  const handleCheckIn = (value: string) => {
    setCheckIn(value);
    if (checkOut <= value) setCheckOut(dateKey(addDays(new Date(`${value}T00:00:00.000Z`), 1)));
  };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const hotel = hotels.find((h) => h.slug === hotelSlug);
    pushEcommerceEvent(
      'begin_checkout',
      { items: hotel ? [hotelItem(hotel.slug, hotel.name)] : [] },
      { cta_source: 'booking_search', hotel: hotelSlug },
    );
    recordFunnelStep('search', hotelSlug);
    router.push(
      `/book/${hotelSlug}?${new URLSearchParams({ checkIn, checkOut, rooms, adults, children })}`,
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? 'grid grid-cols-2 items-end gap-3 lg:grid-cols-6'
          : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
      }
    >
      <Field label="Property" className={compact ? 'col-span-2 lg:col-span-1' : ''}>
        <Select value={hotelSlug} onValueChange={setHotelSlug}>
          <SelectTrigger bare />
          <SelectContent>
            {hotels.map((hotel) => (
              <SelectItem key={hotel.slug} value={hotel.slug}>
                {hotel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Check In">
        <DatePicker bare label="Check in" value={checkIn} onChange={handleCheckIn} min={today} />
      </Field>

      <Field label="Check Out">
        <DatePicker bare label="Check out" value={checkOut} onChange={setCheckOut} min={tomorrow} />
      </Field>

      <Field label="Rooms">
        <NumberSelect value={rooms} onChange={setRooms} options={ROOM_OPTIONS} />
      </Field>

      <Field label="Adults">
        <NumberSelect value={adults} onChange={setAdults} options={ADULT_OPTIONS} />
      </Field>

      <Field label="Children">
        <NumberSelect value={children} onChange={setChildren} options={CHILD_OPTIONS} />
      </Field>

      <button
        type="submit"
        className={`rounded bg-forest px-8 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark ${
          compact ? 'col-span-2 lg:col-span-6' : 'sm:col-span-2 lg:col-span-3'
        }`}
      >
        Check Availability
      </button>
    </form>
  );
}

function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  // A div rather than a label: every control here is a Radix trigger (a
  // button, not a form control), which a label cannot be associated with.
  // The trigger carries its own accessible name.
  return (
    <div className={className}>
      <span className="block text-xs uppercase tracking-wider text-ink/60">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function NumberSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: number[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger bare />
      <SelectContent>
        {options.map((option) => (
          // String, not the number: Radix reads the item's children to render
          // the trigger's value, and a bare 0 is falsy — "Children: 0" came
          // out as an empty box.
          <SelectItem key={option} value={String(option)}>
            {String(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
