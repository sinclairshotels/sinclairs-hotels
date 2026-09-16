'use client';

import { type RateFormState, saveRates } from '@/app/admin/(dashboard)/rates/actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { addDays, dateKey, todayUtc } from '@/lib/booking';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initialState: RateFormState = { status: 'idle' };

// Sunday first, matching getUTCDay()'s own numbering so the value a checkbox
// posts is the value the action compares against.
const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

// The sellable shape of a property, built from the database rather than the
// content files: inventory hangs off a room type row and price off a rate
// plan row, so the form has to post their ids.
export interface LoadableProperty {
  slug: string;
  name: string;
  roomTypes: Array<{
    id: string;
    name: string;
    ratePlans: Array<{ id: string; name: string }>;
  }>;
}

export function RateGridForm({ properties }: { properties: LoadableProperty[] }) {
  const [state, formAction, pending] = useActionState(saveRates, initialState);
  const router = useRouter();
  const today = dateKey(todayUtc());

  const [hotelSlug, setHotelSlug] = useState(properties[0]?.slug ?? '');
  const [roomTypeId, setRoomTypeId] = useState(properties[0]?.roomTypes[0]?.id ?? '');
  const [ratePlanId, setRatePlanId] = useState(properties[0]?.roomTypes[0]?.ratePlans[0]?.id ?? '');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(dateKey(addDays(todayUtc(), 30)));

  const rooms = properties.find((property) => property.slug === hotelSlug)?.roomTypes ?? [];

  // Derived, not trusted from state: changing the property swaps the room
  // Select's whole item set, and a controlled Radix Select whose value is no
  // longer among its items reports back an empty value. Reconciling here means
  // the posted room and plan are always ones this property actually has,
  // whatever the Selects do in between — before this, picking a different
  // property posted an empty room and the loader rejected its own form.
  const selectedRoomId = rooms.some((room) => room.id === roomTypeId)
    ? roomTypeId
    : (rooms[0]?.id ?? '');
  const plans = rooms.find((room) => room.id === selectedRoomId)?.ratePlans ?? [];
  const selectedPlanId = plans.some((plan) => plan.id === ratePlanId)
    ? ratePlanId
    : (plans[0]?.id ?? '');

  useEffect(() => {
    if (state.status === 'success') router.refresh();
  }, [state.status, router]);

  // Room types belong to a property, so changing the property resets the room:
  // leaving the old one selected would submit a room name the new hotel does
  // not have, which the action rejects.
  const handleHotel = (slug: string) => {
    const property = properties.find((p) => p.slug === slug);
    setHotelSlug(slug);
    setRoomTypeId(property?.roomTypes[0]?.id ?? '');
    setRatePlanId(property?.roomTypes[0]?.ratePlans[0]?.id ?? '');
  };

  const handleRoom = (id: string) => {
    setRoomTypeId(id);
    setRatePlanId(rooms.find((room) => room.id === id)?.ratePlans[0]?.id ?? '');
  };

  if (state.status === 'preview' && state.preview) {
    return <PreviewStep preview={state.preview} formAction={formAction} pending={pending} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hotelSlug" value={hotelSlug} />
      <input type="hidden" name="roomTypeId" value={selectedRoomId} />
      <input type="hidden" name="ratePlanId" value={selectedPlanId} />
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
              {properties.map((property) => (
                <SelectItem key={property.slug} value={property.slug}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Room Type">
          {/* Keyed on the property so the Select is rebuilt rather than
              handed a new item set, which is what confused it. */}
          <Select key={hotelSlug} value={selectedRoomId} onValueChange={handleRoom}>
            <SelectTrigger />
            <SelectContent>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Rate Plan">
          <Select key={selectedRoomId} value={selectedPlanId} onValueChange={setRatePlanId}>
            <SelectTrigger />
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
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

      <fieldset>
        <legend className="text-xs uppercase tracking-wider text-ink/60">Apply to</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label
              key={day.value}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition has-[:checked]:border-forest has-[:checked]:bg-forest/5 has-[:checked]:text-forest"
            >
              <input type="checkbox" name="weekdays" value={day.value} className="h-3.5 w-3.5" />
              {day.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink/50">
          Leave all unticked for every night in the range — ticking days narrows it, so a weekend
          rate is Fri + Sat over the whole season rather than a separate load per weekend.
        </p>
      </fieldset>

      <label className="flex items-start gap-3 text-sm text-ink/70">
        <input type="checkbox" name="closed" className="mt-0.5" />
        <span>
          <span className="font-medium text-ink">Stop sell</span> — keep the rate loaded but take
          these nights off sale.
        </span>
      </label>

      <p className="text-xs leading-relaxed text-ink/50">
        This replaces whatever is currently loaded for that room across the nights you pick,
        inclusive of both dates. Rooms on sale is the allotment this website may sell — hold it back
        in STAAH so the same room is not sold twice.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'Review Changes'}
      </button>
    </form>
  );
}

// The submitted values come back as hidden fields rather than being re-read
// from the form, so what staff confirm is exactly what was previewed — not
// whatever the inputs hold by the time they click.
function PreviewStep({
  preview,
  formAction,
  pending,
}: {
  preview: NonNullable<RateFormState['preview']>;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const unchanged = preview.existing - preview.changing;
  const fresh = preview.nights - preview.existing;

  return (
    <form action={formAction} className="space-y-4">
      {/* Every field the action needs, echoed from the preview it produced —
          so the confirmed write is exactly the one that was described. */}
      <input type="hidden" name="hotelSlug" value={preview.hotelSlug} />
      <input type="hidden" name="roomTypeId" value={preview.roomTypeId} />
      <input type="hidden" name="ratePlanId" value={preview.ratePlanId} />
      <input type="hidden" name="from" value={preview.firstNight} />
      <input type="hidden" name="to" value={preview.lastNight} />
      <input type="hidden" name="rate" value={preview.rate} />
      <input type="hidden" name="totalRooms" value={preview.totalRooms} />
      {preview.closed && <input type="hidden" name="closed" value="on" />}
      {preview.weekdays.map((day) => (
        <input key={day} type="hidden" name="weekdays" value={day} />
      ))}
      <input type="hidden" name="confirmed" value="on" />

      <div className="rounded-lg border border-gold/40 bg-gold/5 p-5">
        <p className="font-display text-lg text-forest">Confirm this change</p>
        <p className="mt-1 text-sm text-ink/70">
          {preview.hotelName} — {preview.roomTypeName} · {preview.ratePlanName}
        </p>

        <dl className="mt-4 space-y-1.5 border-t border-ink/10 pt-4 text-sm">
          <Row label="Nights being written" value={String(preview.nights)} />
          <Row
            label="Already loaded"
            value={`${preview.existing} (${preview.changing} with different values, ${unchanged} unchanged)`}
          />
          <Row label="Newly loaded" value={String(fresh)} />
          <Row
            label="Days"
            value={
              preview.weekdays.length === 0
                ? 'Every night in the range'
                : preview.weekdays
                    .slice()
                    .sort((a, b) => a - b)
                    .map((day) => WEEKDAYS[day]?.label)
                    .join(', ')
            }
          />
          <Row
            label="New values"
            value={`₹${preview.rate.toLocaleString('en-IN')} · ${preview.totalRooms} on sale${
              preview.closed ? ' · stop sell' : ''
            }`}
          />
        </dl>

        {preview.changing > 0 && (
          <p className="mt-4 rounded border border-gold/50 bg-white px-3 py-2 text-xs text-ink/70">
            {preview.changing} {preview.changing === 1 ? 'night is' : 'nights are'} currently loaded
            at different values and will be overwritten. This cannot be undone from here — it is
            recorded in the change log below.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending
            ? 'Saving…'
            : `Save ${preview.nights} ${preview.nights === 1 ? 'Night' : 'Nights'}`}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-ink/50 transition hover:text-ink"
        >
          Start over
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink/60">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
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
