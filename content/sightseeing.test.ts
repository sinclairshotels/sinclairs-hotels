import { hotels } from '@/content/hotels';
import { distanceKm } from '@/lib/distance';
import { exploreEntries, spotsMissingCoords } from '@/lib/sightseeing';
import { describe, expect, it } from 'vitest';

// Coordinates are approximate, taken from public references rather than
// surveyed, and every distance on the site is an estimate built on them. This
// file is the guard rail: it does not check that a number is right, it checks
// that no number is absurd and that the gaps are visible.
describe('sightseeing coordinates', () => {
  it('puts every property somewhere in India', () => {
    for (const hotel of hotels) {
      expect(hotel.coords, hotel.slug).toBeDefined();
      const { lat, lng } = hotel.coords as { lat: number; lng: number };
      expect(lat, hotel.slug).toBeGreaterThan(6);
      expect(lat, hotel.slug).toBeLessThan(36);
      expect(lng, hotel.slug).toBeGreaterThan(68);
      expect(lng, hotel.slug).toBeLessThan(98);
    }
  });

  it('keeps every place within a day of its property', () => {
    // A sightseeing list is places a guest can get to and back. Anything past
    // 250 km is a coordinate typed wrong, not an outing.
    for (const hotel of hotels) {
      for (const spot of hotel.sightseeing) {
        if (!spot.coords || !hotel.coords) continue;
        expect(distanceKm(hotel.coords, spot.coords), `${hotel.slug}: ${spot.name}`).toBeLessThan(
          250,
        );
      }
    }
  });

  it('shows a distance for most places, and none at all for the rest', () => {
    for (const hotel of hotels) {
      const entries = exploreEntries(hotel);
      const withDistance = entries.filter((entry) => entry.distance !== null);
      expect(withDistance.length, hotel.slug).toBeGreaterThan(0);
      // Never a distance without a time, or the row reads half-finished.
      for (const entry of withDistance) expect(entry.drive, entry.name).not.toBeNull();
    }
  });

  it('lists the places still waiting for a coordinate', () => {
    const missing = hotels.flatMap((hotel) =>
      spotsMissingCoords(hotel).map((name) => `${hotel.slug}: ${name}`),
    );
    // Not an assertion that the list is empty — it is a report. These show no
    // distance on the site, which is the honest behaviour, and they are ticked
    // off in docs/CONTENT_BACKLOG.md as the team confirms them.
    expect(missing.length).toBeLessThan(12);
  });
});
