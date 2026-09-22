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
    expect(pages[10]?.key).toBe('enquiry');
    expect(pages[11]?.key).toBe('contact');

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
