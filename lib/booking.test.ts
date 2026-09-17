import { describe, expect, it } from 'vitest';
import {
  bookingReference,
  dateKey,
  eachNight,
  formatStayDate,
  nightsBetween,
  parseDateOnly,
  quoteStay,
  taxForNight,
  todayUtc,
} from './booking';

describe('parseDateOnly', () => {
  it('parses an ISO date to UTC midnight', () => {
    const parsed = parseDateOnly('2026-09-16');
    expect(parsed?.toISOString()).toBe('2026-09-16T00:00:00.000Z');
  });

  it.each(['', '16-09-2026', '2026-9-16', '2026-09-16T10:00:00Z', 'not-a-date'])(
    'rejects %s',
    (value) => {
      expect(parseDateOnly(value)).toBeNull();
    },
  );

  it('rejects a date that does not exist rather than rolling it forward', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(parseDateOnly('2026-13-01')).toBeNull();
  });

  it('accepts a real leap day', () => {
    expect(dateKey(parseDateOnly('2028-02-29') as Date)).toBe('2028-02-29');
  });
});

describe('nights', () => {
  it('counts nights, not calendar days', () => {
    const checkIn = parseDateOnly('2026-09-16') as Date;
    const checkOut = parseDateOnly('2026-09-19') as Date;
    expect(nightsBetween(checkIn, checkOut)).toBe(3);
    expect(eachNight(checkIn, checkOut).map(dateKey)).toEqual([
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ]);
  });

  it('spans a month boundary and a DST change without drifting', () => {
    const nights = eachNight(
      parseDateOnly('2026-10-31') as Date,
      parseDateOnly('2026-11-02') as Date,
    );
    expect(nights.map(dateKey)).toEqual(['2026-10-31', '2026-11-01']);
  });

  it('returns no nights for a same-day range', () => {
    const day = parseDateOnly('2026-09-16') as Date;
    expect(eachNight(day, day)).toEqual([]);
  });
});

describe('taxForNight', () => {
  it('takes the lower rate at or below the threshold — the threshold is inclusive', () => {
    expect(taxForNight(7000)).toBe(350);
    expect(taxForNight(7500)).toBe(375);
  });

  it('takes the higher rate one rupee above it', () => {
    expect(taxForNight(7501)).toBeCloseTo(1350.18, 2);
  });

  it('follows a slab staff have changed', () => {
    const slab = { threshold: 5000, lowRate: 0.12, highRate: 0.28 };
    expect(taxForNight(5000, slab)).toBe(600);
    expect(taxForNight(5001, slab)).toBeCloseTo(1400.28, 2);
  });
});

describe('quoteStay', () => {
  it('prices each night at its own rate and multiplies by rooms', () => {
    const quote = quoteStay([4000, 5000], 2);
    expect(quote.nights).toBe(2);
    expect(quote.roomTotal).toBe(18000);
    // both nights sit under the threshold, so both are taxed at 5%
    expect(quote.taxTotal).toBe(900);
    expect(quote.total).toBe(18900);
  });

  it('taxes a stay that crosses the threshold at both rates', () => {
    const quote = quoteStay([7000, 9000], 1);
    // 5% of 7,000 plus 18% of 9,000 — the test the flat rate could not fail
    expect(quote.taxTotal).toBe(1970);
  });

  it('rounds money to paise rather than carrying float error', () => {
    const quote = quoteStay([3333.33], 3);
    expect(quote.roomTotal).toBe(9999.99);
    expect(quote.taxTotal).toBe(500);
    expect(quote.total).toBe(10499.99);
  });
});

describe('formatStayDate', () => {
  it('renders the stored date, never shifted by the runtime timezone', () => {
    // Loose on the month abbreviation ("Sep" vs "Sept") because that varies
    // with the runtime's ICU build; the day is the part this guards.
    expect(formatStayDate(parseDateOnly('2026-09-16') as Date)).toMatch(/^16 Sept? 2026$/);
  });
});

describe('bookingReference', () => {
  it('is dated, prefixed, and free of characters that are misheard on the phone', () => {
    const reference = bookingReference(new Date('2026-09-16T12:00:00Z'));
    expect(reference).toMatch(/^SNC-260916-[ACDEFGHJKLMNPQRTUVWXY349]{5}$/);
  });

  it('does not repeat itself', () => {
    const references = new Set(Array.from({ length: 200 }, () => bookingReference()));
    expect(references.size).toBe(200);
  });
});

describe('todayUtc', () => {
  it('truncates an instant to its UTC date', () => {
    expect(dateKey(todayUtc(new Date('2026-09-16T23:30:00Z')))).toBe('2026-09-16');
  });
});
