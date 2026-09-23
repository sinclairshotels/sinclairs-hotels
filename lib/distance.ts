import type { DriveProfile, LatLng } from '@/content/types';

// Distance between two points on the earth, in kilometres. Great-circle, not
// road: a road distance needs a routing service, and this exists to answer "is
// that nearby or a day out", which a straight line answers honestly.
//
// The page says "N km away", never "N km drive", for exactly that reason.
const EARTH_RADIUS_KM = 6371;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(from: LatLng, to: LatLng): number {
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Roads are longer than the line between two points, and slower in the hills
// than on the plains. One factor and one speed per property, stated in the
// content file (Hotel.drive), is an honest estimate a guest can plan around —
// and where a property has not stated them, no time is shown rather than a
// made-up one. roadFactor 1.3 is flat country; 1.9 is a hill road that
// switchbacks. averageSpeedKph is door to door, including the town end.

// What the road is likely to measure, from the line between the two points.
// An estimate, and said to be one on the page: the alternative is a routing
// service this site has no reason to depend on.
export function roadKm(straightKm: number, profile: DriveProfile): number {
  return straightKm * profile.roadFactor;
}

export function driveMinutes(km: number, profile: DriveProfile): number {
  return Math.round((km / profile.averageSpeedKph) * 60);
}

// "45 min", "1 hr 20 min" — a length of time, never a clock time, so it does
// not collide with the site's one time format for opening hours.
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.max(5, Math.round(minutes / 5) * 5)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round((minutes % 60) / 5) * 5;
  if (rest === 0 || rest === 60) return `${rest === 60 ? hours + 1 : hours} hr`;
  return `${hours} hr ${rest} min`;
}

// Rounded to the nearest kilometre, except under 1 km where "0 km" reads as
// broken and the honest answer is that it is on the doorstep.
export function formatDistance(km: number): string {
  if (km < 1) return 'under 1 km';
  return `${Math.round(km)} km`;
}
