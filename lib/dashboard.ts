import { heldBookingFilter } from '@/lib/availability';
import { addDays, todayInIndia } from '@/lib/booking';
import { prisma } from '@/lib/db';
import type { AuthedUser } from '@/lib/roles';
import { hotelScopeFilter } from '@/lib/roles';
import type { Booking, Prisma } from '@prisma/client';

export interface DashboardToday {
  arrivals: Booking[];
  departures: Booking[];
  inHouse: number;
  takenToday: number;
  revenueToday: number;
  refundsDue: Booking[];
  awaitingPayment: number;
  nextSeven: number;
  // New enquiries nobody has touched for a day. Same threshold the enquiries
  // list colours red, shared so the two cannot disagree.
  staleEnquiries: number;
}

export const ENQUIRY_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// Everything the dashboard shows, read in one place so the tiles and the lists
// below them can never disagree about what "today" contains.
//
// A booking counts as arriving today when its check-in is today; in house when
// today falls inside the stay but is not the checkout day, which is never a
// night the guest paid for. Cancelled and failed bookings are nobody's arrival.
export async function dashboardToday(
  viewer: Pick<AuthedUser, 'role' | 'allProperties' | 'hotels'>,
  now: Date = new Date(),
): Promise<DashboardToday> {
  const today = todayInIndia(now);
  const tomorrow = addDays(today, 1);
  const scope = hotelScopeFilter(viewer);
  const live: Prisma.BookingWhereInput = { ...scope, status: { in: ['CONFIRMED'] } };

  const [
    arrivals,
    departures,
    inHouse,
    takenToday,
    revenue,
    refundsDue,
    awaitingPayment,
    nextSeven,
    staleEnquiries,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: { ...live, checkIn: today },
      orderBy: { guestName: 'asc' },
    }),
    prisma.booking.findMany({
      where: { ...live, checkOut: today },
      orderBy: { guestName: 'asc' },
    }),
    prisma.booking.count({
      where: { ...live, checkIn: { lte: today }, checkOut: { gt: today } },
    }),
    // createdAt is a timestamp, not a date-only column, so "taken today" is
    // the window from this UTC midnight to the next.
    prisma.booking.count({
      where: { ...scope, createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.booking.aggregate({
      _sum: { total: true },
      where: {
        ...scope,
        status: 'CONFIRMED',
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    // Money owed to someone: the one row on this page that is a task.
    prisma.booking.findMany({
      where: { ...scope, status: 'REFUND_DUE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.booking.count({
      where: { ...scope, ...heldBookingFilter(now), status: 'PENDING_PAYMENT' },
    }),
    prisma.booking.count({
      where: { ...live, checkIn: { gte: tomorrow, lt: addDays(today, 8) } },
    }),
    // Enquiries carry `property`, not `hotelSlug`, so hotelScopeFilter does not
    // apply to them directly — the same restriction is spelled out here.
    prisma.enquiry.count({
      where: {
        status: 'NEW',
        createdAt: { lt: new Date(now.getTime() - ENQUIRY_STALE_AFTER_MS) },
        ...(viewer.role === 'ADMIN' || viewer.allProperties
          ? {}
          : { property: { in: viewer.hotels } }),
      },
    }),
  ]);

  return {
    arrivals,
    departures,
    inHouse,
    takenToday,
    revenueToday: revenue._sum.total?.toNumber() ?? 0,
    refundsDue,
    awaitingPayment,
    nextSeven,
    staleEnquiries,
  };
}
