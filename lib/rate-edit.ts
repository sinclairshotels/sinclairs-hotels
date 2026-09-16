import type { RateEditInput } from '@/lib/validation';

// The arithmetic of a bulk edit, kept away from the database so what a change
// *does* can be tested without one. The action loads the current values,
// hands them here, and writes back what comes out.

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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type RateEdit = Pick<
  RateEditInput,
  | 'rateMode'
  | 'rateValue'
  | 'roomsMode'
  | 'roomsValue'
  | 'stopSell'
  | 'minStayMode'
  | 'minStayValue'
  | 'closedToArrival'
  | 'closedToDeparture'
>;

function applyTriState(current: boolean, mode: 'none' | 'on' | 'off'): boolean {
  return mode === 'none' ? current : mode === 'on';
}

export function applyRateEdit(before: CellState, edit: RateEdit): CellState {
  let rate = before.rate;

  if (edit.rateMode !== 'none' && edit.rateValue !== undefined) {
    if (edit.rateMode === 'set') {
      rate = round2(edit.rateValue);
    } else if (before.rate !== null) {
      // An adjustment needs something to adjust. A night with no price is not
      // "zero plus ten percent" — it is unpriced, and staying that way is the
      // only honest outcome.
      const delta = {
        increaseAmount: edit.rateValue,
        decreaseAmount: -edit.rateValue,
        increasePercent: (before.rate * edit.rateValue) / 100,
        decreasePercent: -(before.rate * edit.rateValue) / 100,
      }[edit.rateMode];
      const adjusted = before.rate + delta;
      // A percentage lands on paise almost every time, and nobody sells a room
      // at ₹5,692.50. Whole rupees for a derived rate; an amount the staff
      // typed themselves is kept exactly as typed.
      const percent = edit.rateMode === 'increasePercent' || edit.rateMode === 'decreasePercent';
      rate = Math.max(0, percent ? Math.round(adjusted) : round2(adjusted));
    }
  }

  return {
    rate,
    roomsOnSale:
      edit.roomsMode === 'set' && edit.roomsValue !== undefined
        ? edit.roomsValue
        : before.roomsOnSale,
    stopSell: applyTriState(before.stopSell, edit.stopSell),
    minStay:
      edit.minStayMode === 'clear'
        ? null
        : edit.minStayMode === 'set' && edit.minStayValue !== undefined
          ? edit.minStayValue
          : before.minStay,
    closedToArrival: applyTriState(before.closedToArrival, edit.closedToArrival),
    closedToDeparture: applyTriState(before.closedToDeparture, edit.closedToDeparture),
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

// Rooms already sold cannot be un-sold by lowering the allotment. Staff are
// shown the conflict rather than having the write silently clamped, because
// the number they typed and the number they would get are different facts and
// one of them is a decision they have not made yet.
export function findOversellConflicts(
  changes: CellChange[],
  soldFor: (roomTypeId: string, date: string) => number,
  roomNameFor: (roomTypeId: string) => string,
): OversellConflict[] {
  const seen = new Set<string>();
  const conflicts: OversellConflict[] = [];

  for (const change of changes) {
    const key = `${change.roomTypeId}:${change.date}`;
    // Inventory is per room type, so two rate plans of one room produce the
    // same conflict twice.
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

export function describeEdit(edit: RateEdit): string[] {
  const parts: string[] = [];

  if (edit.rateMode !== 'none' && edit.rateValue !== undefined) {
    const value = edit.rateValue.toLocaleString('en-IN');
    parts.push(
      {
        set: `Rate set to ₹${value}`,
        increaseAmount: `Rate up ₹${value}`,
        decreaseAmount: `Rate down ₹${value}`,
        increasePercent: `Rate up ${value}%`,
        decreasePercent: `Rate down ${value}%`,
        none: '',
      }[edit.rateMode],
    );
  }
  if (edit.roomsMode === 'set' && edit.roomsValue !== undefined) {
    parts.push(`${edit.roomsValue} rooms on sale`);
  }
  if (edit.stopSell !== 'none') parts.push(edit.stopSell === 'on' ? 'Stop sell' : 'Back on sale');
  if (edit.minStayMode === 'set' && edit.minStayValue !== undefined) {
    parts.push(`Minimum stay ${edit.minStayValue} nights`);
  }
  if (edit.minStayMode === 'clear') parts.push('Minimum stay cleared');
  if (edit.closedToArrival !== 'none') {
    parts.push(edit.closedToArrival === 'on' ? 'Closed to arrival' : 'Open to arrival');
  }
  if (edit.closedToDeparture !== 'none') {
    parts.push(edit.closedToDeparture === 'on' ? 'Closed to departure' : 'Open to departure');
  }

  return parts;
}
