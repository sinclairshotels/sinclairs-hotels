// Fills an empty Set-up page from data/rate-card/*.csv.
//
//   pnpm load:rates            preview only
//   pnpm load:rates --write    apply
//
// A bootstrap, not an ongoing tool: it exists so a fresh database starts from a
// sheet somebody can correct instead of 468 empty boxes. Once rates are loaded,
// the Set-up page owns them, so by default this never overwrites a night that
// already has a value - see --overwrite.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hotels } from '../content/hotels';
import { dateKey, todayUtc } from '../lib/booking';
import { MONTHS_AHEAD, datesInMonth, monthsAhead } from '../lib/rate-plan';

const prisma = new PrismaClient();
const DIR = join(process.cwd(), 'data', 'rate-card');

const write = process.argv.includes('--write');
const overwrite = process.argv.includes('--overwrite');
const only = process.argv.find((arg) => arg.startsWith('--hotel='))?.slice('--hotel='.length);

// Rates are money, and this reads a sheet of drafts. Production has to be asked
// for by name rather than reached by forgetting which shell you are in.
const PRODUCTION_OK = process.argv.includes('--yes-production');

function rows(file: string): string[][] {
  const path = join(DIR, file);
  if (!existsSync(path)) throw new Error(`Missing ${path}`);
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  const [, ...body] = lines;
  return body.map((line) => line.split(','));
}

interface RoomRow {
  hotelSlug: string;
  roomName: string;
  baseRate: number;
  roomsOnSale: number | null;
  baseOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  extraAdultCharge: number;
  extraChildCharge: number;
}

function readRooms(): RoomRow[] {
  return rows('rooms.csv').map((cells) => {
    const [slug, name, rate, allotment, base, adults, children, extraAdult, extraChild] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const parsedAllotment = Number.parseInt(allotment, 10);
    return {
      hotelSlug: slug,
      roomName: name,
      baseRate: Number(rate),
      // "?" is the sheet saying nobody has decided yet, which is different from
      // zero. Priced but not on sale is the safe reading; a guessed allotment
      // oversells a real property.
      roomsOnSale: Number.isFinite(parsedAllotment) ? parsedAllotment : null,
      baseOccupancy: Number(base),
      maxAdults: Number(adults),
      maxChildren: Number(children),
      extraAdultCharge: Number(extraAdult),
      extraChildCharge: Number(extraChild),
    };
  });
}

function readSeasons(): Map<string, number> {
  const factors = new Map<string, number>();
  for (const cells of rows('seasons.csv')) {
    const [slug, month, factor] = cells as [string, string, string];
    factors.set(`${slug}:${Number(month)}`, Number(factor));
  }
  return factors;
}

function readBreakfast(): Map<string, number> {
  const supplements = new Map<string, number>();
  for (const cells of rows('hotels.csv')) {
    const [slug, amount] = cells as [string, string];
    supplements.set(slug, Number(amount));
  }
  return supplements;
}

function rateFor(baseRate: number, factor: number): number {
  return Math.round((baseRate * factor) / 50) * 50;
}

async function main() {
  if (process.env.VERCEL_ENV === 'production' && !PRODUCTION_OK) {
    throw new Error('Refusing to load draft rates into production without --yes-production.');
  }

  const rooms = readRooms();
  const factors = readSeasons();
  const breakfast = readBreakfast();
  const slugs = new Set(hotels.map((hotel) => hotel.slug));

  for (const room of rooms) {
    if (!slugs.has(room.hotelSlug)) {
      throw new Error(`rooms.csv names ${room.hotelSlug}, which is not a property in content.`);
    }
    if (!Number.isFinite(room.baseRate) || room.baseRate <= 0) {
      throw new Error(`${room.hotelSlug}/${room.roomName} has no usable baseRate.`);
    }
  }

  const today = todayUtc();
  const months = monthsAhead(today, MONTHS_AHEAD);

  let priced = 0;
  let onSale = 0;
  let keptExisting = 0;
  const unpriced: string[] = [];
  const noAllotment: string[] = [];

  for (const room of rooms) {
    if (only && room.hotelSlug !== only) continue;

    const roomType = await prisma.roomType.findUnique({
      where: { hotelSlug_contentKey: { hotelSlug: room.hotelSlug, contentKey: room.roomName } },
      include: { ratePlans: true },
    });
    if (!roomType) {
      unpriced.push(`${room.hotelSlug}/${room.roomName} - run pnpm sync:rooms first`);
      continue;
    }

    const ep = roomType.ratePlans.find((plan) => plan.code === 'EP');
    if (!ep) {
      unpriced.push(`${room.hotelSlug}/${room.roomName} - no Room Only plan`);
      continue;
    }

    if (room.roomsOnSale === null) noAllotment.push(`${room.hotelSlug}/${room.roomName}`);

    for (const month of months) {
      const factor = factors.get(`${room.hotelSlug}:${Number(month.slice(5))}`);
      if (factor === undefined) {
        throw new Error(`seasons.csv has no factor for ${room.hotelSlug} month ${month.slice(5)}.`);
      }
      const amount = rateFor(room.baseRate, factor);

      for (const date of datesInMonth(month, today)) {
        const existing = await prisma.ratePrice.findUnique({
          where: { ratePlanId_date: { ratePlanId: ep.id, date } },
        });
        if (existing && !overwrite) {
          keptExisting += 1;
          continue;
        }

        if (write) {
          await prisma.ratePrice.upsert({
            where: { ratePlanId_date: { ratePlanId: ep.id, date } },
            update: { amount, source: 'MONTHLY' },
            create: { ratePlanId: ep.id, hotelSlug: room.hotelSlug, date, amount },
          });
        }
        priced += 1;

        if (room.roomsOnSale !== null) {
          if (write) {
            await prisma.roomInventory.upsert({
              where: { roomTypeId_date: { roomTypeId: roomType.id, date } },
              update: { roomsOnSale: room.roomsOnSale, source: 'MONTHLY' },
              create: {
                roomTypeId: roomType.id,
                hotelSlug: room.hotelSlug,
                date,
                roomsOnSale: room.roomsOnSale,
              },
            });
          }
          onSale += 1;
        }
      }
    }

    // Occupancy and charges are only applied to a room type nobody has touched,
    // matching sync-room-types: a number somebody set on the Set-up page is a
    // decision, and a sheet of drafts does not get to overrule it.
    const untouched =
      roomType.baseOccupancy === 2 &&
      roomType.maxAdults === 3 &&
      roomType.maxChildren === 2 &&
      roomType.extraAdultCharge.toNumber() === 0 &&
      roomType.extraChildCharge.toNumber() === 0;

    if (untouched && write) {
      await prisma.roomType.update({
        where: { id: roomType.id },
        data: {
          baseOccupancy: room.baseOccupancy,
          maxAdults: room.maxAdults,
          maxChildren: room.maxChildren,
          extraAdultCharge: room.extraAdultCharge,
          extraChildCharge: room.extraChildCharge,
        },
      });
    }
  }

  for (const [slug, amount] of breakfast) {
    if (only && slug !== only) continue;
    const settings = await prisma.hotelSettings.findUnique({ where: { hotelSlug: slug } });
    if (settings && settings.breakfastSupplement.toNumber() !== 0 && !overwrite) continue;
    if (write) {
      await prisma.hotelSettings.upsert({
        where: { hotelSlug: slug },
        update: { breakfastSupplement: amount },
        create: { hotelSlug: slug, breakfastSupplement: amount },
      });
    }
  }

  const window = `${months[0]} to ${months[months.length - 1]}`;
  console.log(write ? `Loaded ${window}` : `Preview of ${window} - nothing written`);
  console.log(`  nights priced:        ${priced}`);
  console.log(`  nights put on sale:   ${onSale}`);
  console.log(`  already loaded, kept: ${keptExisting}${overwrite ? ' (overwrite on)' : ''}`);

  if (noAllotment.length > 0) {
    console.log(`\n  ${noAllotment.length} room types have no allotment in rooms.csv.`);
    console.log('  They are priced and not sellable. Set roomsOnSale and re-run:');
    for (const room of noAllotment) console.log(`    ${room}`);
  }
  if (unpriced.length > 0) {
    console.log(`\n  ${unpriced.length} rows could not be matched:`);
    for (const row of unpriced) console.log(`    ${row}`);
  }
  if (!write) console.log('\nRe-run with --write to apply.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
