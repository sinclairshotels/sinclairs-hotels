'use client';

import { type IpayFormState, initiatePayment } from '@/app/(site)/ipay/actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { Hotel } from '@/content/types';
import { hotelItem, pushEcommerceEvent } from '@/lib/analytics';
import { useActionState, useState } from 'react';

const initialState: IpayFormState = { status: 'idle' };

export function IpayForm({ hotels }: { hotels: Hotel[] }) {
  const [state, formAction, pending] = useActionState(initiatePayment, initialState);
  const [hotelSlug, setHotelSlug] = useState('');
  const [amount, setAmount] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form
      action={formAction}
      onSubmit={() => {
        // The order id only exists after the server action runs, so this reports
        // the attempt without one. Its job is the denominator for payment
        // abandonment: add_payment_info minus (purchase + payment_failed).
        const value = Number(amount) || 0;
        const name = hotels.find((hotel) => hotel.slug === hotelSlug)?.name ?? hotelSlug;
        pushEcommerceEvent(
          'add_payment_info',
          {
            value,
            currency: 'INR',
            items: [hotelItem(hotelSlug, name, { price: value, quantity: 1 })],
          },
          { hotel: hotelSlug },
        );
      }}
      className="space-y-5"
    >
      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Hotel" name="hotelSlug" error={fieldError('hotelSlug')}>
          <input type="hidden" name="hotelSlug" value={hotelSlug} />
          <Select value={hotelSlug} onValueChange={setHotelSlug}>
            <SelectTrigger id="hotelSlug" placeholder="Select a hotel" />
            <SelectContent>
              {hotels.map((hotel) => (
                <SelectItem key={hotel.slug} value={hotel.slug}>
                  {hotel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Amount (₹)" name="amount" error={fieldError('amount')}>
          <input
            id="amount"
            type="number"
            name="amount"
            min={1}
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="input"
            aria-invalid={Boolean(fieldError('amount'))}
          />
        </Field>
        <Field label="Full Name" name="guestName" error={fieldError('guestName')}>
          <input
            id="guestName"
            type="text"
            name="guestName"
            required
            className="input"
            aria-invalid={Boolean(fieldError('guestName'))}
          />
        </Field>
        <Field label="Email" name="guestEmail" error={fieldError('guestEmail')}>
          <input
            id="guestEmail"
            type="email"
            name="guestEmail"
            required
            className="input"
            aria-invalid={Boolean(fieldError('guestEmail'))}
          />
        </Field>
        <Field label="Mobile Number" name="guestPhone" error={fieldError('guestPhone')}>
          <input
            id="guestPhone"
            type="tel"
            name="guestPhone"
            required
            className="input"
            aria-invalid={Boolean(fieldError('guestPhone'))}
          />
        </Field>
        <Field label="Reservation No. (if any)" name="reservationNo">
          <input id="reservationNo" type="text" name="reservationNo" className="input" />
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
      </div>

      <Field label="Address" name="billingAddress">
        <textarea id="billingAddress" name="billingAddress" rows={2} className="input" />
      </Field>

      <Field label="Remark" name="remark">
        <textarea
          id="remark"
          name="remark"
          rows={2}
          placeholder="Special instructions..."
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
        className="w-full rounded bg-gold px-6 py-3 text-sm uppercase tracking-wider text-forest transition hover:bg-gold-light disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Processing…' : 'Proceed to Pay'}
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
