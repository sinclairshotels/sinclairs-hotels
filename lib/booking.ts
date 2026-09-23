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

// GST on hotel accommodation is a slab, charged per room per night against
// that night's rate rather than against the booking total: a stay priced
// below the threshold on weeknights and above it at the weekend pays both
// rates inside one booking. The threshold is inclusive — a night at exactly
// the threshold takes the lower rate.
export interface TaxSlab {
  threshold: number;
  lowRate: number;
  highRate: number;
}

// What the slab was before it became editable, and the fallback when no
// setting has been saved. Finance confirmed 5% up to ₹7,500 and 18% above,
// effective 22 September 2025.
export const DEFAULT_TAX_SLAB: TaxSlab = { threshold: 7500, lowRate: 0.05, highRate: 0.18 };

export function taxForNight(rate: number, slab: TaxSlab = DEFAULT_TAX_SLAB): number {
  return rate * (rate <= slab.threshold ? slab.lowRate : slab.highRate);
}

export interface StayQuote {
  nights: number;
  roomTotal: number;
  taxTotal: number;
  total: number;
  // What the extra guests beyond the rooms' base occupancy added, across the
  // whole stay. Already inside roomTotal; carried separately so a quote can
  // show its working.
  extrasTotal: number;
  extraAdults: number;
  extraChildren: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface RoomExtras {
  extraAdults: number;
  extraChildren: number;
}

// The rate covers baseOccupancy guests in each room booked. Adults take those
// places first and children fill what is left; whoever is still standing is an
// extra, spread evenly so two rooms with one extra guest between them do not
// both get charged for one.
export function allocateExtras(
  rooms: number,
  adults: number,
  children: number,
  baseOccupancy: number,
): RoomExtras[] {
  const seats = Array.from({ length: Math.max(1, rooms) }, () => baseOccupancy);
  const extras: RoomExtras[] = seats.map(() => ({ extraAdults: 0, extraChildren: 0 }));
  let cursor = 0;

  const place = (count: number, key: keyof RoomExtras) => {
    for (let placed = 0; placed < count; placed += 1) {
      const room = seats.findIndex((free) => free > 0);
      if (room >= 0) {
        seats[room] = (seats[room] as number) - 1;
        continue;
      }
      (extras[cursor % extras.length] as RoomExtras)[key] += 1;
      cursor += 1;
    }
  };

  place(adults, 'extraAdults');
  place(children, 'extraChildren');
  return extras;
}

export interface StayPricing {
  // Per room per night, already carrying the plan's own inclusions — on With
  // Breakfast that is the room rate plus breakfast for the base guests.
  nightlyRates: number[];
  rooms: number;
  adults: number;
  children: number;
  baseOccupancy: number;
  extraAdultCharge: number;
  extraChildCharge: number;
  // What one more guest's breakfast costs. Zero on Room Only, which is the
  // whole difference between the two plans for an extra guest.
  breakfastPerExtraGuest: number;
  slab?: TaxSlab;
}

// Tax is per room per night against that night's whole value — the rate plus
// whatever the extra guests in that room add — so a room pushed over the
// threshold by its third guest is taxed as the room it actually is.
export function quoteStay(pricing: StayPricing): StayQuote {
  const {
    nightlyRates,
    rooms,
    adults,
    children,
    baseOccupancy,
    extraAdultCharge,
    extraChildCharge,
    breakfastPerExtraGuest,
    slab = DEFAULT_TAX_SLAB,
  } = pricing;

  const perRoom = allocateExtras(rooms, adults, children, baseOccupancy);

  let roomTotal = 0;
  let taxTotal = 0;
  let extrasTotal = 0;

  for (const room of perRoom) {
    const extraPerNight =
      room.extraAdults * (extraAdultCharge + breakfastPerExtraGuest) +
      room.extraChildren * (extraChildCharge + breakfastPerExtraGuest);

    for (const rate of nightlyRates) {
      const value = rate + extraPerNight;
      roomTotal += value;
      taxTotal += taxForNight(value, slab);
    }
    extrasTotal += extraPerNight * nightlyRates.length;
  }

  roomTotal = round2(roomTotal);
  taxTotal = round2(taxTotal);

  return {
    nights: nightlyRates.length,
    roomTotal,
    taxTotal,
    total: round2(roomTotal + taxTotal),
    extrasTotal: round2(extrasTotal),
    extraAdults: perRoom.reduce((sum, room) => sum + room.extraAdults, 0),
    extraChildren: perRoom.reduce((sum, room) => sum + room.extraChildren, 0),
  };
}

// The plan's inclusion, said the same way on the quote, the confirmation page
// and the email. Empty on Room Only, which includes nothing to say.
export function breakfastLine(guests: number): string {
  if (guests <= 0) return '';
  return `With breakfast for ${guests} ${guests === 1 ? 'guest' : 'guests'}`;
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

// Same shape and same unambiguous alphabet as a booking reference, with an E so
// nobody chasing one ends up searching the wrong table. Enquiries and bookings
// are quoted down the same phone line.
export function enquiryReference(now: Date = new Date()): string {
  const datePart = dateKey(now).slice(2).replace(/-/g, '');
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(
    bytes,
    (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
  ).join('');
  return `SNC-E-${datePart}-${suffix}`;
}

// How a reference is shown to anyone — guest or staff. The stored value keeps
// no '#', because it is also the ICICI order reference and a key guests quote
// over the phone; the hash is presentation, added in one place so the site,
// the emails and the voucher cannot drift into three house styles. Idempotent,
// so a caller that formats an already-formatted reference does not double it.
export function formatReference(reference: string): string {
  return reference.startsWith('#') ? reference : `#${reference}`;
}
