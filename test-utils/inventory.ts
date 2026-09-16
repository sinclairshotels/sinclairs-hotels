// Fixtures for the split inventory model: a room type, its rate plans, and
// per-night inventory and price rows. Inventory hangs off the room type and
// price off a rate plan, so setting up a bookable night now touches two
// tables — this keeps that out of every test body.

import { dateKey } from '@/lib/booking';
import { prisma } from '@/lib/db';
import type { RatePlanCode } from '@prisma/client';

export interface LoadedRoom {
  roomTypeId: string;
  ratePlanId: string;
  roomName: string;
}

// Finds the room type the content files declare, which scripts/sync-room-types
// has already created, and returns its EP plan.
export async function findRoom(hotelSlug: string, contentKey: string): Promise<LoadedRoom> {
  const roomType = await prisma.roomType.findUniqueOrThrow({
    where: { hotelSlug_contentKey: { hotelSlug, contentKey } },
    include: { ratePlans: true },
  });

  const plan = roomType.ratePlans.find((p) => p.code === 'EP');
  if (!plan) throw new Error(`${hotelSlug}/${contentKey} has no EP rate plan`);

  return { roomTypeId: roomType.id, ratePlanId: plan.id, roomName: roomType.name };
}

export async function planFor(roomTypeId: string, code: RatePlanCode): Promise<string> {
  const plan = await prisma.ratePlan.findUniqueOrThrow({
    where: { roomTypeId_code: { roomTypeId, code } },
  });
  if (!plan.active) {
    await prisma.ratePlan.update({ where: { id: plan.id }, data: { active: true } });
  }
  return plan.id;
}

export interface LoadNightsOptions {
  rate?: number;
  roomsOnSale?: number;
  stopSell?: boolean;
  minStay?: number | null;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  priced?: boolean;
}

export async function loadNights(
  room: LoadedRoom,
  hotelSlug: string,
  dates: Date[],
  options: LoadNightsOptions = {},
): Promise<void> {
  const {
    rate = 5000,
    roomsOnSale = 3,
    stopSell = false,
    minStay = null,
    closedToArrival = false,
    closedToDeparture = false,
    priced = true,
  } = options;

  for (const date of dates) {
    await prisma.roomInventory.upsert({
      where: { roomTypeId_date: { roomTypeId: room.roomTypeId, date } },
      update: { roomsOnSale, stopSell, minStay, closedToArrival, closedToDeparture },
      create: {
        roomTypeId: room.roomTypeId,
        hotelSlug,
        date,
        roomsOnSale,
        stopSell,
        minStay,
        closedToArrival,
        closedToDeparture,
      },
    });

    if (priced) {
      await prisma.ratePrice.upsert({
        where: { ratePlanId_date: { ratePlanId: room.ratePlanId, date } },
        update: { amount: rate },
        create: { ratePlanId: room.ratePlanId, hotelSlug, date, amount: rate },
      });
    }
  }
}

export async function clearNights(
  hotelSlug: string,
  range: { gte: Date; lt: Date },
): Promise<void> {
  await prisma.roomInventory.deleteMany({ where: { hotelSlug, date: range } });
  await prisma.ratePrice.deleteMany({ where: { hotelSlug, date: range } });
}

export { dateKey };
