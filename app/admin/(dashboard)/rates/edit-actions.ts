'use server';

import { recordAudit } from '@/lib/audit';
import { authorizeHotel } from '@/lib/auth';
import { heldBookingFilter } from '@/lib/availability';
import { addDays, dateKey, eachNight, nightsBetween, parseDateOnly } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import {
  type CellChange,
  type CellState,
  EMPTY_CELL,
  type OversellConflict,
  applyRateEdit,
  cellChanged,
  describeEdit,
  findOversellConflicts,
} from '@/lib/rate-edit';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import {
  type RateEditInput,
  copyRoomSchema,
  copyWeekSchema,
  rateEditSchema,
} from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

// A block selection times a date range is a rectangle, and a big one is easy
// to draw by accident. Bounding it keeps one submission to a single round trip
// per table rather than tens of thousands of row writes.
const MAX_CELLS = 2000;

export interface EditPreviewRow {
  roomName: string;
  ratePlanName: string;
  date: string;
  before: string;
  after: string;
}

export interface EditPreview {
  cells: number;
  changing: number;
  rooms: number;
  firstNight: string;
  lastNight: string;
  summary: string[];
  sample: EditPreviewRow[];
  // Everything needed to resubmit the identical edit. The confirmation posts
  // these back rather than re-reading the panel, so what is written is exactly
  // what was described — and the panel's own React state resetting when the
  // action resolves cannot quietly empty the submission.
  submitted: {
    rows: string[];
    dates: string[];
    from: string;
    to: string;
    weekdays: string[];
    rateMode: string;
    rateValue: string;
    roomsMode: string;
    roomsValue: string;
    stopSell: string;
    minStayMode: string;
    minStayValue: string;
    closedToArrival: string;
    closedToDeparture: string;
  };
}

export type RateEditState = {
  status: 'idle' | 'success' | 'error' | 'preview';
  message?: string;
  preview?: EditPreview;
  conflicts?: OversellConflict[];
};

function describeState(state: CellState): string {
  const bits = [
    state.rate === null ? 'unpriced' : `₹${state.rate.toLocaleString('en-IN')}`,
    `${state.roomsOnSale} on sale`,
  ];
  if (state.stopSell) bits.push('stop sell');
  if (state.minStay) bits.push(`min ${state.minStay}`);
  if (state.closedToArrival) bits.push('CTA');
  if (state.closedToDeparture) bits.push('CTD');
  return bits.join(' · ');
}

function resolveDates(input: RateEditInput): Date[] {
  const explicit = input.dates.map(parseDateOnly).filter((date): date is Date => date !== null);

  const dates =
    explicit.length > 0
      ? explicit
      : (() => {
          const from = parseDateOnly(input.from ?? '');
          const to = parseDateOnly(input.to ?? '');
          if (!from || !to || to < from) return [];
          return eachNight(from, addDays(to, 1));
        })();

  return dates
    .filter((date) => input.weekdays.length === 0 || input.weekdays.includes(date.getUTCDay()))
    .sort((a, b) => a.getTime() - b.getTime());
}

export async function editRates(
  _prevState: RateEditState,
  formData: FormData,
): Promise<RateEditState> {
  const parsed = rateEditSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    rows: formData.getAll('rows'),
    dates: formData.getAll('dates'),
    weekdays: formData.getAll('weekdays'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Select some nights and at least one change to make.' };
  }

  const input = parsed.data;
  const auth = await authorizeHotel('rates:write', input.hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`rates:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const summary = describeEdit(input);
  if (summary.length === 0) {
    return { status: 'error', message: 'Nothing to change — set at least one field.' };
  }

  const dates = resolveDates(input);
  if (dates.length === 0) {
    return { status: 'error', message: 'No nights fall in that selection.' };
  }

  const pairs = input.rows
    .map((row) => row.split(':'))
    .filter((parts): parts is [string, string] => parts.length === 2);

  if (pairs.length * dates.length > MAX_CELLS) {
    return {
      status: 'error',
      message: `That is ${(pairs.length * dates.length).toLocaleString()} nights at once — please work in blocks of ${MAX_CELLS.toLocaleString()} or fewer.`,
    };
  }

  // Every row must belong to the property being edited; otherwise a tampered
  // form could reprice someone else's rooms.
  const plans = await prisma.ratePlan.findMany({
    where: {
      id: { in: pairs.map(([, planId]) => planId) },
      hotelSlug: input.hotelSlug,
    },
    include: { roomType: true },
  });

  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const validPairs = pairs.filter(([roomTypeId, planId]) => {
    const plan = planById.get(planId);
    return plan && plan.roomTypeId === roomTypeId;
  });

  if (validPairs.length !== pairs.length) {
    return { status: 'error', message: 'Some of those rows do not belong to this property.' };
  }

  const roomTypeIds = [...new Set(validPairs.map(([roomTypeId]) => roomTypeId))];
  const ratePlanIds = validPairs.map(([, planId]) => planId);

  const [inventory, prices, heldBookings] = await Promise.all([
    prisma.roomInventory.findMany({
      where: { roomTypeId: { in: roomTypeIds }, date: { in: dates } },
    }),
    prisma.ratePrice.findMany({ where: { ratePlanId: { in: ratePlanIds }, date: { in: dates } } }),
    prisma.booking.findMany({
      where: {
        hotelSlug: input.hotelSlug,
        roomTypeId: { in: roomTypeIds },
        checkIn: { lt: addDays(dates[dates.length - 1] as Date, 1) },
        checkOut: { gt: dates[0] as Date },
        ...heldBookingFilter(new Date()),
      },
      select: { roomTypeId: true, rooms: true, checkIn: true, checkOut: true },
    }),
  ]);

  const inventoryKey = (roomTypeId: string, date: string) => `${roomTypeId}:${date}`;
  const inventoryByKey = new Map(
    inventory.map((row) => [inventoryKey(row.roomTypeId, dateKey(row.date)), row]),
  );
  const priceByKey = new Map(
    prices.map((row) => [`${row.ratePlanId}:${dateKey(row.date)}`, row.amount.toNumber()]),
  );

  const soldByKey = new Map<string, number>();
  for (const booking of heldBookings) {
    if (!booking.roomTypeId) continue;
    for (const night of eachNight(booking.checkIn, booking.checkOut)) {
      const key = inventoryKey(booking.roomTypeId, dateKey(night));
      soldByKey.set(key, (soldByKey.get(key) ?? 0) + booking.rooms);
    }
  }

  const changes: CellChange[] = [];
  for (const [roomTypeId, ratePlanId] of validPairs) {
    for (const date of dates) {
      const key = dateKey(date);
      const row = inventoryByKey.get(inventoryKey(roomTypeId, key));
      const before: CellState = row
        ? {
            rate: priceByKey.get(`${ratePlanId}:${key}`) ?? null,
            roomsOnSale: row.roomsOnSale,
            stopSell: row.stopSell,
            minStay: row.minStay,
            closedToArrival: row.closedToArrival,
            closedToDeparture: row.closedToDeparture,
          }
        : { ...EMPTY_CELL, rate: priceByKey.get(`${ratePlanId}:${key}`) ?? null };

      changes.push({
        roomTypeId,
        ratePlanId,
        date: key,
        before,
        after: applyRateEdit(before, input),
      });
    }
  }

  const conflicts = findOversellConflicts(
    changes,
    (roomTypeId, date) => soldByKey.get(inventoryKey(roomTypeId, date)) ?? 0,
    (roomTypeId) =>
      plans.find((plan) => plan.roomTypeId === roomTypeId)?.roomType.name ?? roomTypeId,
  );

  const changing = changes.filter((change) => cellChanged(change.before, change.after));

  if (conflicts.length > 0) {
    return {
      status: 'error',
      message: `${conflicts.length} ${conflicts.length === 1 ? 'night is' : 'nights are'} already sold beyond that allotment. Nothing was changed.`,
      conflicts,
    };
  }

  if (!input.confirmed) {
    return {
      status: 'preview',
      preview: {
        cells: changes.length,
        changing: changing.length,
        rooms: roomTypeIds.length,
        firstNight: dateKey(dates[0] as Date),
        lastNight: dateKey(dates[dates.length - 1] as Date),
        summary,
        submitted: {
          rows: validPairs.map(([roomTypeId, planId]) => `${roomTypeId}:${planId}`),
          dates: input.dates,
          from: input.from ?? '',
          to: input.to ?? '',
          weekdays: input.weekdays.map(String),
          rateMode: input.rateMode,
          rateValue: input.rateValue === undefined ? '' : String(input.rateValue),
          roomsMode: input.roomsMode,
          roomsValue: input.roomsValue === undefined ? '' : String(input.roomsValue),
          stopSell: input.stopSell,
          minStayMode: input.minStayMode,
          minStayValue: input.minStayValue === undefined ? '' : String(input.minStayValue),
          closedToArrival: input.closedToArrival,
          closedToDeparture: input.closedToDeparture,
        },
        sample: changing.slice(0, 12).map((change) => {
          const plan = planById.get(change.ratePlanId);
          return {
            roomName: plan?.roomType.name ?? '',
            ratePlanName: plan?.name ?? '',
            date: change.date,
            before: describeState(change.before),
            after: describeState(change.after),
          };
        }),
      },
    };
  }

  // The after-state is complete for every cell, so replacing the rows outright
  // is both correct and one round trip per table — an upsert per cell would be
  // thousands of queries for the same result.
  const inventoryRows = new Map<string, CellState & { roomTypeId: string; date: Date }>();
  for (const change of changes) {
    const date = parseDateOnly(change.date);
    if (!date) continue;
    inventoryRows.set(inventoryKey(change.roomTypeId, change.date), {
      ...change.after,
      roomTypeId: change.roomTypeId,
      date,
    });
  }

  await prisma.$transaction([
    prisma.roomInventory.deleteMany({
      where: { roomTypeId: { in: roomTypeIds }, date: { in: dates } },
    }),
    prisma.roomInventory.createMany({
      data: [...inventoryRows.values()].map((row) => ({
        roomTypeId: row.roomTypeId,
        hotelSlug: input.hotelSlug,
        date: row.date,
        roomsOnSale: row.roomsOnSale,
        stopSell: row.stopSell,
        minStay: row.minStay,
        closedToArrival: row.closedToArrival,
        closedToDeparture: row.closedToDeparture,
      })),
    }),
    prisma.ratePrice.deleteMany({
      where: { ratePlanId: { in: ratePlanIds }, date: { in: dates } },
    }),
    prisma.ratePrice.createMany({
      data: changes
        .filter((change) => change.after.rate !== null)
        .map((change) => ({
          ratePlanId: change.ratePlanId,
          hotelSlug: input.hotelSlug,
          date: parseDateOnly(change.date) as Date,
          amount: change.after.rate as number,
        })),
    }),
  ]);

  await recordAudit({
    user: auth.user,
    action: 'rates.bulk_edited',
    entity: 'RoomInventory',
    hotelSlug: input.hotelSlug,
    summary: `${summary.join(', ')} — ${changing.length} of ${changes.length} nights changed across ${roomTypeIds.length} ${roomTypeIds.length === 1 ? 'room' : 'rooms'}`,
    before: changing.slice(0, 200).map((change) => ({ date: change.date, ...change.before })),
    after: {
      firstNight: dateKey(dates[0] as Date),
      lastNight: dateKey(dates[dates.length - 1] as Date),
      edit: summary,
    },
    ip,
  });

  log.info('rates.bulk_edited', {
    hotel: input.hotelSlug,
    rooms: roomTypeIds.length,
    nights: dates.length,
    cells: changes.length,
    cells_changed: changing.length,
  });

  revalidatePath('/admin/rates');

  return {
    status: 'success',
    message: `${changing.length} of ${changes.length} nights changed.`,
  };
}

export type CopyState = {
  status: 'idle' | 'success' | 'error' | 'preview';
  message?: string;
  nights?: number;
  conflicts?: OversellConflict[];
};

// Copies one loaded week forward by weekday, so "weekends cost more" is
// entered once rather than per week. A target night whose weekday has nothing
// loaded in the source week is left alone rather than blanked — the source is
// a pattern, not a mask.
export async function copyWeek(_prevState: CopyState, formData: FormData): Promise<CopyState> {
  const parsed = copyWeekSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: 'error', message: 'Please check the dates.' };

  const input = parsed.data;
  const auth = await authorizeHotel('rates:write', input.hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`rates:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const weekStart = parseDateOnly(input.sourceWeekStart);
  const targetFrom = parseDateOnly(input.targetFrom);
  const targetTo = parseDateOnly(input.targetTo);
  if (!weekStart || !targetFrom || !targetTo || targetTo < targetFrom) {
    return { status: 'error', message: 'Please choose a valid range.' };
  }
  if (nightsBetween(targetFrom, targetTo) + 1 > MAX_CELLS) {
    return { status: 'error', message: 'That range is too long to copy in one go.' };
  }

  const plan = await prisma.ratePlan.findFirst({
    where: { id: input.ratePlanId, roomTypeId: input.roomTypeId, hotelSlug: input.hotelSlug },
    include: { roomType: true },
  });
  if (!plan)
    return { status: 'error', message: 'That room and plan do not belong to this property.' };

  const sourceWeek = eachNight(weekStart, addDays(weekStart, 7));
  const [sourceInventory, sourcePrices] = await Promise.all([
    prisma.roomInventory.findMany({
      where: { roomTypeId: input.roomTypeId, date: { in: sourceWeek } },
    }),
    prisma.ratePrice.findMany({
      where: { ratePlanId: input.ratePlanId, date: { in: sourceWeek } },
    }),
  ]);

  if (sourceInventory.length === 0) {
    return { status: 'error', message: 'That week has nothing loaded to copy.' };
  }

  const priceByDate = new Map(
    sourcePrices.map((row) => [dateKey(row.date), row.amount.toNumber()]),
  );
  const patternByWeekday = new Map<number, CellState>();
  for (const row of sourceInventory) {
    patternByWeekday.set(row.date.getUTCDay(), {
      rate: priceByDate.get(dateKey(row.date)) ?? null,
      roomsOnSale: row.roomsOnSale,
      stopSell: row.stopSell,
      minStay: row.minStay,
      closedToArrival: row.closedToArrival,
      closedToDeparture: row.closedToDeparture,
    });
  }

  const targets = eachNight(targetFrom, addDays(targetTo, 1)).filter((date) =>
    patternByWeekday.has(date.getUTCDay()),
  );
  if (targets.length === 0) {
    return { status: 'error', message: 'No nights in that range match the week you copied.' };
  }

  const heldBookings = await prisma.booking.findMany({
    where: {
      hotelSlug: input.hotelSlug,
      roomTypeId: input.roomTypeId,
      checkIn: { lt: addDays(targetTo, 1) },
      checkOut: { gt: targetFrom },
      ...heldBookingFilter(new Date()),
    },
    select: { rooms: true, checkIn: true, checkOut: true },
  });

  const soldByDate = new Map<string, number>();
  for (const booking of heldBookings) {
    for (const night of eachNight(booking.checkIn, booking.checkOut)) {
      const key = dateKey(night);
      soldByDate.set(key, (soldByDate.get(key) ?? 0) + booking.rooms);
    }
  }

  const changes: CellChange[] = targets.map((date) => {
    const after = patternByWeekday.get(date.getUTCDay()) as CellState;
    return {
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
      date: dateKey(date),
      before: EMPTY_CELL,
      after,
    };
  });

  const conflicts = findOversellConflicts(
    changes,
    (_roomTypeId, date) => soldByDate.get(date) ?? 0,
    () => plan.roomType.name,
  );
  if (conflicts.length > 0) {
    return {
      status: 'error',
      message: `${conflicts.length} ${conflicts.length === 1 ? 'night is' : 'nights are'} already sold beyond the allotment that week. Nothing was changed.`,
      conflicts,
    };
  }

  if (!input.confirmed) {
    return {
      status: 'preview',
      nights: targets.length,
      message: `This copies ${targets.length} ${targets.length === 1 ? 'night' : 'nights'} onto ${plan.roomType.name} · ${plan.name}.`,
    };
  }

  await prisma.$transaction([
    prisma.roomInventory.deleteMany({
      where: { roomTypeId: input.roomTypeId, date: { in: targets } },
    }),
    prisma.roomInventory.createMany({
      data: changes.map((change) => ({
        roomTypeId: input.roomTypeId,
        hotelSlug: input.hotelSlug,
        date: parseDateOnly(change.date) as Date,
        roomsOnSale: change.after.roomsOnSale,
        stopSell: change.after.stopSell,
        minStay: change.after.minStay,
        closedToArrival: change.after.closedToArrival,
        closedToDeparture: change.after.closedToDeparture,
      })),
    }),
    prisma.ratePrice.deleteMany({
      where: { ratePlanId: input.ratePlanId, date: { in: targets } },
    }),
    prisma.ratePrice.createMany({
      data: changes
        .filter((change) => change.after.rate !== null)
        .map((change) => ({
          ratePlanId: input.ratePlanId,
          hotelSlug: input.hotelSlug,
          date: parseDateOnly(change.date) as Date,
          amount: change.after.rate as number,
        })),
    }),
  ]);

  await recordAudit({
    user: auth.user,
    action: 'rates.week_copied',
    entity: 'RoomInventory',
    entityId: input.roomTypeId,
    hotelSlug: input.hotelSlug,
    summary: `${plan.roomType.name} · ${plan.name}: week of ${input.sourceWeekStart} copied across ${targets.length} nights`,
    after: { from: input.targetFrom, to: input.targetTo, nights: targets.length },
    ip,
  });

  revalidatePath('/admin/rates');
  return { status: 'success', message: `${targets.length} nights copied.` };
}

// Copies one rate plan's prices onto another, optionally at a difference.
// Only prices move: inventory belongs to the room type, and the target room
// has its own allotment that this must not overwrite.
export async function copyRoomRates(_prevState: CopyState, formData: FormData): Promise<CopyState> {
  const parsed = copyRoomSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: 'error', message: 'Please check the fields.' };

  const input = parsed.data;
  const auth = await authorizeHotel('rates:write', input.hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  if (input.sourceRatePlanId === input.targetRatePlanId) {
    return { status: 'error', message: 'Pick two different rate plans.' };
  }

  const ip = clientIp(await headers());
  if (isRateLimited(`rates:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const from = parseDateOnly(input.from);
  const to = parseDateOnly(input.to);
  if (!from || !to || to < from)
    return { status: 'error', message: 'Please choose a valid range.' };
  if (nightsBetween(from, to) + 1 > MAX_CELLS) {
    return { status: 'error', message: 'That range is too long to copy in one go.' };
  }

  const plans = await prisma.ratePlan.findMany({
    where: {
      id: { in: [input.sourceRatePlanId, input.targetRatePlanId] },
      hotelSlug: input.hotelSlug,
    },
    include: { roomType: true },
  });
  if (plans.length !== 2) {
    return { status: 'error', message: 'Those rate plans do not both belong to this property.' };
  }

  const dates = eachNight(from, addDays(to, 1));
  const sourcePrices = await prisma.ratePrice.findMany({
    where: { ratePlanId: input.sourceRatePlanId, date: { in: dates } },
  });

  if (sourcePrices.length === 0) {
    return {
      status: 'error',
      message: 'The room you are copying from has no prices in that range.',
    };
  }

  const difference = input.differenceValue ?? 0;
  const priced = sourcePrices.map((row) => {
    const base = row.amount.toNumber();
    const amount =
      input.differenceMode === 'amount'
        ? base + difference
        : input.differenceMode === 'percent'
          ? base * (1 + difference / 100)
          : base;
    return { date: row.date, amount: Math.max(0, Math.round(amount * 100) / 100) };
  });

  if (!input.confirmed) {
    return {
      status: 'preview',
      nights: priced.length,
      message: `This prices ${priced.length} ${priced.length === 1 ? 'night' : 'nights'} on the target room. Its allotment is not touched.`,
    };
  }

  await prisma.$transaction([
    prisma.ratePrice.deleteMany({
      where: { ratePlanId: input.targetRatePlanId, date: { in: priced.map((row) => row.date) } },
    }),
    prisma.ratePrice.createMany({
      data: priced.map((row) => ({
        ratePlanId: input.targetRatePlanId,
        hotelSlug: input.hotelSlug,
        date: row.date,
        amount: row.amount,
      })),
    }),
  ]);

  const source = plans.find((plan) => plan.id === input.sourceRatePlanId);
  const target = plans.find((plan) => plan.id === input.targetRatePlanId);

  await recordAudit({
    user: auth.user,
    action: 'rates.room_copied',
    entity: 'RatePrice',
    entityId: input.targetRatePlanId,
    hotelSlug: input.hotelSlug,
    summary: `${source?.roomType.name} · ${source?.name} copied onto ${target?.roomType.name} · ${target?.name} for ${priced.length} nights`,
    after: {
      from: input.from,
      to: input.to,
      differenceMode: input.differenceMode,
      differenceValue: difference,
    },
    ip,
  });

  revalidatePath('/admin/rates');
  return { status: 'success', message: `${priced.length} nights priced.` };
}
