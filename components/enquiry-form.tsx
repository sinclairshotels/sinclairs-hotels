'use client';

import { submitEnquiry } from '@/app/(site)/contact/actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Hotel } from '@/content/types';
import { pushDataLayerEvent } from '@/lib/analytics';
import { useActionState, useEffect, useRef, useState } from 'react';

const initialState = { status: 'idle' as const };

const ENQUIRY_TYPES = [
  { value: 'GENERAL', label: 'General Enquiry' },
  { value: 'HOTEL', label: 'Hotel Booking' },
  { value: 'WEDDING', label: 'Wedding' },
  { value: 'MEETINGS', label: 'Meetings & Events' },
];

export function EnquiryForm({
  hotels,
  defaultProperty,
  defaultType,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests,
}: {
  hotels: Hotel[];
  defaultProperty?: string;
  defaultType?: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: string;
}) {
  const [state, formAction, pending] = useActionState(submitEnquiry, initialState);
  const [property, setProperty] = useState(defaultProperty ?? '');
  const [type, setType] = useState(() => {
    const upper = defaultType?.toUpperCase();
    return ENQUIRY_TYPES.some((t) => t.value === upper) ? (upper as string) : 'GENERAL';
  });
  const formStarted = useRef(false);
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? '');
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? '');

  // biome-ignore lint/correctness/useExhaustiveDependencies: only the success transition itself should fire this, not every property/type edit
  useEffect(() => {
    if (state.status === 'success' && state.leadCaptured) {
      pushDataLayerEvent('generate_lead', { hotel: property, enquiry_type: type });
    }
  }, [state.status]);

  if (state.status === 'success') {
    return (
      <div className="rounded-lg border border-forest/20 bg-forest/5 p-8 text-center">
        <p className="font-display text-xl text-forest">Thank you</p>
        <p className="mt-2 text-sm text-ink/70">
          {state.message ?? 'Our team will be in touch shortly.'}
        </p>
      </div>
    );
  }

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form
      action={formAction}
      // Fires once, on the guest's first interaction with any field. Pairs with
      // generate_lead to give form abandonment — without it, a guest who starts
      // the form and gives up is indistinguishable from one who never looked.
      onFocusCapture={() => {
        if (formStarted.current) return;
        formStarted.current = true;
        pushDataLayerEvent('form_start', { hotel: property, enquiry_type: type });
      }}
      className="space-y-5"
    >
      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Full Name" name="name" error={fieldError('name')}>
          <input
            id="name"
            type="text"
            name="name"
            required
            className="input"
            aria-invalid={Boolean(fieldError('name'))}
          />
        </Field>
        <Field label="Email" name="email" error={fieldError('email')}>
          <input
            id="email"
            type="email"
            name="email"
            required
            className="input"
            aria-invalid={Boolean(fieldError('email'))}
          />
        </Field>
        <Field label="Phone" name="phone" error={fieldError('phone')}>
          <input
            id="phone"
            type="tel"
            name="phone"
            required
            className="input"
            aria-invalid={Boolean(fieldError('phone'))}
          />
        </Field>
        <Field label="Property" name="property" error={fieldError('property')}>
          <input type="hidden" name="property" value={property} />
          <Select value={property} onValueChange={setProperty}>
            <SelectTrigger id="property" placeholder="Select a property" />
            <SelectContent>
              {hotels.map((hotel) => (
                <SelectItem key={hotel.slug} value={hotel.slug}>
                  {hotel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Enquiry Type" name="type">
          <input type="hidden" name="type" value={type} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="type" placeholder="Select an enquiry type" />
            <SelectContent>
              {ENQUIRY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Check-in" name="checkIn">
          <input type="hidden" name="checkIn" value={checkIn} />
          <DatePicker value={checkIn} onChange={setCheckIn} placeholder="Select date" />
        </Field>
        <Field label="Check-out" name="checkOut">
          <input type="hidden" name="checkOut" value={checkOut} />
          <DatePicker
            value={checkOut}
            onChange={setCheckOut}
            min={checkIn}
            placeholder="Select date"
          />
        </Field>
        <Field label="Guests" name="guests">
          <input
            id="guests"
            type="number"
            name="guests"
            min={1}
            max={20}
            defaultValue={defaultGuests}
            className="input"
          />
        </Field>
      </div>

      <Field label="Message" name="message" error={fieldError('message')}>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          className="input"
          aria-invalid={Boolean(fieldError('message'))}
        />
      </Field>

      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-forest px-6 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Sending…' : 'Send Enquiry'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-xs uppercase tracking-wider text-ink/60">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
