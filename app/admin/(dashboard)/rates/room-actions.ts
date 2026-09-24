'use server';

import { getHotelBySlug } from '@/content/hotels';
import { recordAudit } from '@/lib/audit';
import { authorizeHotel } from '@/lib/auth';
import { dateKey, formatStayDate, parseDateOnly } from '@/lib/booking';
import { DEFAULT_CHILD_POLICY } from '@/lib/child-ages';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { roomFacilityOptions } from '@/lib/room-facilities';
import {
  addRoomTypeSchema,
  deactivateRoomTypeSchema,
  hotelSetupSchema,
  nonRefundableWindowSchema,
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

// A posted key is only kept if the catalogue knows it, or the room's own copy
// does — the checklist's options are exactly those two sets, so anything else
// was typed by hand at the form.
function allowedFacilities(
  hotelSlug: string,
  contentKey: string,
  posted: FormDataEntryValue[],
): string[] {
  const room = getHotelBySlug(hotelSlug)?.rooms.find((r) => r.name === contentKey);
  const allowed = new Set(roomFacilityOptions(room).map((facility) => facility.key));
  return [...new Set(posted.map(String))].filter((key) => allowed.has(key));
}

function refresh() {
  revalidatePath('/admin/rates');
  revalidatePath('/admin/rates/monthly');
  revalidatePath('/admin/rates/daily');
}

export async function saveHotelSetup(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const parsed = hotelSetupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    // The schema's own message, not a guess. This form saves three fields and
    // used to answer every refusal with "Please check the breakfast
    // supplement" — so a property with an uplift and no cancellation deadline
    // could never save its supplement and was told the supplement was the
    // problem. The half-a-policy rule is the one that actually fires.
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Please check the figures on this form.',
    };
  }

  const {
    hotelSlug,
    breakfastSupplement,
    refundableUpliftPct,
    freeCancellationDays,
    childFreeUnder,
    childMaxAge,
  } = parsed.data;
  const auth = await guard(hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const before = await prisma.hotelSettings.findUnique({ where: { hotelSlug } });
  const previous = {
    breakfastSupplement: before?.breakfastSupplement.toNumber() ?? 0,
    refundableUpliftPct: before?.refundableUpliftPct?.toNumber() ?? null,
    freeCancellationDays: before?.freeCancellationDays ?? null,
    childFreeUnder: before?.childFreeUnder ?? DEFAULT_CHILD_POLICY.freeUnder,
    childMaxAge: before?.childMaxAge ?? DEFAULT_CHILD_POLICY.childMaxAge,
  };
  const next = {
    breakfastSupplement,
    refundableUpliftPct: refundableUpliftPct ?? null,
    freeCancellationDays: freeCancellationDays ?? null,
    childFreeUnder,
    childMaxAge,
  };

  if (
    previous.breakfastSupplement === next.breakfastSupplement &&
    previous.refundableUpliftPct === next.refundableUpliftPct &&
    previous.freeCancellationDays === next.freeCancellationDays &&
    previous.childFreeUnder === next.childFreeUnder &&
    previous.childMaxAge === next.childMaxAge
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
    summary: `Breakfast ₹${breakfastSupplement.toLocaleString('en-IN')} per person per night; ${policyLine}; free under ${childFreeUnder}, child to ${childMaxAge}`,
    before: previous,
    after: next,
    ip: auth.ip,
  });
  log.info('setup.changed', {
    hotel: hotelSlug,
    amount: breakfastSupplement,
    refundable_uplift_pct: next.refundableUpliftPct,
    free_cancellation_days: next.freeCancellationDays,
    child_free_under: childFreeUnder,
    child_max_age: childMaxAge,
  });

  // The booking engine reads these on every search, so a change reaches the
  // guest immediately; these paths are the staff-side views of the same rows.
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

  // Checkboxes, so getAll rather than the entries object the schema parsed —
  // Object.fromEntries keeps only the last of a repeated field. Left alone
  // unless the checklist was actually touched: saving the room's occupancy
  // should not quietly freeze today's derived list into the database.
  const facilities = formData.get('facilitiesEdited')
    ? allowedFacilities(input.hotelSlug, before.contentKey, formData.getAll('facilities'))
    : before.facilities;

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
      facilities,
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
      facilities: before.facilities,
    },
    after: {
      name: after.name,
      baseOccupancy: after.baseOccupancy,
      maxAdults: after.maxAdults,
      maxChildren: after.maxChildren,
      extraAdultCharge: after.extraAdultCharge.toNumber(),
      extraChildCharge: after.extraChildCharge.toNumber(),
      sizeSqFt: after.sizeSqFt,
      facilities: after.facilities,
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

// Dates a property sells on non-refundable terms only. Added and removed rather
// than edited: a window is two dates, and "change the end" is the same keystroke
// count as removing it and adding the right one, with one fewer way to end up
// with a start after its end.
export async function addNonRefundableWindow(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const parsed = nonRefundableWindowSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Please check the dates.',
    };
  }

  const { hotelSlug, label } = parsed.data;
  const auth = await guard(hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const startDate = parseDateOnly(parsed.data.startDate);
  const endDate = parseDateOnly(parsed.data.endDate);
  if (!startDate || !endDate) return { status: 'error', message: 'Please check the dates.' };
  if (endDate < startDate) {
    return { status: 'error', message: 'The last date cannot be before the first.' };
  }

  const window = await prisma.nonRefundableWindow.create({
    data: { hotelSlug, startDate, endDate, label: label || null },
  });

  const span = `${formatStayDate(startDate)} to ${formatStayDate(endDate)}`;
  await recordAudit({
    user: auth.user,
    action: 'setup.non_refundable_window_added',
    entity: 'NonRefundableWindow',
    entityId: window.id,
    hotelSlug,
    summary: `${label || 'Non-refundable only'}: ${span} — no refundable rate offered`,
    before: null,
    after: { startDate: dateKey(startDate), endDate: dateKey(endDate), label: label || null },
    ip: auth.ip,
  });
  log.info('setup.non_refundable_window_added', {
    hotel: hotelSlug,
    start: dateKey(startDate),
    end: dateKey(endDate),
  });

  refresh();
  return { status: 'success', message: `${span} is non-refundable only.` };
}

export async function removeNonRefundableWindow(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const id = String(formData.get('id') ?? '');
  const hotelSlug = String(formData.get('hotelSlug') ?? '');
  const auth = await guard(hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  // Matched on the property too, so a window id from another property cannot be
  // deleted by someone scoped away from it.
  const before = await prisma.nonRefundableWindow.findFirst({ where: { id, hotelSlug } });
  if (!before) return { status: 'error', message: 'That period no longer exists.' };

  await prisma.nonRefundableWindow.delete({ where: { id: before.id } });

  const span = `${formatStayDate(before.startDate)} to ${formatStayDate(before.endDate)}`;
  await recordAudit({
    user: auth.user,
    action: 'setup.non_refundable_window_removed',
    entity: 'NonRefundableWindow',
    entityId: before.id,
    hotelSlug,
    summary: `${before.label || 'Non-refundable only'}: ${span} — refundable rate offered again`,
    before: {
      startDate: dateKey(before.startDate),
      endDate: dateKey(before.endDate),
      label: before.label,
    },
    after: null,
    ip: auth.ip,
  });
  log.info('setup.non_refundable_window_removed', { hotel: hotelSlug, window_id: before.id });

  refresh();
  return { status: 'success', message: `${span} sells the refundable rate again.` };
}
