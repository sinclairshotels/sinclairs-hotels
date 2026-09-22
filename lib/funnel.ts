import { prisma } from '@/lib/db';
import type { AuthedUser } from '@/lib/roles';
import { hotelScopeFilter } from '@/lib/roles';

// The six steps, in the order a guest walks them. The first three are browser
// events mirrored into FunnelEvent; the last three are rows that only exist
// because money was on its way, which is why they are counted from Booking and
// Payment rather than from anything the browser said.
export const FUNNEL_STEPS = [
  'home_view',
  'search',
  'room_view',
  'guest_details',
  'payment_started',
  'confirmed',
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

// Only these three are ever written by the browser. The rest are derived, and
// accepting them over HTTP would let anyone inflate the conversion rate.
export const CLIENT_STEPS: FunnelStep[] = ['home_view', 'search', 'room_view'];

export const FUNNEL_LABELS: Record<FunnelStep, string> = {
  home_view: 'Home views',
  search: 'Searches',
  room_view: 'Room views',
  guest_details: 'Guest details',
  payment_started: 'Payment started',
  confirmed: 'Confirmed',
};

export interface FunnelRow {
  step: FunnelStep;
  label: string;
  count: number;
  // Share of the step above that did not reach this one. Null on the first
  // step, which has nothing above it, and wherever the step above is zero —
  // "100% drop-off" from nothing is a number that reads as a problem.
  dropOff: number | null;
  fromBrowser: boolean;
}

export interface Funnel {
  hotelSlug: string | null;
  hotelName: string;
  rows: FunnelRow[];
}

function since(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function funnelCounts(
  viewer: Pick<AuthedUser, 'restrictedToHotels'>,
  days: number,
  now: Date = new Date(),
): Promise<Map<string | null, Record<FunnelStep, number>>> {
  const from = since(days, now);
  const scope = hotelScopeFilter(viewer);
  const allowed = viewer.restrictedToHotels;
  const withinScope = (slug: string | null) =>
    !allowed || (slug !== null && allowed.includes(slug));

  const [events, guestDetails, paymentStarted, confirmed] = await Promise.all([
    prisma.funnelEvent.groupBy({
      by: ['step', 'hotelSlug'],
      where: { at: { gte: from } },
      _count: true,
    }),
    prisma.booking.groupBy({
      by: ['hotelSlug'],
      where: { ...scope, createdAt: { gte: from } },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ['hotelSlug'],
      where: { createdAt: { gte: from } },
      _count: true,
    }),
    prisma.booking.groupBy({
      by: ['hotelSlug'],
      where: { ...scope, status: 'CONFIRMED', createdAt: { gte: from } },
      _count: true,
    }),
  ]);

  const blank = (): Record<FunnelStep, number> =>
    Object.fromEntries(FUNNEL_STEPS.map((step) => [step, 0])) as Record<FunnelStep, number>;

  const byHotel = new Map<string | null, Record<FunnelStep, number>>();
  const bump = (slug: string | null, step: FunnelStep, by: number) => {
    if (!withinScope(slug)) return;
    for (const key of [slug, null] as Array<string | null>) {
      const row = byHotel.get(key) ?? blank();
      row[step] += by;
      byHotel.set(key, row);
    }
  };

  for (const row of events) {
    if (!(FUNNEL_STEPS as readonly string[]).includes(row.step)) continue;
    bump(row.hotelSlug, row.step as FunnelStep, row._count);
  }
  for (const row of guestDetails) bump(row.hotelSlug, 'guest_details', row._count);
  for (const row of paymentStarted) bump(row.hotelSlug, 'payment_started', row._count);
  for (const row of confirmed) bump(row.hotelSlug, 'confirmed', row._count);

  return byHotel;
}

export function toRows(counts: Record<FunnelStep, number>): FunnelRow[] {
  return FUNNEL_STEPS.map((step, i) => {
    const previous = i === 0 ? null : counts[FUNNEL_STEPS[i - 1] as FunnelStep];
    const count = counts[step];
    return {
      step,
      label: FUNNEL_LABELS[step],
      count,
      dropOff:
        previous === null || previous === 0
          ? null
          : Math.round(((previous - count) / previous) * 100),
      fromBrowser: CLIENT_STEPS.includes(step),
    };
  });
}
