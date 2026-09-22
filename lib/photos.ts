import { prisma } from '@/lib/db';
import type { PhotoSlot } from '@/lib/photo-slots';

// How long a replaced photo is kept. Long enough that a wrong photo noticed a
// fortnight later can still be put back by hand, short enough that the table
// does not become a second copy of public/.
export const PHOTO_RETENTION_DAYS = 30;

export interface PhotoOverride {
  id: string;
  // What this position renders instead of its content path.
  contentPath: string;
  width: number;
  height: number;
  bytes: number;
  originalName: string;
  uploadedAt: Date;
  uploadedLabel: string;
  // Set when the position was pointed at a photo already in the repository
  // rather than given one of its own. Nothing was copied, so this renders as
  // that file's own URL.
  sourcePath: string | null;
}

// Keyed by slot, never by file. Two positions can render the same photo — a
// hotel's hero is also its listing card — and replacing one of them must leave
// the other alone; giving them different photos is exactly what this screen is
// for. Keying by contentPath made that impossible to express.
export type PhotoOverrides = Map<string, PhotoOverride>;

// The bytes are deliberately not selected: a page listing 900 photos would
// otherwise pull every replaced image into memory to render a thumbnail URL.
const OVERRIDE_FIELDS = {
  id: true,
  slotKey: true,
  contentPath: true,
  width: true,
  height: true,
  bytes: true,
  originalName: true,
  uploadedAt: true,
  uploadedLabel: true,
  sourcePath: true,
} as const;

export async function currentOverrides(): Promise<PhotoOverrides> {
  const rows = await prisma.photoAsset.findMany({
    where: { supersededAt: null },
    select: OVERRIDE_FIELDS,
  });
  return new Map(rows.map(({ slotKey, ...rest }) => [slotKey, rest]));
}

export function photoHref(id: string): string {
  return `/api/photos/${id}`;
}

function overrideUrl(override: PhotoOverride): string {
  // Deliberately one hop, not a chain: pointing A at B while B points at C
  // shows B, and two positions aimed at each other do not spin.
  return override.sourcePath ?? photoHref(override.id);
}

// What a named position renders today. The content path is passed alongside the
// slot key rather than looked up, so a page still renders the file it names if
// the registry and the page ever disagree — and photo-slots.test.ts fails when
// they do.
export function photoUrl(slotKey: string, contentPath: string, overrides: PhotoOverrides): string {
  const override = overrides.get(slotKey);
  return override ? overrideUrl(override) : contentPath;
}

export async function retiredPaths(): Promise<Set<string>> {
  const rows = await prisma.retiredPhoto.findMany({ select: { contentPath: true } });
  return new Set(rows.map((row) => row.contentPath));
}

function setAt(root: unknown, path: (string | number)[], value: string): void {
  let node = root;
  for (const step of path.slice(0, -1)) {
    if (node === null || typeof node !== 'object') return;
    node = (node as Record<string | number, unknown>)[step];
  }
  const last = path[path.length - 1];
  if (last === undefined || node === null || typeof node !== 'object') return;
  (node as Record<string | number, unknown>)[last] = value;
}

// A copy of some content with each overridden position swapped for whatever it
// renders today. It applies an override **at its slot's locator**, so replacing
// one position never touches another that happens to hold the same file.
//
// The caller passes the slots whose locators are relative to this value —
// hotelSlots(hotel), experienceSlots(), and so on — because nothing in the
// value itself says which positions it contains.
export function withPhotos<T>(value: T, slots: PhotoSlot[], overrides: PhotoOverrides): T {
  if (overrides.size === 0) return value;

  const applicable = slots.filter((s) => s.at && overrides.has(s.key));
  if (applicable.length === 0) return value;

  const copy = structuredClone(value);
  for (const s of applicable) {
    const override = overrides.get(s.key);
    if (s.at && override) setAt(copy, s.at, overrideUrl(override));
  }
  return copy;
}
