import { addDays, todayInIndia } from '@/lib/booking';
import { prisma } from '@/lib/db';

// The "from ₹X per night" figure on /book. It is the cheapest Room Only night
// a property has loaded in the window — an indication of what a stay starts
// at, not a quote: the real price comes from lib/availability.ts once a guest
// names their dates.
export const FROM_PRICE_DAYS = 30;

export async function fromPricePerHotel(
  days: number = FROM_PRICE_DAYS,
): Promise<Map<string, number>> {
  const from = todayInIndia();

  const rows = await prisma.ratePrice.groupBy({
    by: ['hotelSlug'],
    where: {
      date: { gte: from, lt: addDays(from, days) },
      // Room Only is the floor by definition — every other plan adds meals to
      // the same room, so quoting from any of them would overstate the entry
      // price.
      ratePlan: { code: 'EP', active: true, roomType: { active: true } },
    },
    _min: { amount: true },
  });

  return new Map(
    rows.flatMap((row) => (row._min.amount ? [[row.hotelSlug, row._min.amount.toNumber()]] : [])),
  );
}
