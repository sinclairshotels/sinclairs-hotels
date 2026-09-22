// @vitest-environment node
import { prisma } from '@/lib/db';
import { photoLibrary } from '@/lib/photo-library';
import { allSlots } from '@/lib/photo-slots';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let library: Awaited<ReturnType<typeof photoLibrary>>;

describe('photoLibrary', () => {
  beforeAll(async () => {
    await prisma.retiredPhoto.deleteMany({});
    library = await photoLibrary();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('offers every photo in the repository, not just the ones in use', () => {
    const inUse = new Set(allSlots().map((slot) => slot.contentPath));
    expect(library.length).toBeGreaterThan(inUse.size);
  });

  it('groups a hotel’s photos under the hotel’s name', () => {
    const gangtok = library.find((photo) =>
      photo.contentPath.startsWith('/images/hotels/gangtok/'),
    );
    expect(gangtok?.group).toBe('Sinclairs Gangtok');
  });

  it('groups the photos that belong to no property under their own headings', () => {
    const groups = new Set(library.map((photo) => photo.group));
    expect(groups).toContain('Weddings');
    expect(groups).toContain('Experiences');
    expect(groups).toContain('Awards');
  });

  it('says which positions a photo already fills', () => {
    const hero = allSlots().find((slot) => slot.key === 'gangtok:overview:hero');
    if (!hero) throw new Error('the gangtok hero slot is missing');

    const entry = library.find((photo) => photo.contentPath === hero.contentPath);
    expect(entry?.usedIn.some((use) => use.includes('Hero image'))).toBe(true);
  });

  it('leads with the properties in site order, not with the award badges', () => {
    const groups: string[] = [];
    for (const photo of library) {
      if (groups.at(-1) !== photo.group) groups.push(photo.group);
    }

    expect(groups[0]).toBe('Sinclairs Burdwan');
    expect(groups[1]).toBe('Sinclairs Darjeeling');
    expect(groups.indexOf('Awards')).toBeGreaterThan(
      groups.indexOf('Sinclairs Palace Retreat Udaipur'),
    );
  });

  it('leaves usedIn empty for a photo no page renders', () => {
    const unused = library.find((photo) => photo.usedIn.length === 0);
    expect(unused).toBeDefined();
  });

  it('leaves a deleted photo out, so it cannot be chosen back into a page', async () => {
    const victim = library.find((photo) => photo.usedIn.length === 0);
    if (!victim) throw new Error('no unused photo to retire');

    await prisma.retiredPhoto.create({
      data: { contentPath: victim.contentPath, retiredLabel: 'test', bytes: 1 },
    });
    const after = await photoLibrary();
    await prisma.retiredPhoto.deleteMany({});

    expect(after.some((photo) => photo.contentPath === victim.contentPath)).toBe(false);
  });
});
