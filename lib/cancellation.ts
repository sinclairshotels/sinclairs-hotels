import { addDays, dateKey, formatStayDate, todayInIndia } from '@/lib/booking';
import type { BookingRateType } from '@prisma/client';

// One place that decides what a rate type means, because five surfaces say it:
// the room list, the guest form, the confirmation page, two emails and the
// Terms block. Five hand-written sentences would become five policies.

export interface RefundPolicy {
  upliftPct: number;
  freeCancellationDays: number;
}

// Both columns are nullable together: absent means this property does not sell
// a refundable rate at all, which is not the same as selling one at no uplift.
export function refundPolicy(settings: {
  refundableUpliftPct: { toNumber(): number } | null;
  freeCancellationDays: number | null;
}): RefundPolicy | null {
  if (settings.refundableUpliftPct === null || settings.freeCancellationDays === null) return null;
  return {
    upliftPct: settings.refundableUpliftPct.toNumber(),
    freeCancellationDays: settings.freeCancellationDays,
  };
}

// The last date a guest may cancel and still get everything back. UTC midnight
// like every other date here, so it cannot drift a night either way.
export function deadlineFor(checkIn: Date, freeCancellationDays: number): Date {
  return addDays(checkIn, -freeCancellationDays);
}

// A refundable rate whose window has already closed is an uplift bought for
// nothing, so it is not offered at all rather than sold and then explained.
export function refundableIsSellable(
  checkIn: Date,
  policy: RefundPolicy,
  now: Date = new Date(),
): boolean {
  return deadlineFor(checkIn, policy.freeCancellationDays) >= todayInIndia(now);
}

export function upliftRate(rate: number, upliftPct: number): number {
  return Math.round(rate * (1 + upliftPct / 100));
}

// True while the guest can still cancel for a full refund. Compared date to
// date: cancelling at any hour of the deadline day is still inside it.
export function withinFreeCancellation(
  rateType: BookingRateType,
  deadline: Date | null,
  now: Date = new Date(),
): boolean {
  if (rateType !== 'REFUNDABLE' || !deadline) return false;
  return dateKey(todayInIndia(now)) <= dateKey(deadline);
}

// The sentence every surface uses. Takes the booking's own stored terms rather
// than the property's current ones, so a policy change never rewrites what
// somebody already agreed to.
export function cancellationSentence(rateType: BookingRateType, deadline: Date | null): string {
  if (rateType === 'REFUNDABLE' && deadline) {
    return `Free cancellation until ${formatStayDate(deadline)}. Cancel by that date for a full refund; after it, no refund is made.`;
  }
  return 'This booking is non-refundable and non-transferable. No refund is made for cancellation, no-show or early departure.';
}

// The Terms block's opening line, which states both rates rather than the one
// this booking happens to be on: it is the published policy, and a guest
// comparing it with content/legal.ts must find the same two sentences.
export const CANCELLATION_TERM =
  'Non-refundable bookings cannot be cancelled or refunded. Refundable bookings can be cancelled free of charge until the deadline shown on your confirmation; after that, no refund is made.';

export function rateTypeLabel(rateType: BookingRateType): string {
  return rateType === 'REFUNDABLE' ? 'Refundable' : 'Non-refundable';
}
