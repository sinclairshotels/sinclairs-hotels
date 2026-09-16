// Pure booking arithmetic: dates, tax slabs and what a stay costs. No
// database and no Node built-ins, so the guest-facing components can import
// it and the whole of it is testable without a Postgres running.

// How long a PENDING_PAYMENT booking keeps holding its rooms. Long enough
// for a guest to finish on ICICI's page (including a bank OTP), short
// enough that an abandoned attempt frees the room without anything having
// to sweep the table — availability simply stops counting it.
export const HOLD_MINUTES = 20;

export const MAX_NIGHTS = 30;
export const MAX_ROOMS_PER_BOOKING = 5;
export const MAX_GUESTS_PER_ROOM = 4;

// How far ahead rates can be loaded and a stay booked. Bounds the date
// range every availability query scans, so a guest cannot ask for the year
// 2400 and make the server read a decade of rate rows.
export const MAX_BOOKING_HORIZON_DAYS = 500;

const MS_PER_DAY = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Date-only values are held as UTC midnight throughout (Prisma's @db.Date
// reads back the same way). Using local midnight instead would shift the
// night a rate belongs to for anyone east or west of the server.
export function parseDateOnly(value: string | undefined | null): Date | null {
  if (!value || !DATE_ONLY.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Rejects real-looking but non-existent dates ("2026-02-30"), which the
  // regex alone lets through and Date would otherwise roll forward.
  return dateKey(parsed) === value ? parsed : null;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function todayUtc(now: Date = new Date()): Date {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY);
}

// The nights a stay occupies — check-out day is not one of them, which is
// why availability is counted on [checkIn, checkOut) and never inclusive.
export function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const count = nightsBetween(checkIn, checkOut);
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(checkIn, i));
}

// GST on hotel accommodation is charged per room per night against that
// night's tariff: up to Rs 7,500 it is 12%, above that 18%. Applying the
// slab to the booking total instead would push a long stay at a cheap rate
// into the higher band, which is not how the rule works.
export const GST_SLAB_THRESHOLD = 7500;

export function gstRateFor(nightlyRate: number): number {
  return nightlyRate <= GST_SLAB_THRESHOLD ? 0.12 : 0.18;
}

export interface StayQuote {
  nights: number;
  roomTotal: number;
  taxTotal: number;
  total: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function quoteStay(nightlyRates: number[], rooms: number): StayQuote {
  const perRoom = nightlyRates.reduce((sum, rate) => sum + rate, 0);
  const perRoomTax = nightlyRates.reduce((sum, rate) => sum + rate * gstRateFor(rate), 0);
  const roomTotal = round2(perRoom * rooms);
  const taxTotal = round2(perRoomTax * rooms);

  return {
    nights: nightlyRates.length,
    roomTotal,
    taxTotal,
    total: round2(roomTotal + taxTotal),
  };
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Always rendered in UTC: the stored value is a date, not an instant, so
// letting the runtime apply a timezone would show the previous day.
export function formatStayDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const REFERENCE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY349';

// Quotable over the phone, so the alphabet drops the characters guests and
// staff mishear or mistype (0/O, 1/I, 5/S, 8/B, 2/Z). Web Crypto rather
// than node:crypto keeps this module importable from a client component.
export function bookingReference(now: Date = new Date()): string {
  const datePart = dateKey(now).slice(2).replace(/-/g, '');
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const suffix = Array.from(
    bytes,
    (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
  ).join('');
  return `SNC-${datePart}-${suffix}`;
}
