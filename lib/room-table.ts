import type { BlockedOffer, RoomOffer } from '@/lib/availability';
import type { BookingRateType, RatePlanCode } from '@prisma/client';

// Reshapes what availability() returns into what the room table renders:
// one entry per room, each holding its plans, each plan holding its rates.
// Availability returns the cross product — room × plan × rate type — because
// each of those is separately priced and separately bookable; the table is the
// same facts arranged as a guest reads them, which is room first.
//
// Pure, and kept out of the component so the arrangement can be tested without
// rendering anything.

export interface RateOption {
  rateType: BookingRateType;
  ratePlanId: string;
  total: number;
  perNight: number;
  taxTotal: number;
  cancellationDeadline: Date | null;
  breakfastGuests: number;
}

export interface PlanOffer {
  code: RatePlanCode;
  name: string;
  rates: RateOption[];
}

export interface RoomRow {
  roomTypeId: string;
  name: string;
  bedType?: string;
  view?: string;
  sizeSqFt: number | null;
  baseOccupancy: number;
  amenities: string[];
  images: string[];
  description?: string;
  roomsLeft: number;
  plans: PlanOffer[];
}

export interface UnavailableRow {
  roomTypeId: string;
  name: string;
  reason: string;
}

// Why a room is not on sale, in words a guest can act on. Deliberately vague
// about our own mistakes — an unpriced night is a calendar nobody loaded, and
// telling a guest that helps them not at all.
const BLOCK_REASON: Record<BlockedOffer['reason'], string> = {
  unpriced: 'Not available for these dates',
  'stop-sell': 'Not available for these dates',
  'sold-out': 'Sold out for these dates',
  'min-stay': 'Needs a longer stay',
  'closed-to-arrival': 'No arrivals on your check-in date',
  'closed-to-departure': 'No departures on your check-out date',
};

// Non-refundable first: it is the cheaper of the two, and a guest comparing
// rooms is comparing the lowest price each one starts at.
const RATE_ORDER: BookingRateType[] = ['NON_REFUNDABLE', 'REFUNDABLE'];

export function buildRoomTable(
  offers: RoomOffer[],
  blocked: BlockedOffer[],
  rooms: number,
): { rooms: RoomRow[]; unavailable: UnavailableRow[]; planCodes: RatePlanCode[] } {
  const byRoom = new Map<string, RoomRow>();
  const planCodes: RatePlanCode[] = [];

  for (const offer of offers) {
    let room = byRoom.get(offer.roomTypeId);
    if (!room) {
      room = {
        roomTypeId: offer.roomTypeId,
        name: offer.roomTypeName,
        bedType: offer.content?.bedType,
        view: offer.content?.view,
        sizeSqFt: offer.sizeSqFt,
        baseOccupancy: offer.baseOccupancy,
        amenities: offer.content?.amenities ? [...offer.content.amenities] : [],
        images: offer.content?.images ? [...offer.content.images] : [],
        description: offer.content?.description,
        roomsLeft: offer.roomsLeft,
        plans: [],
      };
      byRoom.set(offer.roomTypeId, room);
    }

    // The smallest allotment across a room's offers, because they share it.
    room.roomsLeft = Math.min(room.roomsLeft, offer.roomsLeft);

    let plan = room.plans.find((entry) => entry.code === offer.ratePlanCode);
    if (!plan) {
      plan = { code: offer.ratePlanCode, name: offer.ratePlanName, rates: [] };
      room.plans.push(plan);
    }
    if (!planCodes.includes(offer.ratePlanCode)) planCodes.push(offer.ratePlanCode);

    plan.rates.push({
      rateType: offer.rateType,
      ratePlanId: offer.ratePlanId,
      total: offer.quote.total,
      // Per room per night, which is the number a guest compares between
      // properties — the total is what they pay.
      perNight: Math.round(offer.quote.roomTotal / offer.quote.nights / Math.max(1, rooms)),
      taxTotal: offer.quote.taxTotal,
      cancellationDeadline: offer.cancellationDeadline,
      breakfastGuests: offer.breakfastGuests,
    });
  }

  for (const room of byRoom.values()) {
    for (const plan of room.plans) {
      plan.rates.sort((a, b) => RATE_ORDER.indexOf(a.rateType) - RATE_ORDER.indexOf(b.rateType));
    }
    room.plans.sort((a, b) => (a.code === 'EP' ? -1 : b.code === 'EP' ? 1 : 0));
  }

  // A room that is sellable on one plan is not unavailable, whatever the other
  // plan says — availability blocks per room type, but check anyway so a room
  // can never appear twice.
  const unavailable = blocked
    .filter((entry) => !byRoom.has(entry.roomTypeId))
    .map((entry) => ({
      roomTypeId: entry.roomTypeId,
      name: entry.roomTypeName,
      reason:
        entry.reason === 'min-stay' && entry.minStay
          ? `Needs a stay of ${entry.minStay} nights`
          : BLOCK_REASON[entry.reason],
    }));

  return { rooms: [...byRoom.values()], unavailable, planCodes };
}

// Red at three or fewer: at nine it is noise, at three it is the number a
// guest actually weighs.
export const SCARCITY_THRESHOLD = 3;
