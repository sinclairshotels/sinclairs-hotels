// Fills a non-production database with a plausible back office: rates and
// allotment for every property, and bookings across every status.
//
//   pnpm seed:demo
//
// For looking at the admin with something in it — screenshots, a walkthrough,
// trying the calendar against realistic shapes. It refuses to run against
// production, and it only ever touches its own demo rows plus the inventory
// window it fills.

import { type BookingStatus, PrismaClient } from '@prisma/client';
import { hotels } from '../content/hotels';

const prisma = new PrismaClient();

const DEMO_EMAIL_DOMAIN = 'demo-guest.invalid';
const DAYS = 90;

const GUESTS = [
  'Ananya Sengupta',
  'Rohan Mehta',
  'Priya Raghavan',
  'Imran Qureshi',
  'Lucy Whitfield',
  'Sourav Banerjee',
  'Meera Nair',
  'Arjun Kapoor',
  'Fatima Sheikh',
  'David Osei',
  'Kavya Iyer',
  'Tenzing Bhutia',
  'Nikhil Rao',
  'Sarah Lindqvist',
  'Vikram Chauhan',
  'Ritu Malhotra',
  'Joseph Mathew',
  'Anita Desai',
  'Karan Gill',
  'Elena Rossi',
];

// Weekday, weekend and holiday multipliers against a room's base rate.
const WEEKEND_UPLIFT = 1.25;
const HOLIDAY_UPLIFT = 1.4;

function day(offset: number): Date {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return new Date(today.getTime() + offset * 86_400_000);
}

// Deterministic, so re-running the seed produces the same database rather than
// a different one — a screenshot taken twice should look the same.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

async function main() {
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data into production.');
  }

  const holidayDates = new Set(
    (await prisma.holiday.findMany({ select: { date: true } })).map((row) =>
      row.date.toISOString().slice(0, 10),
    ),
  );

  console.log('clearing previous demo data…');
  await prisma.booking.deleteMany({ where: { guestEmail: { endsWith: DEMO_EMAIL_DOMAIN } } });

  let inventoryRows = 0;
  let priceRows = 0;
  let bookingRows = 0;
  let seed = 1;

  for (const hotel of hotels) {
    const roomTypes = await prisma.roomType.findMany({
      where: { hotelSlug: hotel.slug, active: true },
      include: { ratePlans: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Three or four room types per property is what the brief asks to see;
    // beyond that the grid stops fitting on a screen anyway.
    const selected = roomTypes.slice(0, 4);

    for (const [index, roomType] of selected.entries()) {
      const epPlan = roomType.ratePlans.find((plan) => plan.code === 'EP');
      const cpPlan = roomType.ratePlans.find((plan) => plan.code === 'CP');
      if (!epPlan) continue;

      // Bigger rooms cost more; each property sits at a slightly different
      // level so the numbers do not all look copied.
      const base = 4200 + index * 1800 + (hotel.slug.charCodeAt(0) % 7) * 150;
      const allotment = 5 - Math.min(index, 3);

      await prisma.ratePlan.update({ where: { id: epPlan.id }, data: { active: true } });
      if (cpPlan)
        await prisma.ratePlan.update({ where: { id: cpPlan.id }, data: { active: true } });

      const inventory = [];
      const prices = [];

      for (let offset = 0; offset < DAYS; offset++) {
        const date = day(offset);
        const iso = date.toISOString().slice(0, 10);
        const weekday = date.getUTCDay();
        const isWeekend = weekday === 0 || weekday === 6;
        const isHoliday = holidayDates.has(iso);

        const multiplier = isHoliday ? HOLIDAY_UPLIFT : isWeekend ? WEEKEND_UPLIFT : 1;
        const rate = Math.round((base * multiplier) / 50) * 50;

        // A scattering of real-world shapes: the odd stop sell, a minimum stay
        // over peak weekends, and a few nights nobody has loaded yet near the
        // end of the window.
        const roll = pseudoRandom(seed++);
        const unloaded = offset > DAYS - 12 && roll < 0.35;
        if (unloaded) continue;

        inventory.push({
          roomTypeId: roomType.id,
          hotelSlug: hotel.slug,
          date,
          roomsOnSale: allotment,
          stopSell: roll > 0.97,
          minStay: isHoliday ? 2 : null,
          closedToArrival: roll > 0.985,
          closedToDeparture: false,
        });

        prices.push({ ratePlanId: epPlan.id, hotelSlug: hotel.slug, date, amount: rate });
        if (cpPlan) {
          prices.push({
            ratePlanId: cpPlan.id,
            hotelSlug: hotel.slug,
            date,
            amount: rate + 900,
          });
        }
      }

      await prisma.roomInventory.deleteMany({
        where: { roomTypeId: roomType.id, date: { gte: day(0), lt: day(DAYS) } },
      });
      await prisma.ratePrice.deleteMany({
        where: {
          ratePlanId: { in: [epPlan.id, ...(cpPlan ? [cpPlan.id] : [])] },
          date: { gte: day(0), lt: day(DAYS) },
        },
      });
      await prisma.roomInventory.createMany({ data: inventory });
      await prisma.ratePrice.createMany({ data: prices });

      inventoryRows += inventory.length;
      priceRows += prices.length;
    }

    // Bookings, spread across every status so each one is visible somewhere.
    const statuses: BookingStatus[] = [
      'CONFIRMED',
      'CONFIRMED',
      'CONFIRMED',
      'PENDING_PAYMENT',
      'PAYMENT_FAILED',
      'CANCELLED',
      'REFUND_DUE',
    ];

    for (let i = 0; i < 4; i++) {
      const roomType = selected[i % selected.length];
      const epPlan = roomType?.ratePlans.find((plan) => plan.code === 'EP');
      if (!roomType || !epPlan) continue;

      const roll = pseudoRandom(seed++);
      const arrival = Math.floor(roll * (DAYS - 20)) + 2;
      const nights = 1 + Math.floor(pseudoRandom(seed++) * 4);
      const rooms = 1 + Math.floor(pseudoRandom(seed++) * 2);
      const status = statuses[(seed + i) % statuses.length] as BookingStatus;
      const guest = GUESTS[(seed + i) % GUESTS.length] as string;

      const price = await prisma.ratePrice.findFirst({
        where: { ratePlanId: epPlan.id, date: day(arrival) },
      });
      const nightly = price?.amount.toNumber() ?? 5000;
      const roomTotal = nightly * nights * rooms;
      const taxTotal = Math.round(roomTotal * 0.18 * 100) / 100;

      await prisma.booking.create({
        data: {
          reference: `SNC-DEMO-${hotel.slug.slice(0, 3).toUpperCase()}${i}${Math.floor(roll * 900 + 100)}`,
          viewToken: `demo-${hotel.slug}-${i}-${Math.floor(roll * 1e6)}`,
          hotelSlug: hotel.slug,
          roomTypeId: roomType.id,
          ratePlanId: epPlan.id,
          roomName: roomType.name,
          checkIn: day(arrival),
          checkOut: day(arrival + nights),
          rooms,
          adults: 2,
          children: roll > 0.7 ? 1 : 0,
          guestName: guest,
          guestEmail: `${guest.split(' ')[0]?.toLowerCase()}@${DEMO_EMAIL_DOMAIN}`,
          guestPhone: '+91 98300 00000',
          billingAddress: 'Demo address, Kolkata',
          roomTotal,
          taxTotal,
          total: roomTotal + taxTotal,
          status,
          createdAt: new Date(Date.now() - Math.floor(roll * 14) * 86_400_000),
        },
      });
      bookingRows++;
    }
  }

  console.log(`inventory nights: ${inventoryRows}`);
  console.log(`prices:           ${priceRows}`);
  console.log(`bookings:         ${bookingRows}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
