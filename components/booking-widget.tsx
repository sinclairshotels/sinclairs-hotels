'use client';

import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Hotel } from '@/content/types';
import { hotelItem, pushEcommerceEvent, recordFunnelStep } from '@/lib/analytics';
import { dateKey, defaultStayWindow, todayInIndia } from '@/lib/booking';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// The first property in the list is not a guess worth making — it reads as
// chosen, and a guest who searches without noticing gets Burdwan.
const NO_PROPERTY = '';

export function BookingWidget({
  hotels,
  // Set on a hotel page, where the property is not in question.
  hotel,
  ctaSource = 'homepage_widget',
}: { hotels: Hotel[]; hotel?: string; ctaSource?: string }) {
  const router = useRouter();
  const [property, setProperty] = useState(hotel ?? NO_PROPERTY);
  // The same window the booking page opens on when it is reached without
  // dates, so a room's Book Now cannot land on a different week from the one
  // the guest was just looking at.
  const [defaults] = useState(defaultStayWindow);
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [guests, setGuests] = useState(2);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!property) return;
    const selected = hotels.find((entry) => entry.slug === property);
    pushEcommerceEvent(
      'begin_checkout',
      { items: selected ? [hotelItem(selected.slug, selected.name)] : [] },
      { cta_source: ctaSource, hotel: property },
    );
    recordFunnelStep('search', property);
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
        <span className="block text-xs uppercase tracking-wider text-ink/50">Property</span>
        <div className="mt-1">
          <Select value={property} onValueChange={setProperty}>
            <SelectTrigger bare placeholder="Select a property" />
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
          <DatePicker
            bare
            label="Check in"
            value={checkIn}
            onChange={setCheckIn}
            min={dateKey(todayInIndia())}
          />
        </div>
      </div>

      <div className="px-4 py-2 sm:py-3">
        <span className="block text-xs uppercase tracking-wider text-ink/50">Check Out</span>
        <div className="mt-1 w-full sm:w-32">
          <DatePicker
            bare
            label="Check out"
            value={checkOut}
            onChange={setCheckOut}
            min={checkIn}
          />
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
        disabled={!property}
        className="w-full rounded bg-forest px-8 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:rounded-none sm:px-10"
      >
        Search
      </button>
    </form>
  );
}
