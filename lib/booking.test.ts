import { describe, expect, it } from 'vitest';
import {
  GST_SLAB_THRESHOLD,
  bookingReference,
  dateKey,
  eachNight,
  formatStayDate,
  gstRateFor,
  nightsBetween,
  parseDateOnly,
  quoteStay,
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

describe('gstRateFor', () => {
  it('charges 12% up to the slab threshold and 18% above it', () => {
    expect(gstRateFor(4000)).toBe(0.12);
    expect(gstRateFor(GST_SLAB_THRESHOLD)).toBe(0.12);
    expect(gstRateFor(GST_SLAB_THRESHOLD + 1)).toBe(0.18);
  });
});

describe('quoteStay', () => {
  it('prices each night at its own rate and multiplies by rooms', () => {
    const quote = quoteStay([4000, 5000], 2);
    expect(quote.nights).toBe(2);
    expect(quote.roomTotal).toBe(18000);
    expect(quote.taxTotal).toBe(2160);
    expect(quote.total).toBe(20160);
  });

  it('applies the slab per night, so cheap nights stay at 12% in a mixed stay', () => {
    const quote = quoteStay([7000, 9000], 1);
    // 7000 * 0.12 + 9000 * 0.18 — not 16000 * 0.18.
    expect(quote.taxTotal).toBe(2460);
  });

  it('rounds money to paise rather than carrying float error', () => {
    const quote = quoteStay([3333.33], 3);
    expect(quote.roomTotal).toBe(9999.99);
    expect(quote.taxTotal).toBe(1200);
    expect(quote.total).toBe(11199.99);
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
