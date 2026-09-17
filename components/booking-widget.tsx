'use client';

import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Hotel } from '@/content/types';
import { hotelItem, pushEcommerceEvent } from '@/lib/analytics';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function BookingWidget({ hotels }: { hotels: Hotel[] }) {
  const router = useRouter();
  const [property, setProperty] = useState(hotels[0]?.slug ?? '');
  const [checkIn, setCheckIn] = useState(todayISO(0));
  const [checkOut, setCheckOut] = useState(todayISO(1));
  const [guests, setGuests] = useState(2);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const selected = hotels.find((hotel) => hotel.slug === property);
    pushEcommerceEvent(
      'begin_checkout',
      { items: selected ? [hotelItem(selected.slug, selected.name)] : [] },
      { cta_source: 'homepage_widget', hotel: property },
    );
    // What the guest picked here is the search — it carries straight into the
    // engine's own results rather than being asked for a second time.
    const query = new URLSearchParams({
      checkIn,
      checkOut,
      rooms: '1',
      adults: String(guests),
      children: '0',
    });
    router.push(`/book/${property}?${query}`);
  }

  return (
    <form
      onSubmit={handleSearch}
      className="flex flex-col gap-3 overflow-hidden rounded-lg bg-white p-4 shadow-2xl sm:flex-row sm:items-stretch sm:gap-0 sm:divide-x sm:divide-forest/10 sm:p-0"
    >
      <div className="flex-1 px-4 py-2 sm:py-3">
        <span className="block text-xs uppercase tracking-wider text-ink/50">Select Property</span>
        <div className="mt-1">
          <Select value={property} onValueChange={setProperty}>
            <SelectTrigger />
            <SelectContent>
              {hotels.map((hotel) => (
                <SelectItem key={hotel.slug} value={hotel.slug}>
                  {hotel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="px-4 py-2 sm:py-3">
        <span className="block text-xs uppercase tracking-wider text-ink/50">Check In</span>
        <div className="mt-1 w-full sm:w-32">
          <DatePicker value={checkIn} onChange={setCheckIn} min={todayISO(0)} />
        </div>
      </div>

      <div className="px-4 py-2 sm:py-3">
        <span className="block text-xs uppercase tracking-wider text-ink/50">Check Out</span>
        <div className="mt-1 w-full sm:w-32">
          <DatePicker value={checkOut} onChange={setCheckOut} min={checkIn} />
        </div>
      </div>

      <label className="px-4 py-2 sm:py-3">
        <span className="block text-xs uppercase tracking-wider text-ink/50">Guests</span>
        <input
          type="number"
          min={1}
          max={20}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="mt-1 w-full text-sm text-ink outline-none sm:w-16"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded bg-forest px-8 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark sm:w-auto sm:rounded-none sm:px-10"
      >
        Search
      </button>
    </form>
  );
}
