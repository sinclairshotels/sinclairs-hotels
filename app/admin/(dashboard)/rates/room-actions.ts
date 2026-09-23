'use server';

import { getHotelBySlug } from '@/content/hotels';
import { recordAudit } from '@/lib/audit';
import { authorizeHotel } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import {
  addRoomTypeSchema,
  deactivateRoomTypeSchema,
  hotelSetupSchema,
  roomTypeSchema,
} from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type SetupState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

async function guard(hotelSlug: string) {
  const auth = await authorizeHotel('rates:write', hotelSlug);
  if (!auth.ok) return { ok: false as const, message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`setup:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { ok: false as const, message: 'Too many requests. Please try again in a minute.' };
  }
  return { ok: true as const, user: auth.user, ip };
}

function refresh() {
  revalidatePath('/admin/rates');
  revalidatePath('/admin/rates/monthly');
  revalidatePath('/admin/rates/daily');
}

export async function saveHotelSetup(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = hotelSetupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: 'error', message: 'Please check the breakfast supplement.' };
  }

  const { hotelSlug, breakfastSupplement, refundableUpliftPct, freeCancellationDays } = parsed.data;
  const auth = await guard(hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const before = await prisma.hotelSettings.findUnique({ where: { hotelSlug } });
  const previous = {
    breakfastSupplement: before?.breakfastSupplement.toNumber() ?? 0,
    refundableUpliftPct: before?.refundableUpliftPct?.toNumber() ?? null,
    freeCancellationDays: before?.freeCancellationDays ?? null,
  };
  const next = {
    breakfastSupplement,
    refundableUpliftPct: refundableUpliftPct ?? null,
    freeCancellationDays: freeCancellationDays ?? null,
  };

  if (
    previous.breakfastSupplement === next.breakfastSupplement &&
    previous.refundableUpliftPct === next.refundableUpliftPct &&
    previous.freeCancellationDays === next.freeCancellationDays
  ) {
    return { status: 'success', message: 'Nothing changed.' };
  }

  await prisma.hotelSettings.upsert({
    where: { hotelSlug },
    update: next,
    create: { hotelSlug, ...next },
  });

  // Turning the refundable rate on or off changes what the property sells, so
  // it is worth its own line in the log rather than hiding inside a diff.
  const policyLine =
    next.refundableUpliftPct === null
      ? 'no refundable rate'
      : `refundable at +${next.refundableUpliftPct}% free until ${next.freeCancellationDays} days before check-in`;

  await recordAudit({
    user: auth.user,
    action: 'setup.changed',
    entity: 'HotelSettings',
    entityId: hotelSlug,
    hotelSlug,
    summary: `Breakfast ₹${breakfastSupplement.toLocaleString('en-IN')} per person per night; ${policyLine}`,
    before: previous,
    after: next,
    ip: auth.ip,
  });
  log.info('setup.changed', {
    hotel: hotelSlug,
    amount: breakfastSupplement,
    refundable_uplift_pct: next.refundableUpliftPct,
    free_cancellation_days: next.freeCancellationDays,
  });

  refresh();
  return {
    status: 'success',
    message:
      next.refundableUpliftPct === null
        ? 'Saved. This property sells the non-refundable rate only.'
        : `Saved. Refundable rate is +${next.refundableUpliftPct}%, free to cancel until ${next.freeCancellationDays} days before check-in.`,
  };
}

export async function saveRoomType(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = roomTypeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Please check the room.',
    };
  }

  const input = parsed.data;
  const auth = await guard(input.hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  if (input.maxAdults + input.maxChildren < input.baseOccupancy) {
    return {
      status: 'error',
      message: 'The room cannot hold fewer guests in total than its rate covers.',
    };
  }

  const before = await prisma.roomType.findFirst({
    where: { id: input.roomTypeId, hotelSlug: input.hotelSlug },
  });
  if (!before) return { status: 'error', message: 'That room does not belong to this property.' };

  const after = await prisma.roomType.update({
    where: { id: before.id },
    data: {
      name: input.name,
      baseOccupancy: input.baseOccupancy,
      maxAdults: input.maxAdults,
      maxChildren: input.maxChildren,
      maxTotal: input.maxAdults + input.maxChildren,
      extraAdultCharge: input.extraAdultCharge,
      extraChildCharge: input.extraChildCharge,
      sizeSqFt: input.sizeSqFt ?? null,
    },
  });

  const renamed = before.name !== after.name;
  await recordAudit({
    user: auth.user,
    action: renamed ? 'setup.room_renamed' : 'setup.room_changed',
    entity: 'RoomType',
    entityId: before.id,
    hotelSlug: input.hotelSlug,
    summary: renamed ? `${before.name} renamed to ${after.name}` : `${after.name} updated`,
    before: {
      name: before.name,
      baseOccupancy: before.baseOccupancy,
      maxAdults: before.maxAdults,
      maxChildren: before.maxChildren,
      extraAdultCharge: before.extraAdultCharge.toNumber(),
      extraChildCharge: before.extraChildCharge.toNumber(),
      sizeSqFt: before.sizeSqFt,
    },
    after: {
      name: after.name,
      baseOccupancy: after.baseOccupancy,
      maxAdults: after.maxAdults,
      maxChildren: after.maxChildren,
      extraAdultCharge: after.extraAdultCharge.toNumber(),
      extraChildCharge: after.extraChildCharge.toNumber(),
      sizeSqFt: after.sizeSqFt,
    },
    ip: auth.ip,
  });
  log.info(renamed ? 'setup.room_renamed' : 'setup.room_changed', {
    hotel: input.hotelSlug,
    room_type_id: before.id,
  });

  refresh();
  // The public hotel page reads these names too.
  revalidatePath(`/hotels/${input.hotelSlug}`);

  return {
    status: 'success',
    message: renamed
      ? `Renamed to ${after.name}. The public site shows the new name within ten minutes.`
      : `${after.name} saved.`,
  };
}

export async function addRoomType(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = addRoomTypeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Give the room a name.' };
  }

  const { hotelSlug, name } = parsed.data;
  const auth = await guard(hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  // contentKey is the join to content/hotels for photography and copy. A room
  // added here has no content entry yet, so it starts with the name as its key
  // — matching one added to the content files later under the same name.
  const existing = await prisma.roomType.findUnique({
    where: { hotelSlug_contentKey: { hotelSlug, contentKey: name } },
  });
  if (existing) {
    if (existing.active) {
      return { status: 'error', message: `${name} already exists at this property.` };
    }
    await prisma.roomType.update({ where: { id: existing.id }, data: { active: true } });
    refresh();
    return { status: 'success', message: `${existing.name} is back on sale.` };
  }

  const last = await prisma.roomType.findFirst({
    where: { hotelSlug },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const created = await prisma.roomType.create({
    data: { hotelSlug, contentKey: name, name, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  // Two plans, and only Room Only is ever priced — see lib/availability.ts.
  await prisma.ratePlan.createMany({
    data: [
      { hotelSlug, roomTypeId: created.id, code: 'EP', name: 'Room Only', sortOrder: 0 },
      { hotelSlug, roomTypeId: created.id, code: 'CP', name: 'With Breakfast', sortOrder: 1 },
    ],
  });

  await recordAudit({
    user: auth.user,
    action: 'setup.room_added',
    entity: 'RoomType',
    entityId: created.id,
    hotelSlug,
    summary: `${name} added`,
    after: { name },
    ip: auth.ip,
  });
  log.info('setup.room_added', { hotel: hotelSlug, room_type_id: created.id });

  refresh();
  revalidatePath(`/hotels/${hotelSlug}`);

  const hasPhoto = getHotelBySlug(hotelSlug)?.rooms.some((room) => room.name === name);
  return {
    status: 'success',
    message: hasPhoto
      ? `${name} added.`
      : `${name} added. It has no photo yet — add one to content/hotels to show it on the website.`,
  };
}

export async function deactivateRoomType(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const parsed = deactivateRoomTypeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: 'error', message: 'That room could not be read.' };

  const { hotelSlug, roomTypeId } = parsed.data;
  const auth = await guard(hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const room = await prisma.roomType.findFirst({ where: { id: roomTypeId, hotelSlug } });
  if (!room) return { status: 'error', message: 'That room does not belong to this property.' };

  // Deactivated, never deleted: the room's bookings, rates and audit history
  // all point at this row, and removing it would orphan every one of them.
  await prisma.roomType.update({ where: { id: room.id }, data: { active: false } });

  const upcoming = await prisma.booking.count({
    where: {
      roomTypeId: room.id,
      checkOut: { gte: new Date() },
      status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
    },
  });

  await recordAudit({
    user: auth.user,
    action: 'setup.room_removed',
    entity: 'RoomType',
    entityId: room.id,
    hotelSlug,
    summary: `${room.name} removed from sale${upcoming > 0 ? ` — ${upcoming} booking${upcoming === 1 ? '' : 's'} still to arrive` : ''}`,
    before: { active: true },
    after: { active: false },
    ip: auth.ip,
  });
  log.info('setup.room_removed', { hotel: hotelSlug, room_type_id: room.id, upcoming });

  refresh();
  revalidatePath(`/hotels/${hotelSlug}`);

  return {
    status: 'success',
    message:
      upcoming > 0
        ? `${room.name} is off sale. ${upcoming} booking${upcoming === 1 ? '' : 's'} already taken still stand.`
        : `${room.name} is off sale. Its history is kept.`,
  };
}
