'use server';

import { recordAudit } from '@/lib/audit';
import { authorize } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import {
  MAX_PUBLIC_BYTES,
  MAX_SINGLE_FILE_BYTES,
  fileInfo,
  formatBytes,
  publicImageBytes,
} from '@/lib/photo-files';
import { type LibraryPhoto, photoLibrary } from '@/lib/photo-library';
import { claimedPaths, slotByKey } from '@/lib/photo-slots';
import { retiredPaths } from '@/lib/photos';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import sharp from 'sharp';

export type PhotoState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  // Which slot the message belongs to, so one shared form state can render
  // against the row the person actually used.
  slotKey?: string;
};

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Refused before the bytes are decoded. The output ceiling is the real limit;
// this only stops a file large enough to be a problem to hold in memory at all.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Matches the conversion CLAUDE.md prescribes for committed images, so a photo
// replaced here and one converted by hand land in the same place.
const WEBP_QUALITY = 82;

export async function replacePhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const auth = await authorize('photos:manage');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const slotKey = String(formData.get('slotKey') ?? '');
  const fail = (message: string): PhotoState => ({ status: 'error', message, slotKey });

  const ip = clientIp(await headers());
  if (isRateLimited(`photos:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return fail('Too many uploads. Please try again in a minute.');
  }

  const slot = slotByKey(slotKey);
  if (!slot) return fail('That photo position no longer exists. Reload the page.');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Choose a photo to upload.');
  if (!ACCEPTED.has(file.type)) return fail('Upload a JPG, PNG or WebP.');
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(`That file is ${formatBytes(file.size)} — upload something under 25 MB.`);
  }

  let webp: Buffer;
  let width: number;
  let height: number;
  try {
    // withoutEnlargement: resizing a 900px photo up to 3840 adds bytes and no
    // detail, and reads as soft on exactly the screens the width is for.
    const pipeline = sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: slot.targetWidth, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 6 });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    webp = data;
    width = info.width;
    height = info.height;
  } catch {
    return fail('That file could not be read as an image.');
  }

  if (webp.byteLength > MAX_SINGLE_FILE_BYTES) {
    return fail(
      `Converted it comes to ${formatBytes(webp.byteLength)}, over the ${formatBytes(MAX_SINGLE_FILE_BYTES)} limit for one image. Crop it or start from a smaller original.`,
    );
  }

  const existing = await prisma.photoAsset.findFirst({
    where: { slotKey: slot.key, supersededAt: null },
    select: { id: true, bytes: true, width: true, height: true, originalName: true },
  });

  // The same ceiling the build check applies to public/, counted across both
  // homes: a replacement that fits on screen but pushes the deployment past its
  // budget would fail the next build instead of this upload.
  const [publicBytes, overrideBytes] = await Promise.all([
    publicImageBytes(),
    prisma.photoAsset.aggregate({ _sum: { bytes: true }, where: { supersededAt: null } }),
  ]);
  const replacing = existing?.bytes ?? 0;
  const projected = publicBytes + (overrideBytes._sum.bytes ?? 0) - replacing + webp.byteLength;
  if (projected > MAX_PUBLIC_BYTES) {
    return fail(
      `That would put the site's images at ${formatBytes(projected)}, over the ${formatBytes(MAX_PUBLIC_BYTES)} budget.`,
    );
  }

  const original = await fileInfo(slot.contentPath);

  const created = await prisma.$transaction(async (tx) => {
    if (existing) {
      // Kept, not deleted: PHOTO_RETENTION_DAYS is what makes a wrong photo
      // recoverable, and `pnpm photos:prune` is what eventually clears it.
      await tx.photoAsset.update({
        where: { id: existing.id },
        data: { supersededAt: new Date() },
      });
    }
    return tx.photoAsset.create({
      data: {
        contentPath: slot.contentPath,
        slotKey: slot.key,
        data: new Uint8Array(webp),
        width,
        height,
        bytes: webp.byteLength,
        originalName: file.name,
        uploadedLabel: `${auth.user.name} <${auth.user.email}>`,
      },
      select: { id: true },
    });
  });

  await recordAudit({
    user: auth.user,
    action: 'photo.replaced',
    entity: 'PhotoAsset',
    entityId: created.id,
    hotelSlug: slot.hotelSlug ?? null,
    summary: `${slot.label} on ${slot.contentPath} — ${width}×${height}, ${formatBytes(webp.byteLength)}`,
    before: existing
      ? { source: 'upload', width: existing.width, height: existing.height, bytes: existing.bytes }
      : original
        ? { source: 'repository', ...original }
        : null,
    after: { width, height, bytes: webp.byteLength, originalName: file.name },
    ip,
  });

  log.info('photo.replaced', {
    slot: slot.key,
    path: slot.contentPath,
    width,
    height,
    bytes: webp.byteLength,
  });

  revalidatePath('/admin/photos');
  revalidatePath('/', 'layout');

  return {
    status: 'success',
    slotKey,
    message: `Replaced — ${width}×${height}, ${formatBytes(webp.byteLength)}.`,
  };
}

export async function retirePhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const auth = await authorize('photos:manage');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const contentPath = String(formData.get('contentPath') ?? '');
  const fail = (message: string): PhotoState => ({
    status: 'error',
    message,
    slotKey: contentPath,
  });

  const ip = clientIp(await headers());
  if (isRateLimited(`photos:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return fail('Too many requests. Please try again in a minute.');
  }

  // Checked here and not only in the UI: a page that renders this file may have
  // been added since the button was drawn, and deleting it would break that page.
  if (claimedPaths().has(contentPath)) {
    return fail('A page uses this photo now, so it cannot be deleted.');
  }

  const info = await fileInfo(contentPath);
  if (!info) return fail('That file is no longer in the repository.');

  const retired = await prisma.retiredPhoto.upsert({
    where: { contentPath },
    update: { retiredAt: new Date(), retiredLabel: `${auth.user.name} <${auth.user.email}>` },
    create: {
      contentPath,
      retiredLabel: `${auth.user.name} <${auth.user.email}>`,
      bytes: info.bytes,
    },
    select: { id: true },
  });

  await recordAudit({
    user: auth.user,
    action: 'photo.retired',
    entity: 'RetiredPhoto',
    entityId: retired.id,
    summary: `${contentPath} — ${formatBytes(info.bytes)}`,
    before: { ...info },
    after: null,
    ip,
  });

  log.info('photo.retired', { path: contentPath, bytes: info.bytes });
  revalidatePath('/admin/photos');

  return { status: 'success', slotKey: contentPath, message: 'Deleted.' };
}

// Loaded when the picker is first opened rather than shipped with the page:
// every file on the site is a long list, and most visits never open it.
export async function loadPhotoLibrary(): Promise<LibraryPhoto[]> {
  const auth = await authorize('photos:manage');
  if (!auth.ok) return [];
  return photoLibrary();
}

// Point a position at a photo that is already in the repository. Nothing is
// copied — the slot simply renders that file's own URL — so this costs no
// bytes and needs no budget check.
export async function assignPhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const auth = await authorize('photos:manage');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const slotKey = String(formData.get('slotKey') ?? '');
  const sourcePath = String(formData.get('sourcePath') ?? '');
  const fail = (message: string): PhotoState => ({ status: 'error', message, slotKey });

  const ip = clientIp(await headers());
  if (isRateLimited(`photos:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return fail('Too many changes. Please try again in a minute.');
  }

  const slot = slotByKey(slotKey);
  if (!slot) return fail('That photo position no longer exists. Reload the page.');

  if (!sourcePath.startsWith('/images/')) return fail('Choose a photo from the library.');
  const source = await fileInfo(sourcePath);
  if (!source) return fail('That photo is no longer in the repository.');
  if ((await retiredPaths()).has(sourcePath)) return fail('That photo has been deleted.');

  const existing = await prisma.photoAsset.findFirst({
    where: { slotKey: slot.key, supersededAt: null },
    select: { id: true, sourcePath: true, originalName: true },
  });

  // Choosing the position's own photo is how it is put back, so it clears the
  // override rather than recording one that changes nothing.
  if (sourcePath === slot.contentPath) {
    if (!existing) return { status: 'success', slotKey, message: 'Already the original photo.' };
    await prisma.photoAsset.update({
      where: { id: existing.id },
      data: { supersededAt: new Date() },
    });
    await recordAudit({
      user: auth.user,
      action: 'photo.restored',
      entity: 'PhotoAsset',
      entityId: existing.id,
      hotelSlug: slot.hotelSlug ?? null,
      summary: `${slot.label} back to ${slot.contentPath}`,
      before: { source: existing.sourcePath ?? existing.originalName },
      after: null,
      ip,
    });
    revalidatePath('/admin/photos');
    revalidatePath('/', 'layout');
    return { status: 'success', slotKey, message: 'Back to the original photo.' };
  }

  const fileName = sourcePath.slice(sourcePath.lastIndexOf('/') + 1);

  const created = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.photoAsset.update({
        where: { id: existing.id },
        data: { supersededAt: new Date() },
      });
    }
    return tx.photoAsset.create({
      data: {
        contentPath: slot.contentPath,
        slotKey: slot.key,
        sourcePath,
        width: source.width,
        height: source.height,
        bytes: source.bytes,
        originalName: fileName,
        uploadedLabel: `${auth.user.name} <${auth.user.email}>`,
      },
      select: { id: true },
    });
  });

  await recordAudit({
    user: auth.user,
    action: 'photo.assigned',
    entity: 'PhotoAsset',
    entityId: created.id,
    hotelSlug: slot.hotelSlug ?? null,
    summary: `${slot.label} now uses ${sourcePath}`,
    before: { contentPath: slot.contentPath },
    after: { sourcePath, width: source.width, height: source.height },
    ip,
  });

  log.info('photo.assigned', { slot: slot.key, path: slot.contentPath, source: sourcePath });

  revalidatePath('/admin/photos');
  revalidatePath('/', 'layout');

  return { status: 'success', slotKey, message: `Now using ${fileName}.` };
}
