import { describe, expect, it } from 'vitest';
import {
  cancellationSentence,
  deadlineFor,
  refundPolicy,
  refundableBlocked,
  refundableIsSellable,
  upliftRate,
  withinFreeCancellation,
} from './cancellation';

const decimal = (value: number) => ({ toNumber: () => value });
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('refundPolicy', () => {
  it('is absent unless both halves are set', () => {
    expect(refundPolicy({ refundableUpliftPct: null, freeCancellationDays: null })).toBeNull();
    // Half a policy is the dangerous state — an uplift with no deadline would
    // charge for flexibility that never arrives.
    expect(
      refundPolicy({ refundableUpliftPct: decimal(15), freeCancellationDays: null }),
    ).toBeNull();
    expect(refundPolicy({ refundableUpliftPct: null, freeCancellationDays: 7 })).toBeNull();
  });

  it('reads both halves when they are set', () => {
    expect(refundPolicy({ refundableUpliftPct: decimal(12.5), freeCancellationDays: 3 })).toEqual({
      upliftPct: 12.5,
      freeCancellationDays: 3,
    });
  });

  it('treats a zero uplift as a real policy, not an absent one', () => {
    expect(refundPolicy({ refundableUpliftPct: decimal(0), freeCancellationDays: 7 })).toEqual({
      upliftPct: 0,
      freeCancellationDays: 7,
    });
  });
});

describe('deadlineFor', () => {
  it('counts back from check-in', () => {
    expect(deadlineFor(utc('2026-10-20'), 7)).toEqual(utc('2026-10-13'));
  });

  it('is check-in itself when the window is zero days', () => {
    expect(deadlineFor(utc('2026-10-20'), 0)).toEqual(utc('2026-10-20'));
  });
});

describe('refundableIsSellable', () => {
  it('is not offered once its own window has already closed', () => {
    // Booking five days out against a seven-day window: the deadline is two
    // days in the past, so the uplift would buy nothing at all.
    expect(
      refundableIsSellable(
        utc('2026-10-20'),
        { upliftPct: 15, freeCancellationDays: 7 },
        utc('2026-10-15'),
      ),
    ).toBe(false);
  });

  it('is offered while the deadline is still ahead, and on the day itself', () => {
    const policy = { upliftPct: 15, freeCancellationDays: 7 };
    expect(refundableIsSellable(utc('2026-10-20'), policy, utc('2026-10-01'))).toBe(true);
    expect(refundableIsSellable(utc('2026-10-20'), policy, utc('2026-10-13'))).toBe(true);
  });
});

describe('upliftRate', () => {
  it('adds the percentage and lands on whole rupees', () => {
    expect(upliftRate(5400, 15)).toBe(6210);
    expect(upliftRate(4999, 12.5)).toBe(5624);
  });

  it('leaves the rate alone at zero percent', () => {
    expect(upliftRate(5400, 0)).toBe(5400);
  });
});

describe('refundableBlocked', () => {
  const peak = { startDate: utc('2026-12-15'), endDate: utc('2027-01-15'), label: 'Peak season' };

  it('blocks a stay wholly inside a window', () => {
    expect(refundableBlocked([peak], utc('2026-12-24'), utc('2026-12-27'))?.label).toBe(
      'Peak season',
    );
  });

  it('blocks a stay that only overlaps the window at one end', () => {
    // Arrives before it starts, still there on the 15th.
    expect(refundableBlocked([peak], utc('2026-12-13'), utc('2026-12-16'))).not.toBeNull();
    // Arrives on the last day of it.
    expect(refundableBlocked([peak], utc('2027-01-15'), utc('2027-01-18'))).not.toBeNull();
  });

  it('leaves a stay that checks out the morning the window opens', () => {
    // The 15th is not one of the nights paid for, so the guest is gone before
    // the period begins.
    expect(refundableBlocked([peak], utc('2026-12-12'), utc('2026-12-15'))).toBeNull();
  });

  it('leaves a stay that arrives the day after it closes', () => {
    expect(refundableBlocked([peak], utc('2027-01-16'), utc('2027-01-18'))).toBeNull();
  });

  it('is null when the property has no windows at all', () => {
    expect(refundableBlocked([], utc('2026-12-24'), utc('2026-12-27'))).toBeNull();
  });
});

describe('withinFreeCancellation', () => {
  it('is never true for a non-refundable booking, whatever date is stored', () => {
    expect(withinFreeCancellation('NON_REFUNDABLE', utc('2099-01-01'), utc('2026-01-01'))).toBe(
      false,
    );
  });

  it('is true up to and including the deadline day, and false after it', () => {
    const deadline = utc('2026-10-13');
    expect(withinFreeCancellation('REFUNDABLE', deadline, utc('2026-10-12'))).toBe(true);
    // The whole of the deadline day counts — a guest cancelling at 11:59 that
    // night has not missed it. The day is the day *in India*, where the hotel
    // is, so it ends at 18:30 UTC and not at midnight UTC.
    expect(
      withinFreeCancellation('REFUNDABLE', deadline, new Date('2026-10-13T18:29:59.999Z')),
    ).toBe(true);
    expect(
      withinFreeCancellation('REFUNDABLE', deadline, new Date('2026-10-13T18:30:00.000Z')),
    ).toBe(false);
    expect(withinFreeCancellation('REFUNDABLE', deadline, utc('2026-10-14'))).toBe(false);
  });

  it('is false when a refundable booking somehow carries no deadline', () => {
    expect(withinFreeCancellation('REFUNDABLE', null, utc('2026-01-01'))).toBe(false);
  });
});

describe('cancellationSentence', () => {
  it('names the date on a refundable booking', () => {
    expect(cancellationSentence('REFUNDABLE', utc('2026-10-13'))).toContain(
      'Free cancellation until 13 Oct 2026',
    );
  });

  it('falls back to the non-refundable wording without a deadline', () => {
    expect(cancellationSentence('REFUNDABLE', null)).toContain('non-refundable');
    expect(cancellationSentence('NON_REFUNDABLE', null)).toContain('non-refundable');
  });
});
