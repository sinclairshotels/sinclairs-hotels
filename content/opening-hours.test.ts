import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hotels } from './hotels';
import { reservationsHours, stayTimes } from './site';

// The one house format, in one place: lowercase am/pm, no leading zero, an
// en dash with spaces either side, and sittings joined by ' · '. Written as a
// test rather than a formatter because these are hand-authored strings — a
// formatter would silently accept "7.30 AM" and print something else.
const TIME = String.raw`(?:12 noon|midnight|(?:[1-9]|1[0-2])(?::[0-5]\d)? (?:am|pm))`;
const RANGE = `${TIME} – ${TIME}`;
const OPENING_HOURS = new RegExp(`^${RANGE}(?: · ${RANGE})*$`);
const A_TIME = new RegExp(`^${TIME}$`);

// Anything that reads as a clock time, in any of the shapes the legacy copy
// used: "7 AM", "10.30 PM", "12 Noon", "2pm".
const TIME_IN_PROSE = /\b\d{1,2}([.:]\d{2})?\s?(am|pm|noon)\b/i;

describe('opening hours', () => {
  it.each(hotels.flatMap((hotel) => hotel.dining.map((venue) => [hotel.slug, venue] as const)))(
    '%s: %o carries no hours in its prose',
    (_slug, venue) => {
      // Hours belong on their own line. In a sentence they are hard to find,
      // and they go stale where nobody is looking for them.
      expect(venue.description).not.toMatch(TIME_IN_PROSE);
      expect(venue.description).not.toMatch(/timings/i);
    },
  );

  it.each(
    hotels.flatMap((hotel) =>
      hotel.dining
        .filter((venue) => venue.openingHours)
        .map((venue) => [hotel.slug, venue.name, venue.openingHours as string] as const),
    ),
  )('%s / %s is in the house format', (_slug, _name, hours) => {
    expect(hours).toMatch(OPENING_HOURS);
  });

  it.each(Object.entries(stayTimes))(
    '%s check-in and check-out are in the house format',
    (_slug, times) => {
      expect(times.checkIn).toMatch(A_TIME);
      expect(times.checkOut).toMatch(A_TIME);
    },
  );

  it('states reservations hours in the house format', () => {
    expect(reservationsHours).toMatch(new RegExp(`^${RANGE}\\b`));
  });
});

describe('"Timings"', () => {
  // The word itself is gone from anything a guest reads; admin field names are
  // out of scope and live outside these directories.
  const roots = ['content', 'app/(site)', 'components'];

  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return files(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  it('appears nowhere on the public site', () => {
    const offenders = roots
      .flatMap(files)
      .filter((path) => /timings/i.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
