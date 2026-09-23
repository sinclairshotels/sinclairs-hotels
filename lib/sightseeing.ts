import type { Hotel, SightseeingSpot } from '@/content/types';
import { distanceKm, driveMinutes, formatDistance, formatDuration, roadKm } from '@/lib/distance';

export interface ExploreEntry {
  name: string;
  blurb?: string;
  image?: string;
  // Null where either the place or the property has no coordinates. The row
  // then carries no distance rather than a plausible-looking guess.
  distance: string | null;
  drive: string | null;
}

export function exploreEntries(hotel: Hotel): ExploreEntry[] {
  return hotel.sightseeing.map((spot) => entry(hotel, spot));
}

function entry(hotel: Hotel, spot: SightseeingSpot): ExploreEntry {
  const base = { name: spot.name, blurb: spot.blurb, image: spot.image };
  if (!hotel.drive) return { ...base, distance: null, drive: null };

  // The property's own road figure where it has one, an estimate from the
  // coordinates otherwise, and nothing at all where there are none.
  const km =
    spot.roadKm ??
    (hotel.coords && spot.coords
      ? roadKm(distanceKm(hotel.coords, spot.coords), hotel.drive)
      : null);
  if (km === null) return { ...base, distance: null, drive: null };

  return {
    ...base,
    distance: formatDistance(km),
    drive: formatDuration(driveMinutes(km, hotel.drive)),
  };
}

// The places that still need a coordinate, for content/sightseeing.test.ts to
// print. Nothing on the site depends on this being empty: a place without one
// simply shows no distance.
export function spotsMissingCoords(hotel: Hotel): string[] {
  if (!hotel.coords) return hotel.sightseeing.map((spot) => spot.name);
  return hotel.sightseeing
    .filter((spot) => !spot.coords && spot.roadKm === undefined)
    .map((spot) => spot.name);
}
