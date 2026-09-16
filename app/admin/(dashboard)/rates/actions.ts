'use server';

import { recordAudit } from '@/lib/audit';
import { authorizeHotel } from '@/lib/auth';
import { addDays, dateKey, nightsBetween, parseDateOnly } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { type RateGridInput, rateGridSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type RatePreview = {
  nights: number;
  existing: number;
  changing: number;
  firstNight: string;
  lastNight: string;
  hotelSlug: string;
  hotelName: string;
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  ratePlanName: string;
  rate: number;
  totalRooms: number;
  closed: boolean;
  weekdays: number[];
};

export type RateFormState = {
  status: 'idle' | 'success' | 'error' | 'preview';
  message?: string;
  fieldErrors?: Record<string, string[]>;
  preview?: RatePreview;
};

// One submission covers a season, so the range is bounded rather than
// unbounded: this writes a row per night and a typo in the end date would
// otherwise write years of them.
const MAX_RANGE_NIGHTS = 370;

type Parsed = {
  data: RateGridInput;
  from: Date;
  to: Date;
  dates: Date[];
};

function parseSubmission(
  formData: FormData,
): { ok: true; parsed: Parsed } | { ok: false; state: RateFormState } {
  // getAll, not Object.fromEntries: the weekday checkboxes share one name and
  // fromEntries would keep only the last one ticked.
  const parsed = rateGridSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    weekdays: formData.getAll('weekdays'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      state: {
        status: 'error',
        message: 'Please check the highlighted fields.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }

  const d = parsed.data;
  const from = parseDateOnly(d.from);
  const to = parseDateOnly(d.to);

  if (!from || !to) {
    return { ok: false, state: { status: 'error', message: 'Please choose valid dates.' } };
  }
  if (to < from) {
    return {
      ok: false,
      state: { status: 'error', message: 'The end date is before the start date.' },
    };
  }
  if (nightsBetween(from, to) > MAX_RANGE_NIGHTS) {
    return {
      ok: false,
      state: {
        status: 'error',
        message: `Please load at most ${MAX_RANGE_NIGHTS} nights at a time.`,
      },
    };
  }

  // The range is inclusive of both dates: staff pick the first and last night
  // they are loading, not a checkout date. Weekday filtering then narrows it —
  // an empty selection means every night, not none.
  const dates = Array.from({ length: nightsBetween(from, to) + 1 }, (_, i) =>
    addDays(from, i),
  ).filter((date) => d.weekdays.length === 0 || d.weekdays.includes(date.getUTCDay()));

  if (dates.length === 0) {
    return {
      ok: false,
      state: { status: 'error', message: 'No nights in that range fall on the days you picked.' },
    };
  }

  return { ok: true, parsed: { data: d, from, to, dates } };
}

export async function saveRates(
  _prevState: RateFormState,
  formData: FormData,
): Promise<RateFormState> {
  const result = parseSubmission(formData);
  if (!result.ok) return result.state;

  const { data: d, from, to, dates } = result.parsed;

  const auth = await authorizeHotel('rates:write', d.hotelSlug);
  if (!auth.ok) return { status: 'error', message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`rates:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  // The room type and plan must belong to the hotel being edited — otherwise a
  // tampered form could price another property's rooms.
  const ratePlan = await prisma.ratePlan.findFirst({
    where: { id: d.ratePlanId, roomTypeId: d.roomTypeId, hotelSlug: d.hotelSlug },
    include: { roomType: true },
  });

  if (!ratePlan) {
    return {
      status: 'error',
      message: 'That room type and rate plan do not belong to this property.',
    };
  }

  const [existingInventory, existingPrices] = await Promise.all([
    prisma.roomInventory.findMany({ where: { roomTypeId: d.roomTypeId, date: { in: dates } } }),
    prisma.ratePrice.findMany({ where: { ratePlanId: d.ratePlanId, date: { in: dates } } }),
  ]);

  const priceByDate = new Map(existingPrices.map((row) => [dateKey(row.date), row]));

  // "Changing" is narrower than "overwriting": re-saving a night at the values
  // it already holds overwrites it but changes nothing, and staff care about
  // the difference when they are about to replace a season.
  const changed = existingInventory.filter((row) => {
    const price = priceByDate.get(dateKey(row.date));
    return (
      row.roomsOnSale !== d.totalRooms ||
      row.stopSell !== d.closed ||
      price === undefined ||
      price.amount.toNumber() !== d.rate
    );
  });

  const alreadyLoaded = existingInventory.filter((row) => priceByDate.has(dateKey(row.date)));

  if (!d.confirmed) {
    return {
      status: 'preview',
      preview: {
        nights: dates.length,
        existing: alreadyLoaded.length,
        changing: changed.length,
        firstNight: dateKey(from),
        lastNight: dateKey(to),
        hotelSlug: d.hotelSlug,
        hotelName: d.hotelSlug,
        roomTypeId: d.roomTypeId,
        roomTypeName: ratePlan.roomType.name,
        ratePlanId: d.ratePlanId,
        ratePlanName: ratePlan.name,
        rate: d.rate,
        totalRooms: d.totalRooms,
        closed: d.closed,
        weekdays: d.weekdays,
      },
    };
  }

  const before = changed.map((row) => {
    const price = priceByDate.get(dateKey(row.date));
    return {
      date: dateKey(row.date),
      rate: price ? price.amount.toNumber() : null,
      roomsOnSale: row.roomsOnSale,
      stopSell: row.stopSell,
    };
  });

  // Replace rather than upsert row by row: every column is being set for the
  // whole selection anyway, and one delete plus one insert is a single round
  // trip instead of one per night. Inventory and price are written together so
  // a night can never end up priced but not on sale, or the reverse.
  await prisma.$transaction([
    prisma.roomInventory.deleteMany({ where: { roomTypeId: d.roomTypeId, date: { in: dates } } }),
    prisma.roomInventory.createMany({
      data: dates.map((date) => ({
        roomTypeId: d.roomTypeId,
        hotelSlug: d.hotelSlug,
        date,
        roomsOnSale: d.totalRooms,
        stopSell: d.closed,
      })),
    }),
    prisma.ratePrice.deleteMany({ where: { ratePlanId: d.ratePlanId, date: { in: dates } } }),
    prisma.ratePrice.createMany({
      data: dates.map((date) => ({
        ratePlanId: d.ratePlanId,
        hotelSlug: d.hotelSlug,
        date,
        amount: d.rate,
      })),
    }),
  ]);

  await recordAudit({
    user: auth.user,
    action: 'rates.updated',
    entity: 'RoomInventory',
    entityId: d.roomTypeId,
    hotelSlug: d.hotelSlug,
    summary: `${ratePlan.roomType.name} (${ratePlan.name}): ${dates.length} nights written, ${changed.length} changed`,
    before,
    after: {
      rate: d.rate,
      roomsOnSale: d.totalRooms,
      stopSell: d.closed,
      firstNight: dateKey(from),
      lastNight: dateKey(to),
      weekdays: d.weekdays,
    },
    ip,
  });

  log.info('rates.updated', {
    hotel: d.hotelSlug,
    room_type_id: d.roomTypeId,
    rate_plan: ratePlan.code,
    first_night: dateKey(from),
    last_night: dateKey(to),
    weekdays: d.weekdays.length > 0 ? d.weekdays.join(',') : 'all',
    nights: dates.length,
    nights_changed: changed.length,
    rate: d.rate,
    rooms: d.totalRooms,
    closed: d.closed,
  });

  revalidatePath('/admin/rates');

  return {
    status: 'success',
    message: `${dates.length} ${dates.length === 1 ? 'night' : 'nights'} updated for ${ratePlan.roomType.name} — ${changed.length} changed.`,
  };
}
