'use client';

import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Hotel } from '@/content/types';
import { hotelItem, pushEcommerceEvent, recordFunnelStep } from '@/lib/analytics';
import { addDays, dateKey, defaultStayWindow, parseDateOnly, todayInIndia } from '@/lib/booking';
import {
  type ChildPolicy,
  DEFAULT_CHILD_POLICY,
  MAX_CHILD_AGE_OFFERED,
  childPolicyLines,
} from '@/lib/child-ages';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ROOM_OPTIONS = [1, 2, 3, 4, 5];
const ADULT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const CHILD_OPTIONS = [0, 1, 2, 3, 4];
const AGE_OPTIONS = Array.from({ length: MAX_CHILD_AGE_OFFERED + 1 }, (_, age) => age);

// Searches the allotment this site sells itself — see lib/availability.ts.
export function BookingSearchForm({
  hotels,
  defaultHotel,
  defaultCheckIn,
  defaultCheckOut,
  defaultRooms,
  defaultAdults,
  defaultChildren,
  defaultChildAges,
  childPolicies,
  room,
  compact = false,
}: {
  hotels: Hotel[];
  defaultHotel?: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultRooms?: number;
  defaultAdults?: number;
  defaultChildren?: number;
  // "3,8", carried back into the form so a search that is refined keeps the
  // ages the guest already gave.
  defaultChildAges?: string;
  // Per property, because the properties disagree about who is a child. The
  // form holds all of them because the property is one of its own fields.
  childPolicies?: Record<string, ChildPolicy>;
  // The room a guest arrived on, carried through the search so it is still
  // chosen when the results come back. Dropped when the search moves to
  // another property, where the name means nothing.
  room?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const today = dateKey(todayInIndia());
  // Opened without dates, this offers the same stay the hotel page's widget
  // does — one function, so the two cannot drift apart again.
  const [fallback] = useState(defaultStayWindow);

  const [hotelSlug, setHotelSlug] = useState(defaultHotel ?? hotels[0]?.slug ?? '');
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? fallback.checkIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? fallback.checkOut);
  const [rooms, setRooms] = useState(String(defaultRooms ?? 1));
  const [adults, setAdults] = useState(String(defaultAdults ?? 2));
  const [children, setChildren] = useState(String(defaultChildren ?? 0));
  const [ages, setAges] = useState<string[]>(() =>
    (defaultChildAges ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );

  const childCount = Number(children) || 0;
  const policy = childPolicies?.[hotelSlug] ?? DEFAULT_CHILD_POLICY;
  const policyLines = childPolicyLines(policy);

  // One box per child, however the count moves. A box nobody has touched
  // starts at the top of the child band, which is what the server assumes for
  // a missing age — the form and the quote then agree by construction.
  const setAge = (index: number, value: string) => {
    setAges((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  // A check-out on or before check-in has no nights in it, so the search would
  // return nothing at all — nudge it forward instead of letting a guest submit
  // a stay that cannot exist.
  const submittedAges = Array.from({ length: childCount }, (_, i) =>
    String(ages[i] ?? policy.childMaxAge),
  );

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
    const query = new URLSearchParams({ checkIn, checkOut, rooms, adults, children });
    if (childCount > 0) query.set('childAges', submittedAges.join(','));
    if (room && hotelSlug === defaultHotel) query.set('room', room);
    router.push(`/book/${hotelSlug}?${query}`);
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
        {/* The day after the chosen check-in, not the day after today: a stay
            starting next month cannot check out tomorrow. */}
        <DatePicker
          bare
          label="Check out"
          value={checkOut}
          onChange={setCheckOut}
          min={dateKey(addDays(parseDateOnly(checkIn) ?? todayInIndia(), 1))}
        />
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

      {/* An age per child, because the property's brackets decide what each
          one costs: on the group default a four-year-old is free and a
          thirteen-year-old is charged as an adult. Asking here is the only
          way the quote on the next screen can be the price at the desk. */}
      {childCount > 0 && (
        <div className={compact ? 'col-span-2 lg:col-span-6' : 'sm:col-span-2 lg:col-span-3'}>
          <span className="block text-xs uppercase tracking-wider text-ink/60">
            Age of each child at check-in
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {submittedAges.map((age, index) => (
              <div
                // The boxes are a fixed list positioned by the count above
                // them; there is nothing else to key them by.
                // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity
                key={index}
                className="w-20"
              >
                <Select value={age} onValueChange={(value) => setAge(index, value)}>
                  <SelectTrigger bare />
                  <SelectContent>
                    {AGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {String(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <p className="text-xs text-ink/55">
              {policyLines.free}. {policyLines.child}.
            </p>
          </div>
        </div>
      )}

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
