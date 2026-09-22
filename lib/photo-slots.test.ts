import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { allSlots, claimedPaths, photoPages, slotByKey } from '@/lib/photo-slots';
import { describe, expect, it } from 'vitest';

const SCAN_DIRS = ['app', 'components', 'content'];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

// Every /images/… a page names has to belong to a slot. An image claimed by no
// slot is listed on /admin/photos under "Not used on any page", one click from
// being retired — so a hard-coded path nobody registered is a page waiting to
// lose its photo. This is the check that makes that list trustworthy.
describe('the photo slot registry', () => {
  it('claims every image path the site renders', () => {
    const claimed = claimedPaths();
    const missing = new Set<string>();

    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const source = readFileSync(file, 'utf8');
        // Anchored on the extension rather than the closing quote: a file name
        // with an apostrophe in it ("Children's play area.webp") ends a
        // single-quoted match early and would read as an unclaimed path.
        for (const match of source.matchAll(
          /['"`](\/images\/[^'"`]*?\.(?:webp|png|jpg|jpeg|svg))/g,
        )) {
          const path = match[1];
          if (!path || path.includes('${')) continue;
          if (!claimed.has(path)) missing.add(`${path}  (${file})`);
        }
      }
    }

    expect([...missing].sort()).toEqual([]);
  });

  // Two positions rendering the same file is normal — a hotel's hero is also its
  // listing card, and the weddings carousel reuses the portrait the home page
  // shows. Under the old contentPath keying that made them one photo; under slot
  // keying they are separate positions, and this is the check that says so.
  it('gives every position its own key, including ones that share a file', () => {
    const slots = allSlots();
    const byPath = new Map<string, string[]>();
    for (const s of slots) byPath.set(s.contentPath, [...(byPath.get(s.contentPath) ?? []), s.key]);

    const shared = [...byPath.entries()].filter(([, keys]) => keys.length > 1);
    expect(shared.length).toBeGreaterThan(0);
    for (const [, keys] of shared) expect(new Set(keys).size).toBe(keys.length);
  });

  // A page that names a slot the registry does not hold renders its own literal
  // for ever: no error, no override, just a position staff cannot change. The
  // scan above proves the *path* is claimed; this proves the page and the
  // registry agree about which position it is.
  it('agrees with every photoUrl() call site about slot key and path', () => {
    const wrong: string[] = [];
    const byKey = new Map(allSlots().map((s) => [s.key, s.contentPath]));

    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(
          /photoUrl\(\s*'([^']+)',\s*\n?\s*'(\/images\/[^']+)'/g,
        )) {
          const [, key, path] = match;
          if (!key || !path) continue;
          if (!byKey.has(key)) wrong.push(`${key} is not a slot  (${file})`);
          else if (byKey.get(key) !== path)
            wrong.push(`${key} renders ${byKey.get(key)}, page passes ${path}  (${file})`);
        }
      }
    }

    expect(wrong.sort()).toEqual([]);
  });

  it('points every slot at a file that is actually in the repository', () => {
    const missing = allSlots()
      .filter((slot) => {
        try {
          return !statSync(join('public', slot.contentPath.slice(1))).isFile();
        } catch {
          return true;
        }
      })
      .map((slot) => `${slot.key} -> ${slot.contentPath}`);

    expect(missing).toEqual([]);
  });

  it('gives every slot a key of its own, so an upload files itself correctly', () => {
    const keys = allSlots().map((slot) => slot.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('opens with Home and the hotels in site order, and finds a slot by key', () => {
    const pages = photoPages();
    expect(pages[0]?.key).toBe('home');
    expect(pages.slice(1, 10).map((page) => page.key)).toEqual([
      'hotel:burdwan',
      'hotel:darjeeling',
      'hotel:dooars',
      'hotel:gangtok',
      'hotel:kalimpong',
      'hotel:ooty',
      'hotel:port-blair',
      'hotel:siliguri',
      'hotel:udaipur',
    ]);
    expect(pages[10]?.key).toBe('contact');

    const first = allSlots()[0];
    expect(first && slotByKey(first.key)).toEqual(first);
  });

  it('names each hotel section in the order the page shows them', () => {
    const gangtok = photoPages().find((page) => page.key === 'hotel:gangtok');
    expect(gangtok?.sections.map((section) => section.title)).toEqual([
      'Overview',
      'Rooms',
      'Dining',
      'Weddings',
      'Meetings',
      'Gallery',
      'Explore',
    ]);
  });
});
