import { describe, expect, it } from 'vitest';
import {
  allocateExtras,
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

describe('allocateExtras', () => {
  it('seats everyone within the rooms booked when they fit', () => {
    expect(allocateExtras(2, 4, 0, 2)).toEqual([
      { extraAdults: 0, extraChildren: 0 },
      { extraAdults: 0, extraChildren: 0 },
    ]);
  });

  it('makes the guest beyond the base occupancy an extra', () => {
    expect(allocateExtras(1, 3, 0, 2)).toEqual([{ extraAdults: 1, extraChildren: 0 }]);
  });

  it('seats adults first, so the child is the one charged', () => {
    expect(allocateExtras(1, 2, 1, 2)).toEqual([{ extraAdults: 0, extraChildren: 1 }]);
  });

  it('spreads extras across rooms rather than piling them into the first', () => {
    expect(allocateExtras(2, 6, 0, 2)).toEqual([
      { extraAdults: 1, extraChildren: 0 },
      { extraAdults: 1, extraChildren: 0 },
    ]);
  });

  it('charges nobody when the party is smaller than the rate covers', () => {
    expect(allocateExtras(1, 1, 0, 2)).toEqual([{ extraAdults: 0, extraChildren: 0 }]);
  });
});

const basePricing = {
  rooms: 1,
  adults: 2,
  children: 0,
  baseOccupancy: 2,
  extraAdultCharge: 1500,
  extraChildCharge: 800,
  breakfastPerExtraGuest: 0,
};

describe('quoteStay', () => {
  it('charges the base rate when the party is smaller than the room covers', () => {
    const forTwo = quoteStay({ ...basePricing, nightlyRates: [5000], adults: 2 });
    const forOne = quoteStay({ ...basePricing, nightlyRates: [5000], adults: 1 });
    // A single guest in a double does not get a discount, and must not be
    // credited an extra-adult charge for the seat nobody took.
    expect(forOne.roomTotal).toBe(forTwo.roomTotal);
    expect(forOne.total).toBe(forTwo.total);
    expect(forOne.extrasTotal).toBe(0);
    expect(forOne.extraAdults).toBe(0);
  });

  it('prices each night at its own rate and multiplies by rooms', () => {
    const quote = quoteStay({ ...basePricing, nightlyRates: [4000, 5000], rooms: 2, adults: 4 });
    expect(quote.nights).toBe(2);
    expect(quote.roomTotal).toBe(18000);
    // both nights sit under the threshold, so both are taxed at 5%
    expect(quote.taxTotal).toBe(900);
    expect(quote.total).toBe(18900);
  });

  it('taxes a stay that crosses the threshold at both rates', () => {
    const quote = quoteStay({ ...basePricing, nightlyRates: [7000, 9000] });
    // 5% of 7,000 plus 18% of 9,000 — the test the flat rate could not fail
    expect(quote.taxTotal).toBe(1970);
  });

  it('charges an extra adult on Room Only without a breakfast', () => {
    const quote = quoteStay({ ...basePricing, nightlyRates: [4000], adults: 3 });
    expect(quote.extraAdults).toBe(1);
    expect(quote.extrasTotal).toBe(1500);
    expect(quote.roomTotal).toBe(5500);
  });

  it('charges an extra adult on With Breakfast one breakfast as well', () => {
    const quote = quoteStay({
      ...basePricing,
      // the plan's own rate already feeds the two base guests
      nightlyRates: [4900],
      adults: 3,
      breakfastPerExtraGuest: 450,
    });
    expect(quote.extrasTotal).toBe(1950);
    expect(quote.roomTotal).toBe(6850);
  });

  it('charges an extra child at the child rate, plus breakfast on that plan', () => {
    const quote = quoteStay({
      ...basePricing,
      nightlyRates: [4900],
      adults: 2,
      children: 1,
      breakfastPerExtraGuest: 450,
    });
    expect(quote.extraChildren).toBe(1);
    expect(quote.extrasTotal).toBe(1250);
  });

  it('taxes the room on what the extra guest pushed it to', () => {
    // 7,000 alone is under the threshold; with a 1,500 extra adult it is not
    const quote = quoteStay({ ...basePricing, nightlyRates: [7000], adults: 3 });
    expect(quote.roomTotal).toBe(8500);
    expect(quote.taxTotal).toBe(1530);
  });

  it('rounds money to paise rather than carrying float error', () => {
    const quote = quoteStay({ ...basePricing, nightlyRates: [3333.33], rooms: 3, adults: 6 });
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
