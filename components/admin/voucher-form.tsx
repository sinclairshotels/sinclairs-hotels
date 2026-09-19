'use client';

import { createVoucher } from '@/app/admin/(dashboard)/vouchers/actions';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { BookingOffice, Hotel } from '@/content/types';
import { useActionState, useState } from 'react';

const initialState = { status: 'idle' as const };

export function VoucherForm({
  hotels,
  bookingOffices,
}: { hotels: Hotel[]; bookingOffices: BookingOffice[] }) {
  const [state, formAction, pending] = useActionState(createVoucher, initialState);
  const [hotelSlug, setHotelSlug] = useState('');
  const [bookingOffice, setBookingOffice] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [depositReceiptDate, setDepositReceiptDate] = useState('');

  if (state.status === 'success') {
    return (
      <div className="rounded-lg border border-forest/20 bg-forest/5 p-8 text-center">
        <p className="font-display text-xl text-forest">Voucher Sent</p>
        <p className="mt-2 text-sm text-ink/70">{state.message}</p>
        <a href="/admin/vouchers" className="mt-4 inline-block text-sm text-forest underline">
          Back to voucher list
        </a>
      </div>
    );
  }

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-8">
      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-xs uppercase tracking-widest text-gold-dark">Booking</legend>
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
        <Field label="Booking Office" name="bookingOffice" error={fieldError('bookingOffice')}>
          <input type="hidden" name="bookingOffice" value={bookingOffice} />
          <Select value={bookingOffice} onValueChange={setBookingOffice}>
            <SelectTrigger id="bookingOffice" placeholder="Select a booking office" />
            <SelectContent>
              {bookingOffices.map((office) => (
                <SelectItem key={office.name} value={office.name}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Check-in" name="checkIn" error={fieldError('checkIn')}>
          <input type="hidden" name="checkIn" value={checkIn} />
          <DatePicker value={checkIn} onChange={setCheckIn} placeholder="Select date" />
        </Field>
        <Field label="Check-out" name="checkOut" error={fieldError('checkOut')}>
          <input type="hidden" name="checkOut" value={checkOut} />
          <DatePicker
            value={checkOut}
            onChange={setCheckOut}
            min={checkIn}
            placeholder="Select date"
          />
        </Field>
        <Field label="No. of Rooms" name="rooms" error={fieldError('rooms')}>
          <input
            id="rooms"
            type="number"
            name="rooms"
            min={1}
            max={50}
            required
            className="input"
          />
        </Field>
        <Field label="Rate (₹)" name="rate" error={fieldError('rate')}>
          <input
            id="rate"
            type="number"
            name="rate"
            min={0}
            step="0.01"
            required
            className="input"
          />
        </Field>
        <Field label="Taxes / GST (₹)" name="taxes" error={fieldError('taxes')}>
          <input
            id="taxes"
            type="number"
            name="taxes"
            min={0}
            step="0.01"
            required
            className="input"
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-xs uppercase tracking-widest text-gold-dark">Guest</legend>
        <Field label="Guest Name" name="guestName" error={fieldError('guestName')}>
          <input id="guestName" type="text" name="guestName" required className="input" />
        </Field>
        <Field label="Guest Phone" name="guestPhone" error={fieldError('guestPhone')}>
          <input id="guestPhone" type="tel" name="guestPhone" required className="input" />
        </Field>
        <Field label="Guest Email" name="guestEmail" error={fieldError('guestEmail')}>
          <input id="guestEmail" type="email" name="guestEmail" required className="input" />
        </Field>
        <Field label="Billing Address" name="billingAddress" error={fieldError('billingAddress')}>
          <textarea id="billingAddress" name="billingAddress" rows={2} required className="input" />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-xs uppercase tracking-widest text-gold-dark">
          Travel Agent (optional)
        </legend>
        <Field label="Travel Agent Name" name="travelAgentName">
          <input id="travelAgentName" type="text" name="travelAgentName" className="input" />
        </Field>
        <Field label="Agent State" name="travelAgentState">
          <input id="travelAgentState" type="text" name="travelAgentState" className="input" />
        </Field>
        <Field label="Agent PAN" name="travelAgentPan">
          <input id="travelAgentPan" type="text" name="travelAgentPan" className="input" />
        </Field>
        <Field label="Agent GSTIN" name="travelAgentGstin">
          <input id="travelAgentGstin" type="text" name="travelAgentGstin" className="input" />
        </Field>
        <Field label="Commission (%)" name="commissionPct">
          <input
            id="commissionPct"
            type="number"
            name="commissionPct"
            min={0}
            max={100}
            step="0.01"
            className="input"
          />
        </Field>
        <Field label="TDS (%)" name="tdsPct">
          <input
            id="tdsPct"
            type="number"
            name="tdsPct"
            min={0}
            max={100}
            step="0.01"
            className="input"
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-xs uppercase tracking-widest text-gold-dark">
          Deposit &amp; Billing (optional)
        </legend>
        <Field label="Deposit Amount (₹)" name="depositAmount">
          <input
            id="depositAmount"
            type="number"
            name="depositAmount"
            min={0}
            step="0.01"
            className="input"
          />
        </Field>
        <Field label="Deposit Receipt No." name="depositReceiptNo">
          <input id="depositReceiptNo" type="text" name="depositReceiptNo" className="input" />
        </Field>
        <Field label="Receipt Date" name="depositReceiptDate">
          <input type="hidden" name="depositReceiptDate" value={depositReceiptDate} />
          <DatePicker
            value={depositReceiptDate}
            onChange={setDepositReceiptDate}
            placeholder="Select date"
          />
        </Field>
        <Field label="Billing Instructions" name="billingInstructions">
          <textarea
            id="billingInstructions"
            name="billingInstructions"
            rows={2}
            className="input"
          />
        </Field>
        <Field label="Arrival Details" name="arrivalDetails">
          <textarea id="arrivalDetails" name="arrivalDetails" rows={2} className="input" />
        </Field>
        <Field label="Other Services" name="otherServices">
          <textarea id="otherServices" name="otherServices" rows={2} className="input" />
        </Field>
        <Field label="Details to Unit (internal only)" name="specialInstructions">
          <textarea
            id="specialInstructions"
            name="specialInstructions"
            rows={2}
            className="input"
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <legend className="mb-2 text-xs uppercase tracking-widest text-gold-dark">Issued By</legend>
        <Field label="Your Name" name="issuerName" error={fieldError('issuerName')}>
          <input id="issuerName" type="text" name="issuerName" required className="input" />
        </Field>
        <Field label="Your Phone" name="issuerPhone" error={fieldError('issuerPhone')}>
          <input id="issuerPhone" type="tel" name="issuerPhone" required className="input" />
        </Field>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-forest px-6 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Creating…' : 'Create & Send Voucher'}
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
