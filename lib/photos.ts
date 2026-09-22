import { prisma } from '@/lib/db';

// How long a replaced photo is kept. Long enough that a wrong photo noticed a
// fortnight later can still be put back by hand, short enough that the table
// does not become a second copy of public/.
export const PHOTO_RETENTION_DAYS = 30;

export interface PhotoOverride {
  id: string;
  width: number;
  height: number;
  bytes: number;
  originalName: string;
  uploadedAt: Date;
  uploadedLabel: string;
}

// The bytes are deliberately not selected: a page listing 900 photos would
// otherwise pull every replaced image into memory to render a thumbnail URL.
const OVERRIDE_FIELDS = {
  id: true,
  contentPath: true,
  width: true,
  height: true,
  bytes: true,
  originalName: true,
  uploadedAt: true,
  uploadedLabel: true,
} as const;

export async function currentOverrides(): Promise<Map<string, PhotoOverride>> {
  const rows = await prisma.photoAsset.findMany({
    where: { supersededAt: null },
    select: OVERRIDE_FIELDS,
  });
  return new Map(rows.map(({ contentPath, ...rest }) => [contentPath, rest]));
}

export function photoHref(id: string): string {
  return `/api/photos/${id}`;
}

// What a given content path renders as today. Callers that already hold the
// override map pass it in; the site pages do, so one query serves a page.
export function photoUrl(contentPath: string, overrides: Map<string, PhotoOverride>): string {
  const override = overrides.get(contentPath);
  return override ? photoHref(override.id) : contentPath;
}

export async function retiredPaths(): Promise<Set<string>> {
  const rows = await prisma.retiredPhoto.findMany({ select: { contentPath: true } });
  return new Set(rows.map((row) => row.contentPath));
}

// A hotel with every image path swapped for whatever that position renders
// today. Photos are the one content type staff change without a deploy, so the
// pages that render a hotel read it through here rather than from the content
// file directly.
export function withPhotos<T>(hotel: T, overrides: Map<string, PhotoOverride>): T {
  if (overrides.size === 0) return hotel;

  const swap = (value: unknown): unknown => {
    if (typeof value === 'string')
      return value.startsWith('/images/') ? photoUrl(value, overrides) : value;
    if (Array.isArray(value)) return value.map(swap);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, swap(v)]));
    }
    return value;
  };

  return swap(hotel) as T;
}
