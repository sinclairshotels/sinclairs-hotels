'use client';

import { type BookingFormState, createBooking } from '@/app/(site)/book/actions';
import { directBookingPerk } from '@/content/site';
import { pushDataLayerEvent } from '@/lib/analytics';
import { cancellationSentence } from '@/lib/cancellation';
import type { BookingRateType } from '@prisma/client';
import { useActionState, useRef } from 'react';

const initialState: BookingFormState = { status: 'idle' };

export interface StayFields {
  hotelSlug: string;
  roomTypeId: string;
  ratePlanId: string;
  rateType: BookingRateType;
  cancellationDeadline: Date | null;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
}

// The stay itself rides along in hidden fields and is re-validated and
// re-priced server-side (see app/(site)/book/actions.ts) — nothing here is
// trusted, least of all the total, which is never posted at all.
export function BookingGuestForm({ stay }: { stay: StayFields }) {
  const [state, formAction, pending] = useActionState(createBooking, initialState);
  const formStarted = useRef(false);

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];
  // React resets the form once the action resolves, and the reset restores
  // these defaults — which is why the rejected values have to come back from
  // the server rather than be held in the DOM.
  const typed = (field: keyof NonNullable<BookingFormState['values']>) =>
    state.values?.[field] ?? '';

  return (
    <form
      action={formAction}
      onFocusCapture={() => {
        if (formStarted.current) return;
        formStarted.current = true;
        pushDataLayerEvent('form_start', { hotel: stay.hotelSlug, form: 'booking' });
      }}
      className="space-y-5"
    >
      <input type="hidden" name="hotelSlug" value={stay.hotelSlug} />
      <input type="hidden" name="roomTypeId" value={stay.roomTypeId} />
      <input type="hidden" name="ratePlanId" value={stay.ratePlanId} />
      <input type="hidden" name="rateType" value={stay.rateType} />
      <input type="hidden" name="checkIn" value={stay.checkIn} />
      <input type="hidden" name="checkOut" value={stay.checkOut} />
      <input type="hidden" name="rooms" value={stay.rooms} />
      <input type="hidden" name="adults" value={stay.adults} />
      <input type="hidden" name="children" value={stay.children} />

      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Full Name" name="guestName" error={fieldError('guestName')}>
          <input
            id="guestName"
            name="guestName"
            type="text"
            required
            autoComplete="name"
            defaultValue={typed('guestName')}
            className="input"
          />
        </Field>

        <Field label="Email" name="guestEmail" error={fieldError('guestEmail')}>
          <input
            id="guestEmail"
            name="guestEmail"
            type="email"
            required
            autoComplete="email"
            defaultValue={typed('guestEmail')}
            className="input"
          />
        </Field>

        <Field label="Phone" name="guestPhone" error={fieldError('guestPhone')}>
          <input
            id="guestPhone"
            name="guestPhone"
            type="tel"
            required
            autoComplete="tel"
            defaultValue={typed('guestPhone')}
            className="input"
          />
        </Field>

        <Field label="Billing Address" name="billingAddress" error={fieldError('billingAddress')}>
          <input
            id="billingAddress"
            name="billingAddress"
            type="text"
            required
            autoComplete="street-address"
            defaultValue={typed('billingAddress')}
            className="input"
          />
        </Field>
      </div>

      <Field
        label="Special Requests (optional)"
        name="specialRequests"
        error={fieldError('specialRequests')}
      >
        <textarea
          id="specialRequests"
          name="specialRequests"
          rows={3}
          defaultValue={typed('specialRequests')}
          className="input"
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
        className="w-full rounded bg-forest px-6 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
      >
        {pending ? 'Taking you to payment…' : 'Pay & Confirm Booking'}
      </button>

      <p className="text-center text-xs leading-relaxed text-ink/50">
        You&rsquo;ll be taken to ICICI Bank&rsquo;s secure payment page. Your room is held while you
        pay and confirmed the moment the payment clears.
      </p>
      <p className="text-center text-xs font-medium leading-relaxed text-ink/70">
        {directBookingPerk.long} {cancellationSentence(stay.rateType, stay.cancellationDeadline)}
      </p>
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
