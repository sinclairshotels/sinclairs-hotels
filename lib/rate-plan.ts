// The arithmetic behind the two rate screens, kept away from the database so
// what a save *does* can be tested without one.
//
// A month is a baseline and a day is an exception. Both are written out as
// per-date rows — availability, the calendar and the oversell guard all read
// dates, and computing a month at read time would mean changing every one of
// them — so the only thing that distinguishes them is which screen wrote the
// row. That is `RateSource`, and it is what lets a monthly save leave a
// daily override alone.

export type RateSource = 'MONTHLY' | 'DAILY';

export interface CellState {
  rate: number | null;
  roomsOnSale: number;
  stopSell: boolean;
  minStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

export interface CellChange {
  roomTypeId: string;
  ratePlanId: string;
  date: string;
  before: CellState;
  after: CellState;
}

export const EMPTY_CELL: CellState = {
  rate: null,
  roomsOnSale: 0,
  stopSell: false,
  minStay: null,
  closedToArrival: false,
  closedToDeparture: false,
};

// A year of forward planning: staff load a season at a time, and anything
// past twelve months is a rate nobody can quote yet.
export const MONTHS_AHEAD = 12;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function monthShortLabel(key: string): string {
  const [year, month] = key.split('-').map(Number) as [number, number];
  return `${(MONTH_NAMES[month - 1] as string).slice(0, 3)} ${String(year).slice(2)}`;
}

// The months the monthly screen offers, starting with the one we are in.
export function monthsAhead(from: Date, count: number = MONTHS_AHEAD): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    keys.push(monthKey(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1))));
  }
  return keys;
}

export function isMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

// Every night in the month, minus any already in the past: a rate loaded
// behind today is one nobody can book, and writing it would only make the
// "nights changed" count lie about work that mattered.
export function datesInMonth(key: string, notBefore: Date): Date[] {
  const [year, month] = key.split('-').map(Number) as [number, number];
  const dates: Date[] = [];
  const end = new Date(Date.UTC(year, month, 1));
  for (
    let day = new Date(Date.UTC(year, month - 1, 1));
    day < end;
    day = new Date(day.getTime() + 86_400_000)
  ) {
    if (day >= notBefore) dates.push(day);
  }
  return dates;
}

export interface MonthlyValue {
  roomsOnSale?: number;
  rate?: number;
}

// A month cell only touches what staff filled in: leaving the price blank and
// setting the allotment changes the allotment, it does not blank the price.
export function applyMonthly(before: CellState, value: MonthlyValue): CellState {
  return {
    ...before,
    roomsOnSale: value.roomsOnSale ?? before.roomsOnSale,
    rate: value.rate ?? before.rate,
  };
}

export function cellChanged(before: CellState, after: CellState): boolean {
  return (
    before.rate !== after.rate ||
    before.roomsOnSale !== after.roomsOnSale ||
    before.stopSell !== after.stopSell ||
    before.minStay !== after.minStay ||
    before.closedToArrival !== after.closedToArrival ||
    before.closedToDeparture !== after.closedToDeparture
  );
}

export interface OversellConflict {
  roomTypeId: string;
  roomName: string;
  date: string;
  sold: number;
  attempted: number;
}

// Cutting an allotment below what is already sold would oversell the night.
// Counted with the same held-booking rule availability uses, so the screens
// and the guest-facing pages can never disagree.
export function findOversellConflicts(
  changes: CellChange[],
  soldFor: (roomTypeId: string, date: string) => number,
  roomNameFor: (roomTypeId: string) => string,
): OversellConflict[] {
  const seen = new Set<string>();
  const conflicts: OversellConflict[] = [];

  for (const change of changes) {
    const key = `${change.roomTypeId}:${change.date}`;
    if (seen.has(key)) continue;

    const sold = soldFor(change.roomTypeId, change.date);
    if (change.after.roomsOnSale < sold) {
      seen.add(key);
      conflicts.push({
        roomTypeId: change.roomTypeId,
        roomName: roomNameFor(change.roomTypeId),
        date: change.date,
        sold,
        attempted: change.after.roomsOnSale,
      });
    }
  }

  return conflicts;
}

export function describeMonthly(value: MonthlyValue): string[] {
  const parts: string[] = [];
  if (value.rate !== undefined) parts.push(`₹${value.rate.toLocaleString('en-IN')} a night`);
  if (value.roomsOnSale !== undefined) parts.push(`${value.roomsOnSale} on sale`);
  return parts;
}
