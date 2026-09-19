import {
  EMPTY_CELL,
  applyMonthly,
  cellChanged,
  datesInMonth,
  describeMonthly,
  findOversellConflicts,
  isMonthKey,
  monthKey,
  monthLabel,
  monthShortLabel,
  monthsAhead,
} from '@/lib/rate-plan';
import { describe, expect, it } from 'vitest';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('month keys', () => {
  it('names the month a date falls in', () => {
    expect(monthKey(utc('2026-10-27'))).toBe('2026-10');
    expect(monthKey(utc('2027-01-01'))).toBe('2027-01');
  });

  it('offers twelve months starting with the one we are in', () => {
    const months = monthsAhead(utc('2026-10-27'), 12);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-10');
    expect(months[11]).toBe('2027-09');
  });

  it('rolls the year over rather than producing a thirteenth month', () => {
    expect(monthsAhead(utc('2026-12-15'), 3)).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('labels a month for staff', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthShortLabel('2026-10')).toBe('Oct 26');
  });

  it('rejects anything that is not a real month', () => {
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-00')).toBe(false);
    expect(isMonthKey('2026-1')).toBe(false);
    expect(isMonthKey('not-a-month')).toBe(false);
  });
});

describe('datesInMonth', () => {
  it('returns every night in the month', () => {
    const dates = datesInMonth('2026-11', utc('2020-01-01'));
    expect(dates).toHaveLength(30);
    expect(dates[0]?.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(dates[29]?.toISOString().slice(0, 10)).toBe('2026-11-30');
  });

  it('knows February in a leap year', () => {
    expect(datesInMonth('2028-02', utc('2020-01-01'))).toHaveLength(29);
    expect(datesInMonth('2027-02', utc('2020-01-01'))).toHaveLength(28);
  });

  it('skips nights already past, which nobody can book', () => {
    const dates = datesInMonth('2026-11', utc('2026-11-20'));
    expect(dates).toHaveLength(11);
    expect(dates[0]?.toISOString().slice(0, 10)).toBe('2026-11-20');
  });

  it('returns nothing for a month that has entirely gone', () => {
    expect(datesInMonth('2026-01', utc('2026-11-20'))).toHaveLength(0);
  });
});

describe('applyMonthly', () => {
  const loaded = { ...EMPTY_CELL, rate: 5000, roomsOnSale: 4 };

  it('sets both when both are given', () => {
    expect(applyMonthly(loaded, { rate: 6000, roomsOnSale: 2 })).toMatchObject({
      rate: 6000,
      roomsOnSale: 2,
    });
  });

  it('leaves the price alone when only the allotment is given', () => {
    expect(applyMonthly(loaded, { roomsOnSale: 2 })).toMatchObject({ rate: 5000, roomsOnSale: 2 });
  });

  it('leaves the allotment alone when only the price is given', () => {
    expect(applyMonthly(loaded, { rate: 6000 })).toMatchObject({ rate: 6000, roomsOnSale: 4 });
  });

  it('keeps restrictions that neither screen sets', () => {
    const restricted = { ...loaded, minStay: 3, closedToArrival: true, stopSell: true };
    expect(applyMonthly(restricted, { rate: 6000 })).toMatchObject({
      minStay: 3,
      closedToArrival: true,
      stopSell: true,
    });
  });

  it('takes a zero allotment as a real value, not an absent one', () => {
    expect(applyMonthly(loaded, { roomsOnSale: 0 }).roomsOnSale).toBe(0);
  });
});

describe('cellChanged', () => {
  const before = { ...EMPTY_CELL, rate: 5000, roomsOnSale: 4 };

  it('is false when a save rewrites the same values', () => {
    expect(cellChanged(before, applyMonthly(before, { rate: 5000, roomsOnSale: 4 }))).toBe(false);
  });

  it('is true when the price moves', () => {
    expect(cellChanged(before, applyMonthly(before, { rate: 5500 }))).toBe(true);
  });

  it('is true when the allotment moves', () => {
    expect(cellChanged(before, applyMonthly(before, { roomsOnSale: 3 }))).toBe(true);
  });
});

describe('findOversellConflicts', () => {
  const change = (roomTypeId: string, date: string, roomsOnSale: number) => ({
    roomTypeId,
    ratePlanId: `${roomTypeId}-ep`,
    date,
    before: { ...EMPTY_CELL, roomsOnSale: 5 },
    after: { ...EMPTY_CELL, roomsOnSale },
  });

  it('refuses an allotment below what is already sold', () => {
    const conflicts = findOversellConflicts(
      [change('deluxe', '2026-10-27', 1)],
      () => 3,
      () => 'Deluxe Room',
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ sold: 3, attempted: 1, roomName: 'Deluxe Room' });
  });

  it('allows an allotment exactly equal to what is sold', () => {
    expect(
      findOversellConflicts(
        [change('deluxe', '2026-10-27', 3)],
        () => 3,
        () => 'Deluxe Room',
      ),
    ).toHaveLength(0);
  });

  it('reports a night once even though every rate plan shares the room', () => {
    const conflicts = findOversellConflicts(
      [change('deluxe', '2026-10-27', 1), change('deluxe', '2026-10-27', 1)],
      () => 3,
      () => 'Deluxe Room',
    );

    expect(conflicts).toHaveLength(1);
  });
});

describe('describeMonthly', () => {
  it('describes both halves', () => {
    expect(describeMonthly({ rate: 6000, roomsOnSale: 2 })).toEqual([
      '₹6,000 a night',
      '2 on sale',
    ]);
  });

  it('describes only what was filled in', () => {
    expect(describeMonthly({ roomsOnSale: 2 })).toEqual(['2 on sale']);
    expect(describeMonthly({})).toEqual([]);
  });
});
