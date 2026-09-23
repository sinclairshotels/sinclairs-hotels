import { describe, expect, it } from 'vitest';
import type { BlockedOffer, RoomOffer } from './availability';
import { buildRoomTable } from './room-table';

const offer = (overrides: Partial<RoomOffer> = {}): RoomOffer =>
  ({
    roomTypeId: 'deluxe',
    roomTypeName: 'Deluxe Room',
    content: undefined,
    ratePlanId: 'deluxe-ep',
    ratePlanCode: 'EP',
    ratePlanName: 'Room Only',
    sizeSqFt: 210,
    baseOccupancy: 2,
    roomsLeft: 4,
    nightlyRates: [5000, 5000],
    breakfastGuests: 0,
    breakfastTotal: 0,
    rateType: 'NON_REFUNDABLE',
    cancellationDeadline: null,
    quote: {
      nights: 2,
      roomTotal: 10000,
      taxTotal: 500,
      total: 10500,
      extrasTotal: 0,
      extraAdults: 0,
      extraChildren: 0,
    },
    ...overrides,
  }) as RoomOffer;

describe('buildRoomTable', () => {
  it('gathers a room once, with its plans and their rates beneath it', () => {
    const { rooms } = buildRoomTable(
      [
        offer(),
        offer({ rateType: 'REFUNDABLE', quote: { ...offer().quote, total: 12075 } }),
        offer({ ratePlanId: 'deluxe-cp', ratePlanCode: 'CP', ratePlanName: 'With Breakfast' }),
      ],
      [],
      1,
    );

    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.plans.map((plan) => plan.code)).toEqual(['EP', 'CP']);
    expect(rooms[0]?.plans[0]?.rates).toHaveLength(2);
  });

  // The cheaper of the two first: a guest scanning rooms is comparing the
  // lowest price each one starts at.
  it('puts non-refundable before refundable', () => {
    const { rooms } = buildRoomTable(
      [offer({ rateType: 'REFUNDABLE' }), offer({ rateType: 'NON_REFUNDABLE' })],
      [],
      1,
    );
    expect(rooms[0]?.plans[0]?.rates.map((rate) => rate.rateType)).toEqual([
      'NON_REFUNDABLE',
      'REFUNDABLE',
    ]);
  });

  it('takes the smallest allotment across a room’s offers, since they share it', () => {
    const { rooms } = buildRoomTable([offer({ roomsLeft: 4 }), offer({ roomsLeft: 2 })], [], 1);
    expect(rooms[0]?.roomsLeft).toBe(2);
  });

  it('works out the per-night price per room, not per booking', () => {
    const { rooms } = buildRoomTable(
      [offer({ quote: { ...offer().quote, roomTotal: 20000, nights: 2 } })],
      [],
      2,
    );
    expect(rooms[0]?.plans[0]?.rates[0]?.perNight).toBe(5000);
  });

  it('lists a blocked room with a reason a guest can act on', () => {
    const blocked: BlockedOffer[] = [
      { roomTypeId: 'suite', roomTypeName: 'Premier Suite', reason: 'sold-out' },
      { roomTypeId: 'attic', roomTypeName: 'Attic Room', reason: 'min-stay', minStay: 3 },
      { roomTypeId: 'cottage', roomTypeName: 'Cottage', reason: 'unpriced' },
    ];
    const { unavailable } = buildRoomTable([offer()], blocked, 1);

    expect(unavailable.map((row) => row.reason)).toEqual([
      'Sold out for these dates',
      'Needs a stay of 3 nights',
      // An unpriced night is a calendar nobody loaded. Telling a guest that
      // helps them not at all.
      'Not available for these dates',
    ]);
  });

  it('never lists a room as both available and unavailable', () => {
    const { rooms, unavailable } = buildRoomTable(
      [offer()],
      [{ roomTypeId: 'deluxe', roomTypeName: 'Deluxe Room', reason: 'stop-sell' }],
      1,
    );
    expect(rooms).toHaveLength(1);
    expect(unavailable).toEqual([]);
  });

  it('reports which plans are on sale, so the toggle only offers what exists', () => {
    expect(buildRoomTable([offer()], [], 1).planCodes).toEqual(['EP']);
    expect(
      buildRoomTable([offer(), offer({ ratePlanCode: 'CP', ratePlanId: 'cp' })], [], 1).planCodes,
    ).toEqual(['EP', 'CP']);
  });
});
