import { z } from 'zod';

// A guest address, written and read in one place.
//
// It is stored as a single text column — `Booking.billingAddress`,
// `Voucher.billingAddress` — because that is what it was before it had fields,
// and every existing row is free text nobody is going to re-key. So the shape
// lives here instead: the form writes it, `cityOf` reads it back, and the two
// are tested against each other. Split the column and this module goes away.

export interface AddressParts {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pin: string;
  country: string;
}

export const DEFAULT_COUNTRY = 'India';

// State and PIN share a line on purpose: it is how an envelope is written, and
// it makes the city the third line from the bottom whether or not the optional
// second line is there — which is what lets `cityOf` find it again.
export function formatAddress(parts: AddressParts): string {
  return [
    parts.line1.trim(),
    parts.line2?.trim(),
    parts.city.trim(),
    [parts.state.trim(), parts.pin.trim()].filter(Boolean).join(' - '),
    parts.country.trim(),
  ]
    .filter((line) => Boolean(line))
    .join('\n');
}

// The city, for a report. Legacy rows and hand-typed addresses do not have the
// shape at all, and a wrong city in a spreadsheet is worse than an empty cell,
// so anything shorter than the three lines this writes says nothing.
export function cityOf(address: string): string {
  const lines = address
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3) return '';
  return lines[lines.length - 3] ?? '';
}

// India's PIN is six digits and never starts with a zero. Loose enough for a
// foreign postcode, because the country field is not fixed to India.
const PIN = /^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$/;

export const addressSchema = z.object({
  addressLine1: z.string().trim().min(3, 'Please enter the street address').max(120),
  addressLine2: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Please enter a city').max(80),
  state: z.string().trim().min(2, 'Please enter a state').max(80),
  pin: z.string().trim().regex(PIN, 'Please enter a valid PIN or postal code').max(12),
  country: z.string().trim().min(2, 'Please enter a country').max(80),
});

export type AddressInput = z.infer<typeof addressSchema>;

export function addressFromInput(input: AddressInput): string {
  return formatAddress({
    line1: input.addressLine1,
    line2: input.addressLine2 || undefined,
    city: input.city,
    state: input.state,
    pin: input.pin,
    country: input.country,
  });
}
