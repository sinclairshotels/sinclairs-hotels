import { describe, expect, it } from 'vitest';
import { cancelLinkState } from './cancel-link';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const booking = (overrides: Partial<Parameters<typeof cancelLinkState>[0]> = {}) => ({
  status: 'CONFIRMED' as const,
  checkIn: day('2026-11-10'),
  rateType: 'REFUNDABLE' as const,
  cancellationDeadline: day('2026-11-07'),
  cancelledAt: null,
  ...overrides,
});

// 10:00 IST on the given day, which is what a guest clicking a link looks like.
const at = (iso: string) => new Date(`${iso}T04:30:00.000Z`);

describe('cancelLinkState', () => {
  it('is usable, and refundable, before the deadline', () => {
    expect(cancelLinkState(booking(), at('2026-11-01'))).toEqual({
      usable: true,
      refundable: true,
    });
  });

  it('is still usable after the deadline, but nothing comes back', () => {
    expect(cancelLinkState(booking(), at('2026-11-08'))).toEqual({
      usable: true,
      refundable: false,
    });
  });

  it('never refunds a non-refundable booking', () => {
    expect(
      cancelLinkState(
        booking({ rateType: 'NON_REFUNDABLE', cancellationDeadline: null }),
        at('2026-11-01'),
      ),
    ).toEqual({ usable: true, refundable: false });
  });

  // "Valid until check-in": the day the stay begins, it is the desk's business.
  it('stops working on the check-in date', () => {
    expect(cancelLinkState(booking(), at('2026-11-09'))).toMatchObject({ usable: true });
    expect(cancelLinkState(booking(), at('2026-11-10'))).toEqual({
      usable: false,
      reason: 'stay-started',
    });
    expect(cancelLinkState(booking(), at('2026-11-20'))).toEqual({
      usable: false,
      reason: 'stay-started',
    });
  });

  it('will not cancel the same booking twice', () => {
    expect(cancelLinkState(booking({ cancelledAt: day('2026-11-02') }), at('2026-11-03'))).toEqual({
      usable: false,
      reason: 'already-cancelled',
    });
    expect(cancelLinkState(booking({ status: 'REFUND_DUE' }), at('2026-11-03'))).toEqual({
      usable: false,
      reason: 'already-cancelled',
    });
  });

  it('has nothing to cancel on a booking that was never confirmed', () => {
    expect(cancelLinkState(booking({ status: 'PENDING_PAYMENT' }), at('2026-11-01'))).toEqual({
      usable: false,
      reason: 'not-confirmed',
    });
  });
});
