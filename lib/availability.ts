import { getHotelBySlug } from '@/content/hotels';
import type { RoomType as ContentRoom } from '@/content/types';
import {
  HOLD_MINUTES,
  type StayQuote,
  addDays,
  dateKey,
  eachNight,
  quoteStay,
} from '@/lib/booking';
import {
  deadlineFor,
  refundPolicy,
  refundableBlocked,
  refundableIsSellable,
  upliftRate,
} from '@/lib/cancellation';
import type { NonRefundableRange } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import { currentTaxSlab } from '@/lib/tax';
import type { BookingRateType, Prisma, PrismaClient, RatePlanCode } from '@prisma/client';

// Accepts either the shared client or an interactive transaction client, so
// the same availability read backs both the public search page and the
// re-check inside the serializable transaction that creates a booking.
type Db = PrismaClient | Prisma.TransactionClient;

export interface RoomOffer {
  roomTypeId: string;
  roomTypeName: string;
  // The marketing half, for photography and copy. Absent if the room type has
  // outlived its content entry — it can still be sold, just without a picture.
  content?: ContentRoom;
  ratePlanId: string;
  ratePlanCode: RatePlanCode;
  ratePlanName: string;
  // Square feet, staff's figure first and the content file's as a fallback.
  // Null where the room has never been measured.
  sizeSqFt: number | null;
  roomsLeft: number;
  nightlyRates: number[];
  // Guests this plan feeds. Zero on Room Only.
  breakfastGuests: number;
  // What breakfast costs across the whole stay, for the receipt and the export
  // to state as its own line. Zero on Room Only. Carried separately because it
  // is already *inside* quote.roomTotal — the plan's nightly rate is the room
  // plus breakfast for the guests the rate covers — and a receipt that showed
  // it again as an extra would double it.
  breakfastTotal: number;
  // Which of the two cancellation terms this price buys, and the date the
  // refundable one stops being refundable. Null deadline on non-refundable,
  // because no date changes anything.
  rateType: BookingRateType;
  cancellationDeadline: Date | null;
  quote: StayQuote;
}

// What a PENDING_PAYMENT booking still holds. It is mid-payment so its rooms
// are not free, but an abandoned attempt must not hold them forever — after
// HOLD_MINUTES it simply stops matching, with nothing to sweep.
export function heldBookingFilter(now: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: 'CONFIRMED' },
      {
        status: 'PENDING_PAYMENT',
        createdAt: { gt: new Date(now.getTime() - HOLD_MINUTES * 60_000) },
      },
    ],
  };
}

export interface AvailabilityQuery {
  hotelSlug: string;
  checkIn: Date;
  checkOut: Date;
  rooms: number;
  // Who is staying. Guests beyond the rooms' base occupancy are charged, so a
  // quote cannot be made without them; both default to the common case.
  adults?: number;
  children?: number;
  now?: Date;
  // A booking to leave out of the held count — used when re-checking
  // availability *for* a specific booking, so it cannot block itself.
  excludeBookingId?: string;
}

// Why a room type could not be offered. Surfaced so the booking pages can say
// something better than "no availability", and so staff can see which of their
// own restrictions is doing the blocking.
export type OfferBlock =
  | 'unpriced'
  | 'stop-sell'
  | 'min-stay'
  | 'closed-to-arrival'
  | 'closed-to-departure'
  | 'sold-out';

export interface BlockedOffer {
  roomTypeId: string;
  roomTypeName: string;
  reason: OfferBlock;
  minStay?: number;
}

export interface AvailabilityResult {
  offers: RoomOffer[];
  blocked: BlockedOffer[];
  // Set when the stay falls in a period the property sells on non-refundable
  // terms only. The room list needs it to say why there is one price where
  // there are usually two — without it, a property that has a refundable rate
  // looks like one that does not.
  nonRefundableOnly: NonRefundableRange | null;
}

export async function availability(
  db: Db,
  {
    hotelSlug,
    checkIn,
    checkOut,
    rooms,
    adults = rooms * 2,
    children = 0,
    now = new Date(),
    excludeBookingId,
  }: AvailabilityQuery,
): Promise<AvailabilityResult> {
  const nights = eachNight(checkIn, checkOut);
  if (nights.length === 0) return { offers: [], blocked: [], nonRefundableOnly: null };

  const contentRooms = new Map(
    (getHotelBySlug(hotelSlug)?.rooms ?? []).map((room) => [room.name, room]),
  );

  const [roomTypes, inventory, prices, heldBookings, settings, slab, windows] = await Promise.all([
    db.roomType.findMany({
      where: { hotelSlug, active: true },
      include: { ratePlans: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    }),
    // Through checkOut inclusive, not just the stay nights: closed-to-departure
    // is a rule about the day the guest leaves, which is never one of the
    // nights they pay for.
    db.roomInventory.findMany({
      where: { hotelSlug, date: { gte: checkIn, lte: checkOut } },
    }),
    db.ratePrice.findMany({ where: { hotelSlug, date: { gte: checkIn, lt: checkOut } } }),
    db.booking.findMany({
      where: {
        hotelSlug,
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        ...heldBookingFilter(now),
      },
      select: { roomTypeId: true, rooms: true, checkIn: true, checkOut: true },
    }),
    db.hotelSettings.findUnique({ where: { hotelSlug } }),
    currentTaxSlab(now),
    // Only the windows this stay could touch. The last night is checkOut - 1,
    // so a window starting on the checkout morning is correctly not one of them.
    db.nonRefundableWindow.findMany({
      where: { hotelSlug, startDate: { lt: checkOut }, endDate: { gte: checkIn } },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  const breakfast = settings?.breakfastSupplement.toNumber() ?? 0;
  const policy = settings ? refundPolicy(settings) : null;
  // Dates the property sells on non-refundable terms only. Checked once for the
  // stay rather than per room: it is a property-wide rule about when, not what.
  const blockedBy = refundableBlocked(windows, checkIn, checkOut);

  const inventoryByRoom = new Map<string, Map<string, (typeof inventory)[number]>>();
  for (const row of inventory) {
    const byNight = inventoryByRoom.get(row.roomTypeId) ?? new Map();
    byNight.set(dateKey(row.date), row);
    inventoryByRoom.set(row.roomTypeId, byNight);
  }

  const priceByPlan = new Map<string, Map<string, number>>();
  for (const row of prices) {
    const byNight = priceByPlan.get(row.ratePlanId) ?? new Map<string, number>();
    byNight.set(dateKey(row.date), row.amount.toNumber());
    priceByPlan.set(row.ratePlanId, byNight);
  }

  const heldByRoom = new Map<string, Map<string, number>>();
  for (const booking of heldBookings) {
    if (!booking.roomTypeId) continue;
    const byNight = heldByRoom.get(booking.roomTypeId) ?? new Map<string, number>();
    for (const night of eachNight(booking.checkIn, booking.checkOut)) {
      const key = dateKey(night);
      byNight.set(key, (byNight.get(key) ?? 0) + booking.rooms);
    }
    heldByRoom.set(booking.roomTypeId, byNight);
  }

  const offers: RoomOffer[] = [];
  const blocked: BlockedOffer[] = [];
  const stayLength = nights.length;

  for (const roomType of roomTypes) {
    const block = (reason: OfferBlock, minStay?: number) =>
      blocked.push({ roomTypeId: roomType.id, roomTypeName: roomType.name, reason, minStay });

    const nightsInventory = inventoryByRoom.get(roomType.id);
    if (!nightsInventory) {
      block('unpriced');
      continue;
    }

    const heldForRoom = heldByRoom.get(roomType.id);
    let roomsLeft = Number.POSITIVE_INFINITY;
    let reason: OfferBlock | null = null;
    let requiredStay: number | undefined;

    for (const [index, night] of nights.entries()) {
      const key = dateKey(night);
      const row = nightsInventory.get(key);

      if (!row) {
        reason = 'unpriced';
        break;
      }
      if (row.stopSell) {
        reason = 'stop-sell';
        break;
      }
      // A restriction staff set has to actually bind, or it is decoration.
      if (row.minStay && stayLength < row.minStay) {
        reason = 'min-stay';
        requiredStay = row.minStay;
        break;
      }
      if (index === 0 && row.closedToArrival) {
        reason = 'closed-to-arrival';
        break;
      }

      roomsLeft = Math.min(roomsLeft, row.roomsOnSale - (heldForRoom?.get(key) ?? 0));
    }

    if (!reason && nightsInventory.get(dateKey(checkOut))?.closedToDeparture) {
      reason = 'closed-to-departure';
    }

    if (reason) {
      block(reason, requiredStay);
      continue;
    }

    roomsLeft = Math.max(0, roomsLeft);
    if (roomsLeft < rooms) {
      block('sold-out');
      continue;
    }

    // Only Room Only carries a calendar of its own. With Breakfast is derived
    // from it — the supplement per person, times the guests the room's rate
    // covers — so there is no second calendar to keep in step and no way for
    // the two to drift apart.
    const roomOnly = roomType.ratePlans.find((plan) => plan.code === 'EP');
    const withBreakfast = roomType.ratePlans.find((plan) => plan.code === 'CP');
    if (!roomOnly) continue;

    const planPrices = priceByPlan.get(roomOnly.id);
    const baseRates: number[] = [];
    for (const night of nights) {
      const amount = planPrices?.get(dateKey(night));
      if (amount === undefined) {
        baseRates.length = 0;
        break;
      }
      baseRates.push(amount);
    }

    // A gap in the calendar is an unpriced night, not a night to guess a
    // price for, so the whole stay drops out of the results.
    if (baseRates.length !== stayLength) continue;

    // The plan's rate covers the room's base guests. On With Breakfast that
    // means breakfast for them too; an extra guest then pays their extra-guest
    // charge plus one more breakfast, which is the only difference between the
    // two plans once a room is over-occupied.
    // The uplift is a percentage of the Room Only rate, applied before
    // breakfast: flexibility is priced on the room, not on the meal plan the
    // guest happened to pick. Offered only while the window is still open —
    // an uplift bought for a deadline already past is a charge for nothing.
    const terms: Array<{ rateType: BookingRateType; base: number[]; deadline: Date | null }> = [
      { rateType: 'NON_REFUNDABLE', base: baseRates, deadline: null },
    ];

    if (policy && !blockedBy && refundableIsSellable(checkIn, policy, now)) {
      terms.push({
        rateType: 'REFUNDABLE',
        base: baseRates.map((rate) => upliftRate(rate, policy.upliftPct)),
        deadline: deadlineFor(checkIn, policy.freeCancellationDays),
      });
    }

    for (const term of terms) {
      const sellable: Array<{
        plan: (typeof roomType.ratePlans)[number];
        rates: number[];
        breakfastPerExtraGuest: number;
      }> = [{ plan: roomOnly, rates: term.base, breakfastPerExtraGuest: 0 }];

      if (withBreakfast && breakfast > 0) {
        const perNight = breakfast * roomType.baseOccupancy;
        sellable.push({
          plan: withBreakfast,
          rates: term.base.map((rate) => rate + perNight),
          breakfastPerExtraGuest: breakfast,
        });
      }

      for (const { plan, rates: nightlyRates, breakfastPerExtraGuest } of sellable) {
        const quote = quoteStay({
          nightlyRates,
          rooms,
          adults,
          children,
          baseOccupancy: roomType.baseOccupancy,
          extraAdultCharge: roomType.extraAdultCharge.toNumber(),
          extraChildCharge: roomType.extraChildCharge.toNumber(),
          breakfastPerExtraGuest,
          slab,
        });

        // Breakfast for the guests the rate covers, in every room, every
        // night — plus one more for each guest beyond that. Zero on Room Only,
        // where breakfastPerExtraGuest is zero and the rates carry no meal.
        const breakfastTotal =
          breakfastPerExtraGuest > 0
            ? breakfast * roomType.baseOccupancy * rooms * quote.nights +
              (quote.extraAdults + quote.extraChildren) * breakfast * quote.nights
            : 0;

        offers.push({
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          content: contentRooms.get(roomType.contentKey),
          ratePlanId: plan.id,
          ratePlanCode: plan.code,
          ratePlanName: plan.name,
          sizeSqFt: roomType.sizeSqFt ?? contentRooms.get(roomType.contentKey)?.sizeSqFt ?? null,
          roomsLeft,
          nightlyRates,
          // Zero on Room Only, so a quote can say "with breakfast for N guests"
          // without asking which plan it is looking at.
          breakfastGuests: breakfastPerExtraGuest > 0 ? adults + children : 0,
          breakfastTotal,
          rateType: term.rateType,
          cancellationDeadline: term.deadline,
          quote,
        });
      }
    }

    if (!offers.some((offer) => offer.roomTypeId === roomType.id)) block('unpriced');
  }

  return { offers, blocked, nonRefundableOnly: blockedBy };
}

export async function roomOffers(db: Db, query: AvailabilityQuery): Promise<RoomOffer[]> {
  return (await availability(db, query)).offers;
}

export async function roomOffer(
  db: Db,
  query: AvailabilityQuery & {
    roomTypeId: string;
    ratePlanId?: string;
    rateType?: BookingRateType;
  },
): Promise<RoomOffer | undefined> {
  const { offers } = await availability(db, query);
  return offers.find(
    (offer) =>
      offer.roomTypeId === query.roomTypeId &&
      (query.ratePlanId === undefined || offer.ratePlanId === query.ratePlanId) &&
      // Undefined means the caller has no opinion, which is the room list and
      // the resume link. The booking transaction always names one, so asking
      // for refundable terms cannot come back priced as non-refundable.
      (query.rateType === undefined || offer.rateType === query.rateType),
  );
}

// True when a property has any rate loaded at all. Distinguishes "we are full"
// from "direct booking is not open here yet", which are opposite messages to
// show a guest — every property starts in the second state until staff load an
// allotment.
export async function hasLoadedRates(hotelSlug: string, from: Date): Promise<boolean> {
  return (await prisma.ratePrice.count({ where: { hotelSlug, date: { gte: from } } })) > 0;
}

export async function bookableHotelSlugs(from: Date): Promise<string[]> {
  const grouped = await prisma.roomInventory.groupBy({
    by: ['hotelSlug'],
    where: { date: { gte: from }, stopSell: false, roomsOnSale: { gt: 0 } },
  });
  return grouped.map((row) => row.hotelSlug);
}

export { addDays };
