import { bookingReference } from '@/lib/booking';
import { generateOrderId } from '@/lib/ipay';
import { describe, expect, it } from 'vitest';

// A booking and the payment that pays for it are reconciled against each
// other by date. They used to disagree: the reference took the UTC day and
// the order id took the server's, so anything sold between midnight and
// 05:30 IST came out a day apart — and only on a machine that was not UTC,
// which is every machine except the one it runs on.
describe('generateOrderId', () => {
  const dateOf = (orderId: string) => orderId.slice(0, 6);
  const dateOfReference = (reference: string) => reference.split('-')[1];

  it('dates the order the same day the booking reference does', () => {
    // 00:32 IST on 22 Sept is 19:02 UTC on the 21st — the window that broke.
    const lateNightIst = new Date('2026-09-21T19:02:29.000Z');
    expect(dateOf(generateOrderId(lateNightIst))).toBe(
      dateOfReference(bookingReference(lateNightIst)),
    );
  });

  it('agrees on an ordinary midday too', () => {
    const midday = new Date('2026-09-22T09:00:00.000Z');
    expect(dateOf(generateOrderId(midday))).toBe(dateOfReference(bookingReference(midday)));
  });

  it('takes the UTC day, not the day the server happens to be in', () => {
    expect(dateOf(generateOrderId(new Date('2026-09-21T19:02:29.000Z')))).toBe('260921');
    // One minute before UTC midnight is still the 21st, wherever the server is.
    expect(dateOf(generateOrderId(new Date('2026-09-21T23:59:00.000Z')))).toBe('260921');
    expect(dateOf(generateOrderId(new Date('2026-09-22T00:01:00.000Z')))).toBe('260922');
  });

  it('keeps the legacy YYMMDD + suffix shape, and is unique per call', () => {
    const id = generateOrderId(new Date('2026-09-22T09:00:00.000Z'));
    expect(id).toMatch(/^260922[0-9A-F]{10}$/);
    expect(generateOrderId()).not.toBe(generateOrderId());
  });
});
