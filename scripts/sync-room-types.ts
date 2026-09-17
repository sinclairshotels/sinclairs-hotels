// Reconciles the RoomType / RatePlan / HotelSettings rows with the content
// files, and seeds the holiday list.
//
// Room types are split across two homes deliberately: the marketing half
// (description, photography, the copy on the hotel page) stays in
// content/hotels/*.ts, and the operational half (occupancy, extra-guest
// charges, what is on sale) lives in Postgres so staff can change it without a
// deploy. `contentKey` joins the two. This script is what keeps them in step —
// the A0 migration could only create room types that already had a rate or a
// booking, because SQL cannot read the content files.
//
//   pnpm sync:rooms
//
// Idempotent, and deliberately non-destructive: it creates what is missing and
// refreshes the ordering, but never overwrites a name, occupancy or charge that
// staff have since edited, and never deletes a room type that has left the
// content files — that would silently drop its rates and orphan its bookings.
// Those are reported instead.

import { PrismaClient, type RatePlanCode } from '@prisma/client';
import { INDIAN_PUBLIC_HOLIDAYS } from '../content/holidays';
import { hotels } from '../content/hotels';

const prisma = new PrismaClient();

// Two plans, not four. With Breakfast has no calendar of its own — it is Room
// Only plus the hotel's breakfast supplement — so the second row exists to be
// named and sold, not priced.
const RATE_PLANS: Array<{ code: RatePlanCode; name: string; sortOrder: number }> = [
  { code: 'EP', name: 'Room Only', sortOrder: 0 },
  { code: 'CP', name: 'With Breakfast', sortOrder: 1 },
];

async function main() {
  let createdRooms = 0;
  let createdPlans = 0;
  const orphaned: string[] = [];

  for (const hotel of hotels) {
    await prisma.hotelSettings.upsert({
      where: { hotelSlug: hotel.slug },
      update: {},
      create: { hotelSlug: hotel.slug },
    });

    for (const [index, room] of hotel.rooms.entries()) {
      const existing = await prisma.roomType.findUnique({
        where: { hotelSlug_contentKey: { hotelSlug: hotel.slug, contentKey: room.name } },
      });

      const roomType = existing
        ? // Only the ordering follows content; everything else is staff's.
          await prisma.roomType.update({
            where: { id: existing.id },
            data: { sortOrder: index },
          })
        : await prisma.roomType.create({
            data: {
              hotelSlug: hotel.slug,
              contentKey: room.name,
              name: room.name,
              sortOrder: index,
            },
          });

      if (!existing) createdRooms++;

      // Both plans, both active: Room Only carries the calendar and With
      // Breakfast is derived from it, so neither needs turning on.
      for (const plan of RATE_PLANS) {
        const existingPlan = await prisma.ratePlan.findUnique({
          where: { roomTypeId_code: { roomTypeId: roomType.id, code: plan.code } },
        });
        if (existingPlan) {
          if (!existingPlan.active) {
            await prisma.ratePlan.update({
              where: { id: existingPlan.id },
              data: { active: true },
            });
          }
          continue;
        }

        await prisma.ratePlan.create({
          data: {
            hotelSlug: hotel.slug,
            roomTypeId: roomType.id,
            code: plan.code,
            name: plan.name,
            sortOrder: plan.sortOrder,
          },
        });
        createdPlans++;
      }

      // Meal plans this site no longer sells. Deactivated rather than deleted:
      // deleting would take any historical booking's rate plan with it.
      await prisma.ratePlan.updateMany({
        where: { roomTypeId: roomType.id, code: { in: ['MAP', 'AP'] }, active: true },
        data: { active: false },
      });
    }

    // Room types still in the database that content no longer declares. Not
    // deleted: they may hold rates and bookings, and dropping them silently is
    // how history disappears.
    const dbRooms = await prisma.roomType.findMany({ where: { hotelSlug: hotel.slug } });
    for (const dbRoom of dbRooms) {
      if (!hotel.rooms.some((room) => room.name === dbRoom.contentKey)) {
        orphaned.push(`${hotel.slug} / ${dbRoom.contentKey}`);
      }
    }
  }

  for (const holiday of INDIAN_PUBLIC_HOLIDAYS) {
    const date = new Date(`${holiday.date}T00:00:00.000Z`);
    // Not upsert: Prisma cannot match a null inside a compound unique key, and
    // hotelSlug is null for a national holiday.
    const existing = await prisma.holiday.findFirst({ where: { date, hotelSlug: null } });
    if (existing) {
      await prisma.holiday.update({ where: { id: existing.id }, data: { name: holiday.name } });
    } else {
      await prisma.holiday.create({ data: { date, name: holiday.name } });
    }
  }

  console.log(`room types created: ${createdRooms}`);
  console.log(`rate plans created: ${createdPlans}`);
  console.log(`holidays seeded:    ${INDIAN_PUBLIC_HOLIDAYS.length} (fixed-date only —`);
  console.log('                    movable festivals are added by staff, see content/holidays.ts)');
  if (orphaned.length > 0) {
    console.log('\nroom types in the database that content no longer declares:');
    for (const name of orphaned) console.log(`  - ${name}`);
    console.log(
      'These keep their rates and bookings. Retire them in Setup if they are gone for good.',
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
