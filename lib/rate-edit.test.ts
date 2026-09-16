import { describe, expect, it } from 'vitest';
import {
  type CellChange,
  EMPTY_CELL,
  applyRateEdit,
  cellChanged,
  describeEdit,
  findOversellConflicts,
} from './rate-edit';

const NO_CHANGE = {
  rateMode: 'none',
  rateValue: undefined,
  roomsMode: 'none',
  roomsValue: undefined,
  stopSell: 'none',
  minStayMode: 'none',
  minStayValue: undefined,
  closedToArrival: 'none',
  closedToDeparture: 'none',
} as const;

const loaded = {
  rate: 5000,
  roomsOnSale: 4,
  stopSell: false,
  minStay: null,
  closedToArrival: false,
  closedToDeparture: false,
};

describe('applyRateEdit', () => {
  it('changes nothing when every field is left alone', () => {
    expect(applyRateEdit(loaded, NO_CHANGE)).toEqual(loaded);
  });

  it('sets a rate outright', () => {
    expect(applyRateEdit(loaded, { ...NO_CHANGE, rateMode: 'set', rateValue: 6200 }).rate).toBe(
      6200,
    );
  });

  it.each([
    ['increaseAmount', 500, 5500],
    ['decreaseAmount', 500, 4500],
    ['increasePercent', 10, 5500],
    ['decreasePercent', 10, 4500],
  ] as const)('adjusts by %s', (rateMode, rateValue, expected) => {
    expect(applyRateEdit(loaded, { ...NO_CHANGE, rateMode, rateValue }).rate).toBe(expected);
  });

  it('never drives a rate below zero', () => {
    const cell = { ...loaded, rate: 300 };
    expect(
      applyRateEdit(cell, { ...NO_CHANGE, rateMode: 'decreaseAmount', rateValue: 900 }).rate,
    ).toBe(0);
  });

  it('rounds a percentage adjustment to whole rupees', () => {
    const cell = { ...loaded, rate: 3333.33 };
    expect(
      applyRateEdit(cell, { ...NO_CHANGE, rateMode: 'increasePercent', rateValue: 7 }).rate,
    ).toBe(3567);
  });

  it('keeps the paise on an amount adjustment, which staff typed themselves', () => {
    const cell = { ...loaded, rate: 3333.33 };
    expect(
      applyRateEdit(cell, { ...NO_CHANGE, rateMode: 'increaseAmount', rateValue: 100.5 }).rate,
    ).toBe(3433.83);
  });

  it('leaves an unpriced night unpriced when adjusting, rather than treating it as zero', () => {
    const unpriced = { ...EMPTY_CELL, roomsOnSale: 3 };
    expect(
      applyRateEdit(unpriced, { ...NO_CHANGE, rateMode: 'increasePercent', rateValue: 10 }).rate,
    ).toBeNull();
    expect(
      applyRateEdit(unpriced, { ...NO_CHANGE, rateMode: 'increaseAmount', rateValue: 500 }).rate,
    ).toBeNull();
  });

  it('will still set a price on an unpriced night', () => {
    expect(applyRateEdit(EMPTY_CELL, { ...NO_CHANGE, rateMode: 'set', rateValue: 4000 }).rate).toBe(
      4000,
    );
  });

  it('sets rooms on sale, including down to zero', () => {
    expect(
      applyRateEdit(loaded, { ...NO_CHANGE, roomsMode: 'set', roomsValue: 0 }).roomsOnSale,
    ).toBe(0);
  });

  it.each([
    ['stopSell', 'closedToArrival'],
    ['closedToArrival', 'closedToDeparture'],
  ] as const)('turns a flag on and off without touching its neighbour', (flag, neighbour) => {
    const on = applyRateEdit(loaded, { ...NO_CHANGE, [flag]: 'on' });
    expect(on[flag]).toBe(true);
    expect(on[neighbour]).toBe(false);

    expect(applyRateEdit(on, { ...NO_CHANGE, [flag]: 'off' })[flag]).toBe(false);
  });

  it('sets and clears a minimum stay', () => {
    const withMin = applyRateEdit(loaded, {
      ...NO_CHANGE,
      minStayMode: 'set',
      minStayValue: 3,
    });
    expect(withMin.minStay).toBe(3);
    expect(applyRateEdit(withMin, { ...NO_CHANGE, minStayMode: 'clear' }).minStay).toBeNull();
  });

  it('changes only the fields asked for, in one pass', () => {
    const after = applyRateEdit(loaded, {
      ...NO_CHANGE,
      rateMode: 'increasePercent',
      rateValue: 20,
      stopSell: 'on',
    });
    expect(after).toEqual({ ...loaded, rate: 6000, stopSell: true });
  });
});

describe('cellChanged', () => {
  it('sees a real change', () => {
    expect(cellChanged(loaded, { ...loaded, rate: 5001 })).toBe(true);
    expect(cellChanged(loaded, { ...loaded, minStay: 2 })).toBe(true);
  });

  it('does not call an identical write a change', () => {
    expect(cellChanged(loaded, { ...loaded })).toBe(false);
  });
});

describe('findOversellConflicts', () => {
  const change = (roomTypeId: string, date: string, roomsOnSale: number): CellChange => ({
    roomTypeId,
    ratePlanId: `${roomTypeId}-ep`,
    date,
    before: loaded,
    after: { ...loaded, roomsOnSale },
  });

  const roomName = (id: string) => (id === 'deluxe' ? 'Deluxe Room' : 'Suite');

  it('flags a night cut below what is already sold', () => {
    const conflicts = findOversellConflicts([change('deluxe', '2026-02-01', 1)], () => 3, roomName);

    expect(conflicts).toEqual([
      { roomTypeId: 'deluxe', roomName: 'Deluxe Room', date: '2026-02-01', sold: 3, attempted: 1 },
    ]);
  });

  it('allows cutting exactly to what is sold', () => {
    expect(findOversellConflicts([change('deluxe', '2026-02-01', 3)], () => 3, roomName)).toEqual(
      [],
    );
  });

  it('reports a night once even when several rate plans touch it', () => {
    const conflicts = findOversellConflicts(
      [
        { ...change('deluxe', '2026-02-01', 1), ratePlanId: 'ep' },
        { ...change('deluxe', '2026-02-01', 1), ratePlanId: 'cp' },
      ],
      () => 3,
      roomName,
    );

    expect(conflicts).toHaveLength(1);
  });

  it('is quiet when nothing is sold', () => {
    expect(findOversellConflicts([change('deluxe', '2026-02-01', 0)], () => 0, roomName)).toEqual(
      [],
    );
  });
});

describe('describeEdit', () => {
  it('describes only what is being changed', () => {
    expect(describeEdit({ ...NO_CHANGE, rateMode: 'increasePercent', rateValue: 15 })).toEqual([
      'Rate up 15%',
    ]);
    expect(describeEdit(NO_CHANGE)).toEqual([]);
  });

  it('reads as a list when several things change at once', () => {
    expect(
      describeEdit({
        ...NO_CHANGE,
        roomsMode: 'set',
        roomsValue: 2,
        stopSell: 'on',
        minStayMode: 'set',
        minStayValue: 3,
      }),
    ).toEqual(['2 rooms on sale', 'Stop sell', 'Minimum stay 3 nights']);
  });
});
