'use server';

import { getHotelBySlug } from '@/content/hotels';
import { ADMIN_COOKIE_NAME, verifySessionCookieValue } from '@/lib/admin-auth';
import { addDays, dateKey, nightsBetween, parseDateOnly } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { rateGridSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';

export type RateFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

// One submission covers a season, so the range is bounded rather than
// unbounded: this writes a row per night and a typo in the end date would
// otherwise write years of them.
const MAX_RANGE_NIGHTS = 370;

export async function saveRates(
  _prevState: RateFormState,
  formData: FormData,
): Promise<RateFormState> {
  const authed = await verifySessionCookieValue((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
  if (!authed) {
    return { status: 'error', message: 'Session expired, please sign in again.' };
  }

  const ip = clientIp(await headers());
  if (isRateLimited(`rates:${ip}`)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const parsed = rateGridSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  const from = parseDateOnly(d.from);
  const to = parseDateOnly(d.to);

  if (!from || !to) return { status: 'error', message: 'Please choose valid dates.' };
  if (to < from) return { status: 'error', message: 'The end date is before the start date.' };
  if (nightsBetween(from, to) > MAX_RANGE_NIGHTS) {
    return {
      status: 'error',
      message: `Please load at most ${MAX_RANGE_NIGHTS} nights at a time.`,
    };
  }

  // Room types are content, not rows, so a rate can only be loaded against a
  // room the hotel's content file actually declares — otherwise it would sit
  // in the table priced and invisible, never matching anything on offer.
  const hotel = getHotelBySlug(d.hotelSlug);
  if (!hotel) return { status: 'error', message: 'Unknown property.' };
  if (!hotel.rooms.some((room) => room.name === d.roomName)) {
    return { status: 'error', message: `${hotel.name} has no room type called “${d.roomName}”.` };
  }

  // The range is inclusive of both dates: staff pick the first and last night
  // they are loading, not a checkout date.
  const dates = Array.from({ length: nightsBetween(from, to) + 1 }, (_, i) => addDays(from, i));

  // Replace rather than upsert row by row: every column is being set for the
  // whole range anyway, and one delete plus one insert is a single round trip
  // instead of 370.
  await prisma.$transaction([
    prisma.roomRate.deleteMany({
      where: { hotelSlug: d.hotelSlug, roomName: d.roomName, date: { gte: from, lte: to } },
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
  ]);

  log.info('rates.updated', {
    hotel: d.hotelSlug,
    room: d.roomName,
    // Not `from`/`to`: lib/log.ts redacts `to` as a mail recipient, which
    // would blank the date here.
    first_night: dateKey(from),
    last_night: dateKey(to),
    nights: dates.length,
    rate: d.rate,
    rooms: d.totalRooms,
    closed: d.closed,
  });

  revalidatePath('/admin/rates');

  return {
    status: 'success',
    message: `${dates.length} ${dates.length === 1 ? 'night' : 'nights'} updated for ${d.roomName}.`,
  };
}
