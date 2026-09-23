'use server';

import { getHotelBySlug, hotels } from '@/content/hotels';
import { recordAudit } from '@/lib/audit';
import { authorize } from '@/lib/auth';
import {
  CareersStorageUnconfigured,
  careersStorageConfigured,
  checkDocument,
  putDocument,
} from '@/lib/careers-storage';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { jobPositionSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type CareersState = { status: 'idle' | 'success' | 'error'; message?: string };

async function guard() {
  const auth = await authorize('careers:write');
  if (!auth.ok) return { ok: false as const, message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`careers-admin:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { ok: false as const, message: 'Too many requests. Please try again in a minute.' };
  }
  return { ok: true as const, user: auth.user, ip };
}

function refresh() {
  revalidatePath('/admin/careers');
  // The public page is revalidate = 300, but publishing a role is the one edit
  // nobody wants to wait five minutes to see.
  revalidatePath('/careers');
}

export async function savePosition(_prev: CareersState, formData: FormData): Promise<CareersState> {
  const auth = await guard();
  if (!auth.ok) return { status: 'error', message: auth.message };

  const parsed = jobPositionSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    hotelSlug: formData.get('hotelSlug'),
    department: formData.get('department'),
    descriptionText: formData.get('descriptionText'),
    open: formData.get('open'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Please check the fields.',
    };
  }

  const { id, title, department, descriptionText, open } = parsed.data;
  // An unknown slug becomes "across the group" rather than being stored and
  // silently matching no property on the public page.
  const hotelSlug =
    parsed.data.hotelSlug && hotels.some((h) => h.slug === parsed.data.hotelSlug)
      ? parsed.data.hotelSlug
      : null;

  const file = formData.get('jd');
  let jd: { url: string; fileName: string } | null = null;
  if (file instanceof File && file.size > 0) {
    const check = checkDocument({ name: file.name, size: file.size, type: file.type });
    if (!check.ok) return { status: 'error', message: check.message };
    if (!careersStorageConfigured()) {
      return { status: 'error', message: 'Uploading a JD needs BLOB_READ_WRITE_TOKEN.' };
    }
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const stored = await putDocument('jd', bytes, file.name, file.type);
      jd = { url: stored.url, fileName: file.name };
    } catch (error) {
      if (error instanceof CareersStorageUnconfigured) {
        return { status: 'error', message: 'Uploading a JD needs BLOB_READ_WRITE_TOKEN.' };
      }
      throw error;
    }
  }

  const before = id ? await prisma.jobPosition.findUnique({ where: { id } }) : null;
  if (id && !before) return { status: 'error', message: 'That position no longer exists.' };

  const data = {
    title,
    hotelSlug,
    department,
    descriptionText: descriptionText || null,
    open,
    // A save without a new file keeps the one already attached — re-uploading
    // the JD to change the title would be a silly thing to require.
    ...(jd ? { jdUrl: jd.url, jdFileName: jd.fileName } : {}),
  };

  const position = before
    ? await prisma.jobPosition.update({ where: { id: before.id }, data })
    : await prisma.jobPosition.create({ data });

  const where = hotelSlug ? (getHotelBySlug(hotelSlug)?.name ?? hotelSlug) : 'across the group';
  await recordAudit({
    user: auth.user,
    action: before ? 'careers.position_updated' : 'careers.position_created',
    entity: 'JobPosition',
    entityId: position.id,
    hotelSlug,
    summary: `${title} (${where}) — ${open ? 'open, live on the site' : 'closed'}`,
    before: before
      ? { title: before.title, department: before.department, open: before.open }
      : null,
    after: { title, department, open },
    ip: auth.ip,
  });
  log.info(before ? 'careers.position_updated' : 'careers.position_created', {
    position_id: position.id,
    hotel: hotelSlug,
    open,
  });

  refresh();
  return {
    status: 'success',
    message: open
      ? `Saved. “${title}” is live on the careers page.`
      : `Saved. “${title}” is closed and not shown on the site.`,
  };
}

// Open and closed rather than deleted: applications point at the position, and
// removing it would leave people in the list attached to nothing.
export async function setPositionOpen(
  _prev: CareersState,
  formData: FormData,
): Promise<CareersState> {
  const auth = await guard();
  if (!auth.ok) return { status: 'error', message: auth.message };

  const id = String(formData.get('id') ?? '');
  const open = formData.get('open') === 'true';

  const before = await prisma.jobPosition.findUnique({ where: { id } });
  if (!before) return { status: 'error', message: 'That position no longer exists.' };
  if (before.open === open) return { status: 'success', message: 'Nothing changed.' };

  await prisma.jobPosition.update({ where: { id }, data: { open } });

  await recordAudit({
    user: auth.user,
    action: open ? 'careers.position_opened' : 'careers.position_closed',
    entity: 'JobPosition',
    entityId: id,
    hotelSlug: before.hotelSlug,
    summary: `${before.title} ${open ? 'opened — now live on the site' : 'closed — removed from the site'}`,
    before: { open: before.open },
    after: { open },
    ip: auth.ip,
  });
  log.info('careers.position_open_changed', { position_id: id, open });

  refresh();
  return {
    status: 'success',
    message: open ? `“${before.title}” is live.` : `“${before.title}” is off the site.`,
  };
}
