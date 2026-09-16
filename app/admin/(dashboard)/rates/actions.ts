'use server';

import { getHotelBySlug } from '@/content/hotels';
import { ADMIN_COOKIE_NAME, verifySessionCookieValue } from '@/lib/admin-auth';
import { addDays, dateKey, nightsBetween, parseDateOnly } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { type RateGridInput, rateGridSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';

// What a submission would do, shown to staff before anything is written.
export type RatePreview = {
  nights: number;
  existing: number;
  changing: number;
  firstNight: string;
  lastNight: string;
  hotelSlug: string;
  hotelName: string;
  roomName: string;
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

// There are no per-user staff logins yet (PLAN.md → Phase 2), so this is the
// most honest actor the audit log can record.
const SHARED_ADMIN_ACTOR = 'admin (shared login)';

type ParsedRates = {
  data: RateGridInput;
  from: Date;
  to: Date;
  dates: Date[];
  hotelName: string;
};

function parseSubmission(
  formData: FormData,
): { ok: true; parsed: ParsedRates } | { ok: false; state: RateFormState } {
  // getAll, not Object.fromEntries: the weekday checkboxes share one name and
  // fromEntries would keep only the last one ticked.
  const raw = {
    ...Object.fromEntries(formData.entries()),
    weekdays: formData.getAll('weekdays'),
  };

  const parsed = rateGridSchema.safeParse(raw);
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

  // Room types are content, not rows, so a rate can only be loaded against a
  // room the hotel's content file actually declares — otherwise it would sit
  // in the table priced and invisible, never matching anything on offer.
  const hotel = getHotelBySlug(d.hotelSlug);
  if (!hotel) return { ok: false, state: { status: 'error', message: 'Unknown property.' } };
  if (!hotel.rooms.some((room) => room.name === d.roomName)) {
    return {
      ok: false,
      state: {
        status: 'error',
        message: `${hotel.name} has no room type called “${d.roomName}”.`,
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
      state: {
        status: 'error',
        message: 'No nights in that range fall on the days you picked.',
      },
    };
  }

  return { ok: true, parsed: { data: d, from, to, dates, hotelName: hotel.name } };
}

export async function saveRates(
  _prevState: RateFormState,
  formData: FormData,
): Promise<RateFormState> {
  const authed = await verifySessionCookieValue((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
  if (!authed) {
    return { status: 'error', message: 'Session expired, please sign in again.' };
  }

  const ip = clientIp(await headers());
  if (isRateLimited(`rates:${ip}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const result = parseSubmission(formData);
  if (!result.ok) return result.state;

  const { data: d, from, to, dates, hotelName } = result.parsed;

  const existing = await prisma.roomRate.findMany({
    where: {
      hotelSlug: d.hotelSlug,
      roomName: d.roomName,
      date: { in: dates },
    },
  });

  // "Changing" is narrower than "overwriting": re-saving a night at the values
  // it already holds overwrites it but changes nothing, and staff care about
  // the difference when they are about to replace a season.
  const changed = existing.filter(
    (row) =>
      row.rate.toNumber() !== d.rate || row.totalRooms !== d.totalRooms || row.closed !== d.closed,
  );

  if (!d.confirmed) {
    return {
      status: 'preview',
      preview: {
        nights: dates.length,
        existing: existing.length,
        changing: changed.length,
        firstNight: dateKey(from),
        lastNight: dateKey(to),
        hotelSlug: d.hotelSlug,
        hotelName,
        roomName: d.roomName,
        rate: d.rate,
        totalRooms: d.totalRooms,
        closed: d.closed,
        weekdays: d.weekdays,
      },
    };
  }

  // Replace rather than upsert row by row: every column is being set for the
  // whole selection anyway, and one delete plus one insert is a single round
  // trip instead of one per night.
  await prisma.$transaction([
    prisma.roomRate.deleteMany({
      where: { hotelSlug: d.hotelSlug, roomName: d.roomName, date: { in: dates } },
    }),
    prisma.roomRate.createMany({
      data: dates.map((date) => ({
        hotelSlug: d.hotelSlug,
        roomName: d.roomName,
        date,
        rate: d.rate,
        totalRooms: d.totalRooms,
        closed: d.closed,
      })),
    }),
    prisma.rateChange.create({
      data: {
        hotelSlug: d.hotelSlug,
        roomName: d.roomName,
        firstNight: from,
        lastNight: to,
        weekdays: d.weekdays,
        nightsWritten: dates.length,
        nightsChanged: changed.length,
        rate: d.rate,
        totalRooms: d.totalRooms,
        closed: d.closed,
        previous: changed.map((row) => ({
          date: dateKey(row.date),
          rate: row.rate.toNumber(),
          totalRooms: row.totalRooms,
          closed: row.closed,
        })),
        actor: SHARED_ADMIN_ACTOR,
        actorIp: ip,
      },
    }),
  ]);

  log.info('rates.updated', {
    hotel: d.hotelSlug,
    room: d.roomName,
    // Not `from`/`to`: lib/log.ts redacts `to` as a mail recipient, which
    // would blank the date here.
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
    message: `${dates.length} ${dates.length === 1 ? 'night' : 'nights'} updated for ${d.roomName} — ${changed.length} changed.`,
  };
}
