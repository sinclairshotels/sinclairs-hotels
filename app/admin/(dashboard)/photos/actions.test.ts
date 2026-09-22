// @vitest-environment node
//
// jsdom's File and Blob do not hand sharp readable bytes, and this suite is a
// server action taking an upload — there is no DOM in it to want.
import { prisma } from '@/lib/db';
import { MAX_SINGLE_FILE_BYTES } from '@/lib/photo-files';
import { allSlots } from '@/lib/photo-slots';
import { currentOverrides, photoUrl } from '@/lib/photos';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupTestStaff, createTestStaff } from '../../../../test-utils/auth';
import { assignPhoto, replacePhoto, retirePhoto } from './actions';

const mockState = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  ip: 'photos-test',
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'staff_session' && mockState.cookieValue
        ? { value: mockState.cookieValue }
        : undefined,
  }),
  headers: async () => ({ get: (name: string) => (name === 'x-real-ip' ? mockState.ip : null) }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// The bytes go to Vercel Blob, which has no local equivalent to run against.
// What matters here is that the upload path stores the URL it was given and
// that nothing lands in Postgres, so the client is stubbed rather than the
// storage module — the slot-keyed pathname is part of what is under test.
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (pathname: string) => ({
    url: `https://test.public.blob.vercel-storage.com/${pathname}`,
    pathname,
  })),
  del: vi.fn(async () => undefined),
}));

process.env.BLOB_READ_WRITE_TOKEN ??= 'test-token';

// A hero slot, so the target width is the widest the site serves and a small
// upload exercises the "never enlarge" rule.
const SLOT = allSlots().find((slot) => slot.key === 'gangtok:overview:hero');

let staffUser: Awaited<ReturnType<typeof createTestStaff>>;

async function png(width: number, height: number): Promise<File> {
  const data = await sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 60, b: 40 } },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(data)], 'replacement.png', { type: 'image/png' });
}

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const replace = (data: FormData) => replacePhoto({ status: 'idle' }, data);
const retire = (data: FormData) => retirePhoto({ status: 'idle' }, data);

async function clear() {
  await prisma.photoAsset.deleteMany({});
  await prisma.retiredPhoto.deleteMany({});
}

describe('replacePhoto', () => {
  beforeEach(async () => {
    await clear();
    await cleanupTestStaff();
    staffUser = await createTestStaff({ role: 'ADMIN' });
    mockState.cookieValue = staffUser.token;
  });

  afterAll(async () => {
    await clear();
    await cleanupTestStaff();
    await prisma.$disconnect();
  });

  it('converts an upload to WebP and files it against the slot', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');

    const state = await replace(form({ slotKey: SLOT.key, file: await png(1200, 800) }));

    expect(state.status).toBe('success');
    const asset = await prisma.photoAsset.findFirstOrThrow({ where: { supersededAt: null } });
    expect(asset.contentType).toBe('image/webp');
    expect(asset.contentPath).toBe(SLOT.contentPath);
    expect(asset.slotKey).toBe(SLOT.key);
    expect(asset.blobUrl).toMatch(/^https:\/\/test\.public\.blob\.vercel-storage\.com\//);

    // The bytes are what was handed to blob storage, not what is in Postgres —
    // Postgres holds no image data at all any more, which is the point.
    const [pathname, bytes] = vi.mocked(put).mock.calls.at(-1) ?? [];
    expect(pathname).toContain('gangtok-overview-hero');
    expect((await sharp(Buffer.from(bytes as Uint8Array)).metadata()).format).toBe('webp');
  });

  it('never enlarges a photo past what the upload actually contains', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');
    expect(SLOT.targetWidth).toBeGreaterThan(1200);

    await replace(form({ slotKey: SLOT.key, file: await png(1200, 800) }));

    const asset = await prisma.photoAsset.findFirstOrThrow({ where: { supersededAt: null } });
    expect(asset.width).toBe(1200);
  });

  it('resizes down to the slot width when the upload is larger', async () => {
    const gallery = allSlots().find((slot) => slot.targetWidth === 2400);
    if (!gallery) throw new Error('no standard-width slot');

    await replace(form({ slotKey: gallery.key, file: await png(3000, 2000) }));

    const asset = await prisma.photoAsset.findFirstOrThrow({ where: { supersededAt: null } });
    expect(asset.width).toBe(2400);
  });

  it('keeps the photo it replaced rather than deleting it', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');

    await replace(form({ slotKey: SLOT.key, file: await png(900, 600) }));
    await replace(form({ slotKey: SLOT.key, file: await png(1000, 700) }));

    const all = await prisma.photoAsset.findMany({ orderBy: { uploadedAt: 'asc' } });
    expect(all).toHaveLength(2);
    expect(all[0]?.supersededAt).not.toBeNull();
    expect(all[1]?.supersededAt).toBeNull();
  });

  it('writes an audit entry naming the slot and the new dimensions', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');

    await replace(form({ slotKey: SLOT.key, file: await png(800, 600) }));

    const event = await prisma.auditEvent.findFirst({
      where: { action: 'photo.replaced' },
      orderBy: { at: 'desc' },
    });
    expect(event?.summary).toContain(SLOT.contentPath);
    expect(event?.actorLabel).toContain(staffUser.email);
  });

  it('refuses a file that is not an image, and writes nothing', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');
    const notAnImage = new File([new Uint8Array([1, 2, 3])], 'notes.txt', { type: 'text/plain' });

    const state = await replace(form({ slotKey: SLOT.key, file: notAnImage }));

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/JPG, PNG or WebP/i);
    expect(await prisma.photoAsset.count()).toBe(0);
  });

  it('refuses a slot key that no longer exists', async () => {
    const state = await replace(
      form({ slotKey: 'gangtok:overview:gone', file: await png(10, 10) }),
    );

    expect(state.status).toBe('error');
    expect(await prisma.photoAsset.count()).toBe(0);
  });

  it('keeps a converted photo inside the per-image budget', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');

    await replace(form({ slotKey: SLOT.key, file: await png(2000, 1400) }));

    const asset = await prisma.photoAsset.findFirstOrThrow({ where: { supersededAt: null } });
    expect(asset.bytes).toBeLessThanOrEqual(MAX_SINGLE_FILE_BYTES);
  });

  it('turns a photo editor away — this is Admin-only', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');
    const revenue = await createTestStaff({ role: 'REVENUE' });
    mockState.cookieValue = revenue.token;

    const state = await replace(form({ slotKey: SLOT.key, file: await png(10, 10) }));

    expect(state.status).toBe('error');
    expect(await prisma.photoAsset.count()).toBe(0);
  });
});

describe('retirePhoto', () => {
  beforeEach(async () => {
    await clear();
    await cleanupTestStaff();
    staffUser = await createTestStaff({ role: 'ADMIN' });
    mockState.cookieValue = staffUser.token;
  });

  afterAll(async () => {
    await clear();
    await cleanupTestStaff();
    await prisma.$disconnect();
  });

  it('refuses to delete a photo a page still renders', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');

    const state = await retire(form({ contentPath: SLOT.contentPath }));

    expect(state.status).toBe('error');
    expect(state.message).toMatch(/a page uses this photo/i);
    expect(await prisma.retiredPhoto.count()).toBe(0);
  });

  it('refuses a path that is not in the repository', async () => {
    const state = await retire(form({ contentPath: '/images/nothing-here.webp' }));

    expect(state.status).toBe('error');
    expect(await prisma.retiredPhoto.count()).toBe(0);
  });
});

describe('assignPhoto', () => {
  // A photo that belongs to another property, so "this position now uses that
  // one" is unambiguous.
  const SOURCE = allSlots().find((slot) => slot.key === 'darjeeling:overview:hero');

  beforeEach(async () => {
    await clear();
    await cleanupTestStaff();
    staffUser = await createTestStaff({ role: 'ADMIN' });
    mockState.cookieValue = staffUser.token;
  });

  afterAll(async () => {
    await clear();
    await cleanupTestStaff();
    await prisma.$disconnect();
  });

  it('points a position at an existing photo without copying a single byte', async () => {
    if (!SLOT || !SOURCE) throw new Error('fixture slots are missing');

    const state = await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SOURCE.contentPath }),
    );

    expect(state.status).toBe('success');
    const asset = await prisma.photoAsset.findFirstOrThrow({ where: { supersededAt: null } });
    expect(asset.blobUrl).toBeNull();
    expect(asset.sourcePath).toBe(SOURCE.contentPath);
  });

  it('renders as the source file’s own URL, not as a stored copy', async () => {
    if (!SLOT || !SOURCE) throw new Error('fixture slots are missing');

    await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SOURCE.contentPath }),
    );

    expect(photoUrl(SLOT.key, SLOT.contentPath, await currentOverrides())).toBe(SOURCE.contentPath);
  });

  it('resolves one hop only, so two positions pointed at each other cannot spin', async () => {
    if (!SLOT || !SOURCE) throw new Error('fixture slots are missing');

    await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SOURCE.contentPath }),
    );
    await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SOURCE.key, sourcePath: SLOT.contentPath }),
    );

    const overrides = await currentOverrides();
    expect(photoUrl(SLOT.key, SLOT.contentPath, overrides)).toBe(SOURCE.contentPath);
    expect(photoUrl(SOURCE.key, SOURCE.contentPath, overrides)).toBe(SLOT.contentPath);
  });

  it('puts the original back when the position’s own photo is chosen', async () => {
    if (!SLOT || !SOURCE) throw new Error('fixture slots are missing');
    await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SOURCE.contentPath }),
    );

    const state = await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SLOT.contentPath }),
    );

    expect(state.status).toBe('success');
    expect(await prisma.photoAsset.count({ where: { supersededAt: null } })).toBe(0);
    expect(photoUrl(SLOT.key, SLOT.contentPath, await currentOverrides())).toBe(SLOT.contentPath);
  });

  it('supersedes an upload rather than deleting it, same as a second upload would', async () => {
    if (!SLOT || !SOURCE) throw new Error('fixture slots are missing');
    await replace(form({ slotKey: SLOT.key, file: await png(900, 600) }));

    await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SOURCE.contentPath }),
    );

    const all = await prisma.photoAsset.findMany({ orderBy: { uploadedAt: 'asc' } });
    expect(all).toHaveLength(2);
    expect(all[0]?.supersededAt).not.toBeNull();
    expect(all[1]?.sourcePath).toBe(SOURCE.contentPath);
  });

  it('records who pointed what at where', async () => {
    if (!SLOT || !SOURCE) throw new Error('fixture slots are missing');

    await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SOURCE.contentPath }),
    );

    const event = await prisma.auditEvent.findFirst({
      where: { action: 'photo.assigned' },
      orderBy: { at: 'desc' },
    });
    expect(event?.summary).toContain(SOURCE.contentPath);
    expect(event?.actorLabel).toContain(staffUser.email);
  });

  it('refuses a path outside the image library', async () => {
    if (!SLOT) throw new Error('the gangtok hero slot is missing');

    const state = await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: '/etc/passwd' }),
    );

    expect(state.status).toBe('error');
    expect(await prisma.photoAsset.count()).toBe(0);
  });

  it('refuses a photo that has been deleted', async () => {
    if (!SLOT || !SOURCE) throw new Error('fixture slots are missing');
    await prisma.retiredPhoto.create({
      data: { contentPath: SOURCE.contentPath, retiredLabel: 'test', bytes: 1 },
    });

    const state = await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SOURCE.contentPath }),
    );

    expect(state.status).toBe('error');
    expect(await prisma.photoAsset.count()).toBe(0);
  });

  it('turns away anyone who is not an Admin', async () => {
    if (!SLOT || !SOURCE) throw new Error('fixture slots are missing');
    const revenue = await createTestStaff({ role: 'REVENUE' });
    mockState.cookieValue = revenue.token;

    const state = await assignPhoto(
      { status: 'idle' },
      form({ slotKey: SLOT.key, sourcePath: SOURCE.contentPath }),
    );

    expect(state.status).toBe('error');
    expect(await prisma.photoAsset.count()).toBe(0);
  });
});
