'use client';

import { submitEnquiry } from '@/app/(site)/contact/actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Hotel } from '@/content/types';
import { pushDataLayerEvent } from '@/lib/analytics';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';

const initialState = { status: 'idle' as const };

// What the guest is asking about decides what they are asked. The stored enum
// keeps its old names so the 35,837 imported rows and every saved filter still
// mean what they did; only the labels changed.
const ENQUIRY_TYPES = [
  { value: 'HOTEL', label: 'Rooms' },
  { value: 'WEDDING', label: 'Wedding' },
  { value: 'MEETINGS', label: 'Meeting or event' },
  { value: 'GROUP', label: 'Group stay' },
  { value: 'GENERAL', label: 'Something else' },
] as const;

type EnquiryType = (typeof ENQUIRY_TYPES)[number]['value'];

const EVENT_TYPES: EnquiryType[] = ['WEDDING', 'MEETINGS'];

const FLEXIBILITY = ['Not flexible', '± 3 days', '± 1 week', '± 2 weeks', '± 1 month'];

const REPLY_CHANNELS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'EMAIL', label: 'Email' },
];

// India first because almost every enquiry is domestic; the rest are the
// origins the properties actually see.
const COUNTRY_CODES = ['+91', '+44', '+1', '+61', '+65', '+971', '+977', '+975'];

const MESSAGE_LABEL: Record<EnquiryType, string> = {
  HOTEL: 'What do you need?',
  WEDDING: 'Tell us about the occasion',
  MEETINGS: 'Tell us about the event',
  GROUP: 'Tell us about the group',
  GENERAL: 'How can we help?',
};

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
  const [type, setType] = useState<EnquiryType>(() => {
    const upper = defaultType?.toUpperCase();
    return ENQUIRY_TYPES.some((t) => t.value === upper) ? (upper as EnquiryType) : 'HOTEL';
  });
  const formStarted = useRef(false);
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? '');
  const [checkOut, setCheckOut] = useState(defaultCheckOut ?? '');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [flexibility, setFlexibility] = useState(FLEXIBILITY[1] as string);
  const [replyChannel, setReplyChannel] = useState('WHATSAPP');

  const isEvent = EVENT_TYPES.includes(type);
  const isGroup = type === 'GROUP';

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
        {state.reference && (
          <>
            <p className="mt-4 text-xs uppercase tracking-wider text-ink/50">Your reference</p>
            <p className="font-display text-2xl tracking-wide text-forest">{state.reference}</p>
          </>
        )}
        <p className="mt-4 text-sm text-ink/70">
          We reply within one working day, Monday to Saturday.
        </p>
      </div>
    );
  }

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <div>
      <fieldset
        className="mb-6"
        // The chips are the first decision, so they are a labelled group rather
        // than five loose buttons a screen reader meets one at a time.
      >
        <legend className="text-xs uppercase tracking-wider text-ink/60">What is it about?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ENQUIRY_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={type === option.value}
              onClick={() => setType(option.value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                type === option.value
                  ? 'border-forest bg-forest text-cream'
                  : 'border-ink/20 bg-white text-ink/70 hover:border-forest hover:text-forest'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* A room enquiry is a slower, worse version of the booking engine for
          both sides, so say so before they fill anything in. */}
      {type === 'HOTEL' && (
        <p className="mb-6 rounded border border-gold/50 bg-gold/10 px-4 py-3 text-sm text-forest">
          Booking rooms?{' '}
          <Link href="/book" className="font-medium underline hover:text-forest-dark">
            Book online for live prices
          </Link>{' '}
          and instant confirmation — no waiting for a reply.
        </p>
      )}

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

        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="phone" value={`${countryCode} ${phoneNumber}`.trim()} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Your name" name="name" error={fieldError('name')}>
            <input
              id="name"
              type="text"
              name="name"
              required
              autoComplete="name"
              className="input"
              aria-invalid={Boolean(fieldError('name'))}
            />
          </Field>

          <Field label="Phone" name="phoneNumber" error={fieldError('phone')}>
            <div className="flex gap-2">
              <div className="w-24 shrink-0">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger aria-label="Country dialling code" />
                  <SelectContent>
                    {COUNTRY_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <input
                id="phoneNumber"
                type="tel"
                required
                autoComplete="tel-national"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                className="input flex-1"
                aria-invalid={Boolean(fieldError('phone'))}
              />
            </div>
          </Field>

          <Field label="Email" name="email" error={fieldError('email')}>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              className="input"
              aria-invalid={Boolean(fieldError('email'))}
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

          <Field label="City" name="city" error={fieldError('city')}>
            <input
              id="city"
              type="text"
              name="city"
              autoComplete="address-level2"
              className="input"
              aria-invalid={Boolean(fieldError('city'))}
            />
          </Field>

          <Field label="PIN code" name="pinCode" error={fieldError('pinCode')}>
            <input
              id="pinCode"
              type="text"
              name="pinCode"
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              className="input"
              aria-invalid={Boolean(fieldError('pinCode'))}
            />
          </Field>

          {isEvent && (
            <>
              <Field label="Event date" name="checkIn">
                <input type="hidden" name="checkIn" value={checkIn} />
                <DatePicker
                  value={checkIn}
                  onChange={setCheckIn}
                  label="Event date"
                  placeholder="Select date"
                />
              </Field>
              <Field label="Flexible by" name="flexibility">
                <input type="hidden" name="flexibility" value={flexibility} />
                <Select value={flexibility} onValueChange={setFlexibility}>
                  <SelectTrigger id="flexibility" />
                  <SelectContent>
                    {FLEXIBILITY.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {isGroup && (
            <>
              <Field label="Check-in" name="checkIn">
                <input type="hidden" name="checkIn" value={checkIn} />
                <DatePicker
                  value={checkIn}
                  onChange={setCheckIn}
                  label="Check-in"
                  placeholder="Select date"
                />
              </Field>
              <Field label="Check-out" name="checkOut">
                <input type="hidden" name="checkOut" value={checkOut} />
                <DatePicker
                  value={checkOut}
                  onChange={setCheckOut}
                  min={checkIn}
                  label="Check-out"
                  placeholder="Select date"
                />
              </Field>
            </>
          )}

          {(isEvent || isGroup) && (
            <>
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
              <Field label="Rooms needed" name="roomsNeeded" error={fieldError('roomsNeeded')}>
                <input
                  id="roomsNeeded"
                  type="number"
                  name="roomsNeeded"
                  min={1}
                  max={400}
                  className="input"
                  aria-invalid={Boolean(fieldError('roomsNeeded'))}
                />
              </Field>
            </>
          )}
        </div>

        <Field label={MESSAGE_LABEL[type]} name="message" error={fieldError('message')}>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            className="input"
            aria-invalid={Boolean(fieldError('message'))}
          />
        </Field>

        <div className="sm:w-1/2">
          <Field label="How should we reply?" name="replyChannel">
            <input type="hidden" name="replyChannel" value={replyChannel} />
            <Select value={replyChannel} onValueChange={setReplyChannel}>
              <SelectTrigger id="replyChannel" />
              <SelectContent>
                {REPLY_CHANNELS.map((channel) => (
                  <SelectItem key={channel.value} value={channel.value}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

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

        <p className="text-xs leading-relaxed text-ink/50">
          We reply within one working day, Monday to Saturday. Your details are used only to answer
          this enquiry. No spam, no lists.
        </p>
      </form>
    </div>
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
