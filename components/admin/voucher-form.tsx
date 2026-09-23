'use client';

import { createVoucher } from '@/app/admin/(dashboard)/vouchers/actions';
import { AddressFields } from '@/components/address-fields';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { BookingOffice, Hotel } from '@/content/types';
import { useActionState, useState } from 'react';

const initialState = { status: 'idle' as const };

// Four sections, each a two-column table of label and field. The fields used
// to run one to a line down the page, which made a voucher — twenty-odd
// fields — a scroll rather than a form somebody fills in while a guest is on
// the phone.
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
          Back to vouchers
        </a>
      </div>
    );
  }

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];
  const text = (name: string, label: string, props: Record<string, unknown> = {}) => (
    <Row label={label} name={name} error={fieldError(name)}>
      <input id={name} name={name} type="text" className="input" {...props} />
    </Row>
  );
  const number = (name: string, label: string, props: Record<string, unknown> = {}) => (
    <Row label={label} name={name} error={fieldError(name)}>
      <input id={name} name={name} type="number" min={0} className="input" {...props} />
    </Row>
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <Section title="Guest">
        {text('guestName', 'Name', { required: true })}
        {text('guestPhone', 'Phone', { type: 'tel', required: true })}
        {text('guestEmail', 'Email', { type: 'email', required: true })}
        <AddressFields
          Field={Row}
          autoComplete={false}
          errors={{
            addressLine1: fieldError('addressLine1'),
            addressLine2: fieldError('addressLine2'),
            city: fieldError('city'),
            state: fieldError('state'),
            pin: fieldError('pin'),
            country: fieldError('country'),
          }}
        />
      </Section>

      <Section title="Stay">
        <Row label="Hotel" name="hotelSlug" error={fieldError('hotelSlug')}>
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
        </Row>
        <Row label="Booking office" name="bookingOffice" error={fieldError('bookingOffice')}>
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
        </Row>
        <Row label="Check-in" name="checkIn" error={fieldError('checkIn')}>
          <input type="hidden" name="checkIn" value={checkIn} />
          <DatePicker value={checkIn} onChange={setCheckIn} label="Check-in date" />
        </Row>
        <Row label="Check-out" name="checkOut" error={fieldError('checkOut')}>
          <input type="hidden" name="checkOut" value={checkOut} />
          <DatePicker
            value={checkOut}
            onChange={setCheckOut}
            min={checkIn}
            label="Check-out date"
          />
        </Row>
        {number('rooms', 'Rooms', { min: 1, max: 50, required: true })}
        {text('arrivalDetails', 'Arrival details')}
      </Section>

      <Section title="Amounts">
        {number('rate', 'Rate ₹', { step: '0.01', required: true })}
        {number('taxes', 'Taxes / GST ₹', { step: '0.01', required: true })}
        {number('depositAmount', 'Deposit ₹', { step: '0.01' })}
        {text('depositReceiptNo', 'Receipt no.')}
        <Row label="Receipt date" name="depositReceiptDate">
          <input type="hidden" name="depositReceiptDate" value={depositReceiptDate} />
          <DatePicker
            value={depositReceiptDate}
            onChange={setDepositReceiptDate}
            label="Deposit receipt date"
          />
        </Row>
        {text('travelAgentName', 'Agent name')}
        {text('travelAgentState', 'Agent state')}
        {text('travelAgentPan', 'Agent PAN')}
        {text('travelAgentGstin', 'Agent GSTIN')}
        {number('commissionPct', 'Commission %', { max: 100, step: '0.01' })}
        {number('tdsPct', 'TDS %', { max: 100, step: '0.01' })}
      </Section>

      <Section title="Notes">
        <Row label="Billing instructions" name="billingInstructions">
          <textarea
            id="billingInstructions"
            name="billingInstructions"
            rows={2}
            className="input"
          />
        </Row>
        <Row label="Other services" name="otherServices">
          <textarea id="otherServices" name="otherServices" rows={2} className="input" />
        </Row>
        {/* Named as what it is: this one is not printed on the guest's copy. */}
        <Row label="To the unit (internal)" name="specialInstructions">
          <textarea
            id="specialInstructions"
            name="specialInstructions"
            rows={2}
            className="input"
          />
        </Row>
        {text('issuerName', 'Issued by', { required: true })}
        {text('issuerPhone', 'Issuer phone', { type: 'tel', required: true })}
      </Section>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-ink/10 bg-white p-4">
      <legend className="px-1 text-xs uppercase tracking-widest text-gold-dark">{title}</legend>
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">{children}</div>
    </fieldset>
  );
}

// Label beside the field rather than above it: it is what halves the height,
// and a voucher has enough fields for that to be the difference between one
// screen and three.
function Row({
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
    <div className="grid grid-cols-[9rem_1fr] items-baseline gap-3 py-1">
      <label htmlFor={name} className="text-xs uppercase tracking-wider text-ink/55">
        {label}
      </label>
      <div>
        {children}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
