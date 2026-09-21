'use server';

import { recordAudit } from '@/lib/audit';
import { authorizeHotel } from '@/lib/auth';
import { heldBookingFilter } from '@/lib/availability';
import { addDays, dateKey, eachNight, parseDateOnly, todayUtc } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import {
  type CellChange,
  type CellState,
  EMPTY_CELL,
  MONTHS_AHEAD,
  type MonthlyValue,
  type OversellConflict,
  applyMonthly,
  cellChanged,
  datesInMonth,
  describeMonthly,
  findOversellConflicts,
  isMonthKey,
  monthLabel,
  monthsAhead,
} from '@/lib/rate-plan';
import { dailyRateSchema, monthlyCellSchema, monthlyRatesSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

// Twelve months across a dozen rooms is already ~4,000 nights. The ceiling is
// there so one accidental save cannot become a six-figure row count, not
// because staff would ever legitimately need more in one go.
const MAX_NIGHTS = 12_000;

export interface MonthlyPreview {
  nights: number;
  changing: number;
  overrides: number;
  months: number;
  rooms: number;
  summary: string[];
}

export type MonthlyRatesState = {
  status: 'idle' | 'success' | 'error' | 'preview';
  message?: string;
  preview?: MonthlyPreview;
  conflicts?: OversellConflict[];
  // Echoed back so the confirmation writes exactly what was previewed rather
  // than re-reading a form React has since reset.
  submitted?: { cells: string; overrides: 'keep' | 'replace' };
};

interface PlannedCell {
  roomTypeId: string;
  month: string;
  value: MonthlyValue;
}

function parseCells(raw: string): PlannedCell[] | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(decoded)) return null;

  const cells: PlannedCell[] = [];
  for (const entry of decoded) {
    const parsed = monthlyCellSchema.safeParse(entry);
    if (!parsed.success) return null;
    const { roomTypeId, month, roomsOnSale, rate } = parsed.data;
    if (!isMonthKey(month)) return null;
    // A cell with neither field filled is a cell staff left alone.
    if (roomsOnSale === undefined && rate === undefined) continue;
    cells.push({ roomTypeId, month, value: { roomsOnSale, rate } });
  }
  return cells;
}

interface RoomContext {
  roomTypeId: string;
  roomName: string;
  ratePlanId: string;
}

// Rooms on sale belong to the room type; price belongs to a rate plan, and the
// screens set Room Only. Meal-plan pricing is deliberately still parked, so
// the other plans keep whatever they already hold.
async function roomsFor(
  hotelSlug: string,
  roomTypeIds: string[],
): Promise<Map<string, RoomContext>> {
  const plans = await prisma.ratePlan.findMany({
    where: { hotelSlug, code: 'EP', roomTypeId: { in: roomTypeIds } },
    include: { roomType: true },
  });

  return new Map(
    plans.map((plan) => [
      plan.roomTypeId,
      { roomTypeId: plan.roomTypeId, roomName: plan.roomType.name, ratePlanId: plan.id },
    ]),
  );
}

interface NightRow {
  roomTypeId: string;
  ratePlanId: string;
  date: Date;
  key: string;
}

async function loadState(
  hotelSlug: string,
  roomTypeIds: string[],
  ratePlanIds: string[],
  dates: Date[],
) {
  const [inventory, prices, held] = await Promise.all([
    prisma.roomInventory.findMany({
      where: { roomTypeId: { in: roomTypeIds }, date: { in: dates } },
    }),
    prisma.ratePrice.findMany({
      where: { ratePlanId: { in: ratePlanIds }, date: { in: dates } },
    }),
    prisma.booking.findMany({
      where: {
        hotelSlug,
        roomTypeId: { in: roomTypeIds },
        checkIn: { lt: addDays(dates[dates.length - 1] as Date, 1) },
        checkOut: { gt: dates[0] as Date },
        ...heldBookingFilter(new Date()),
      },
      select: { roomTypeId: true, rooms: true, checkIn: true, checkOut: true },
    }),
  ]);

  const inventoryByKey = new Map(
    inventory.map((row) => [`${row.roomTypeId}:${dateKey(row.date)}`, row]),
  );
  const priceByKey = new Map(prices.map((row) => [`${row.ratePlanId}:${dateKey(row.date)}`, row]));

  const soldByKey = new Map<string, number>();
  for (const booking of held) {
    if (!booking.roomTypeId) continue;
    for (const night of eachNight(booking.checkIn, booking.checkOut)) {
      const key = `${booking.roomTypeId}:${dateKey(night)}`;
      soldByKey.set(key, (soldByKey.get(key) ?? 0) + booking.rooms);
    }
  }

  return { inventoryByKey, priceByKey, soldByKey };
}

export async function saveMonthlyRates(
  _prev: MonthlyRatesState,
  formData: FormData,
): Promise<MonthlyRatesState> {
  const parsed = monthlyRatesSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: 'error', message: 'That submission was not readable. Please try again.' };
  }

  const input = parsed.data;
  const auth = await authorizeHotel('rates:write', input.hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`rates:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const cells = parseCells(input.cells);
  if (cells === null) {
    return { status: 'error', message: 'That submission was not readable. Please try again.' };
  }
  if (cells.length === 0) {
    return { status: 'error', message: 'Nothing to save — fill in at least one month.' };
  }

  const today = todayUtc();
  const allowedMonths = new Set(monthsAhead(today, MONTHS_AHEAD));
  if (cells.some((cell) => !allowedMonths.has(cell.month))) {
    return { status: 'error', message: 'That month is outside the twelve months on offer.' };
  }

  const roomTypeIds = [...new Set(cells.map((cell) => cell.roomTypeId))];
  const rooms = await roomsFor(input.hotelSlug, roomTypeIds);
  if (rooms.size !== roomTypeIds.length) {
    return { status: 'error', message: 'Some of those rooms do not belong to this property.' };
  }

  // Expand every filled month into its nights, skipping any already past.
  const nights: Array<NightRow & { value: MonthlyValue }> = [];
  for (const cell of cells) {
    const room = rooms.get(cell.roomTypeId) as RoomContext;
    for (const date of datesInMonth(cell.month, today)) {
      nights.push({
        roomTypeId: room.roomTypeId,
        ratePlanId: room.ratePlanId,
        date,
        key: dateKey(date),
        value: cell.value,
      });
    }
  }

  if (nights.length === 0) {
    return {
      status: 'error',
      message: 'Every night in those months is already in the past.',
    };
  }
  if (nights.length > MAX_NIGHTS) {
    return {
      status: 'error',
      message: `That is ${nights.length.toLocaleString()} nights at once — please save fewer months.`,
    };
  }

  const dates = [...new Set(nights.map((night) => night.key))]
    .sort()
    .map((key) => parseDateOnly(key) as Date);
  const ratePlanIds = [...new Set(nights.map((night) => night.ratePlanId))];
  const { inventoryByKey, priceByKey, soldByKey } = await loadState(
    input.hotelSlug,
    roomTypeIds,
    ratePlanIds,
    dates,
  );

  const changes: CellChange[] = [];
  const writes: Array<NightRow & { value: MonthlyValue; after: CellState }> = [];
  let overrides = 0;

  for (const night of nights) {
    const inventory = inventoryByKey.get(`${night.roomTypeId}:${night.key}`);
    const price = priceByKey.get(`${night.ratePlanId}:${night.key}`);
    const overridden = inventory?.source === 'DAILY' || price?.source === 'DAILY';
    if (overridden) {
      overrides += 1;
      // Left exactly as it is: a daily override outranks the month unless
      // staff have said to replace it.
      if (input.overrides === 'keep') continue;
    }

    const before: CellState = {
      rate: price ? price.amount.toNumber() : null,
      roomsOnSale: inventory?.roomsOnSale ?? EMPTY_CELL.roomsOnSale,
      stopSell: inventory?.stopSell ?? EMPTY_CELL.stopSell,
      minStay: inventory?.minStay ?? EMPTY_CELL.minStay,
      closedToArrival: inventory?.closedToArrival ?? EMPTY_CELL.closedToArrival,
      closedToDeparture: inventory?.closedToDeparture ?? EMPTY_CELL.closedToDeparture,
    };
    const after = applyMonthly(before, night.value);

    changes.push({
      roomTypeId: night.roomTypeId,
      ratePlanId: night.ratePlanId,
      date: night.key,
      before,
      after,
    });
    writes.push({ ...night, after });
  }

  const conflicts = findOversellConflicts(
    changes,
    (roomTypeId, date) => soldByKey.get(`${roomTypeId}:${date}`) ?? 0,
    (roomTypeId) => rooms.get(roomTypeId)?.roomName ?? roomTypeId,
  );
  if (conflicts.length > 0) {
    return {
      status: 'error',
      message: `${conflicts.length} ${conflicts.length === 1 ? 'night is' : 'nights are'} already sold beyond that allotment. Nothing was changed.`,
      conflicts,
    };
  }

  const changing = changes.filter((change) => cellChanged(change.before, change.after)).length;
  const summary = [...new Set(cells.flatMap((cell) => describeMonthly(cell.value)))].slice(0, 4);

  if (!input.confirmed) {
    return {
      status: 'preview',
      preview: {
        // Nights this save will consider: a kept override is not one of them,
        // so "0 of 30 change" cannot silently include a night being skipped.
        nights: changes.length,
        changing,
        overrides,
        months: new Set(cells.map((cell) => cell.month)).size,
        rooms: roomTypeIds.length,
        summary,
      },
      submitted: { cells: input.cells, overrides: input.overrides },
    };
  }

  await prisma.$transaction(async (tx) => {
    for (const write of writes) {
      if (write.value.roomsOnSale !== undefined) {
        await tx.roomInventory.upsert({
          where: { roomTypeId_date: { roomTypeId: write.roomTypeId, date: write.date } },
          update: { roomsOnSale: write.after.roomsOnSale, source: 'MONTHLY' },
          create: {
            roomTypeId: write.roomTypeId,
            hotelSlug: input.hotelSlug,
            date: write.date,
            roomsOnSale: write.after.roomsOnSale,
            source: 'MONTHLY',
          },
        });
      }
      if (write.after.rate !== null && write.value.rate !== undefined) {
        await tx.ratePrice.upsert({
          where: { ratePlanId_date: { ratePlanId: write.ratePlanId, date: write.date } },
          update: { amount: write.after.rate, source: 'MONTHLY' },
          create: {
            ratePlanId: write.ratePlanId,
            hotelSlug: input.hotelSlug,
            date: write.date,
            amount: write.after.rate,
            source: 'MONTHLY',
          },
        });
      }
    }
  });

  const months = [...new Set(cells.map((cell) => cell.month))].sort();
  const describedMonths = months.map(monthLabel);

  await recordAudit({
    user: auth.user,
    action: 'rates.month_saved',
    entity: 'RoomInventory',
    hotelSlug: input.hotelSlug,
    summary: `${summary.join(' · ')} — ${changing} of ${changes.length} nights changed across ${months.length} ${months.length === 1 ? 'month' : 'months'} and ${roomTypeIds.length} ${roomTypeIds.length === 1 ? 'room' : 'rooms'}${overrides > 0 ? `, ${overrides} overridden ${overrides === 1 ? 'night' : 'nights'} ${input.overrides === 'keep' ? 'kept' : 'replaced'}` : ''}`,
    after: { months: describedMonths, rooms: roomTypeIds.length, changing, overrides },
    ip,
  });

  log.info('rates.month_saved', {
    hotel: input.hotelSlug,
    months: months.length,
    rooms: roomTypeIds.length,
    nights: changes.length,
    nights_changed: changing,
    overrides,
    overrides_mode: input.overrides,
  });

  revalidatePath('/admin/rates');
  revalidatePath('/admin/rates/monthly');

  return {
    status: 'success',
    message: `${changing} of ${changes.length} nights updated across ${months.length} ${months.length === 1 ? 'month' : 'months'}.`,
  };
}

export type DailyRateState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  conflict?: OversellConflict;
};

export async function saveDailyRate(
  _prev: DailyRateState,
  formData: FormData,
): Promise<DailyRateState> {
  const parsed = dailyRateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { status: 'error', message: first?.message ?? 'Please check the form.' };
  }

  const input = parsed.data;
  const auth = await authorizeHotel('rates:write', input.hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`rates:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  if (input.roomsOnSale === undefined && input.rate === undefined) {
    return { status: 'error', message: 'Set a price, an allotment, or both.' };
  }

  const date = parseDateOnly(input.date);
  if (!date) return { status: 'error', message: 'Pick a date.' };
  if (date < todayUtc()) {
    return { status: 'error', message: 'That night is in the past — nobody can book it.' };
  }

  const rooms = await roomsFor(input.hotelSlug, [input.roomTypeId]);
  const room = rooms.get(input.roomTypeId);
  if (!room) {
    return { status: 'error', message: 'That room does not belong to this property.' };
  }

  const { inventoryByKey, priceByKey, soldByKey } = await loadState(
    input.hotelSlug,
    [room.roomTypeId],
    [room.ratePlanId],
    [date],
  );

  const key = dateKey(date);
  const inventory = inventoryByKey.get(`${room.roomTypeId}:${key}`);
  const price = priceByKey.get(`${room.ratePlanId}:${key}`);

  const before: CellState = {
    rate: price ? price.amount.toNumber() : null,
    roomsOnSale: inventory?.roomsOnSale ?? EMPTY_CELL.roomsOnSale,
    stopSell: inventory?.stopSell ?? EMPTY_CELL.stopSell,
    minStay: inventory?.minStay ?? EMPTY_CELL.minStay,
    closedToArrival: inventory?.closedToArrival ?? EMPTY_CELL.closedToArrival,
    closedToDeparture: inventory?.closedToDeparture ?? EMPTY_CELL.closedToDeparture,
  };
  const after = applyMonthly(before, { roomsOnSale: input.roomsOnSale, rate: input.rate });

  const conflicts = findOversellConflicts(
    [{ roomTypeId: room.roomTypeId, ratePlanId: room.ratePlanId, date: key, before, after }],
    () => soldByKey.get(`${room.roomTypeId}:${key}`) ?? 0,
    () => room.roomName,
  );
  const conflict = conflicts[0];
  if (conflict) {
    return {
      status: 'error',
      message: `${conflict.sold} ${conflict.sold === 1 ? 'room is' : 'rooms are'} already sold that night. Nothing was changed.`,
      conflict,
    };
  }

  if (!cellChanged(before, after)) {
    return { status: 'success', message: 'That night already held those values.' };
  }

  await prisma.$transaction(async (tx) => {
    if (input.roomsOnSale !== undefined) {
      await tx.roomInventory.upsert({
        where: { roomTypeId_date: { roomTypeId: room.roomTypeId, date } },
        update: { roomsOnSale: after.roomsOnSale, source: 'DAILY' },
        create: {
          roomTypeId: room.roomTypeId,
          hotelSlug: input.hotelSlug,
          date,
          roomsOnSale: after.roomsOnSale,
          source: 'DAILY',
        },
      });
    }
    if (input.rate !== undefined) {
      await tx.ratePrice.upsert({
        where: { ratePlanId_date: { ratePlanId: room.ratePlanId, date } },
        update: { amount: input.rate, source: 'DAILY' },
        create: {
          ratePlanId: room.ratePlanId,
          hotelSlug: input.hotelSlug,
          date,
          amount: input.rate,
          source: 'DAILY',
        },
      });
    }
  });

  await recordAudit({
    user: auth.user,
    action: 'rates.day_overridden',
    entity: 'RoomInventory',
    hotelSlug: input.hotelSlug,
    summary: `${room.roomName}, ${key} — ${describeMonthly({ roomsOnSale: input.roomsOnSale, rate: input.rate }).join(' · ')}`,
    before,
    after,
    ip,
  });

  log.info('rates.day_overridden', {
    hotel: input.hotelSlug,
    room_type_id: room.roomTypeId,
    night: key,
  });

  revalidatePath('/admin/rates');
  revalidatePath('/admin/rates/daily');

  return {
    status: 'success',
    message: `${room.roomName} on ${key} overridden. It will survive the next monthly save.`,
  };
}
