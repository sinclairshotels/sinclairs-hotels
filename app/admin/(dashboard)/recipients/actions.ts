'use server';

import { getHotelBySlug, hotels } from '@/content/hotels';
import { recordAudit } from '@/lib/audit';
import { authorize } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { notificationPage } from '@/lib/notification-emails';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { recipientSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type RecipientState = { status: 'idle' | 'success' | 'error'; message?: string };

// Admin-only, like the panel it serves: who gets told about a booking is a
// different decision from who may read one, which is why recipients are not
// one of the grantable sections.
async function guard() {
  const auth = await authorize('users:manage');
  if (!auth.ok) return { ok: false as const, message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`recipients:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { ok: false as const, message: 'Too many requests. Please try again in a minute.' };
  }
  return { ok: true as const, user: auth.user, ip };
}

// Every page that shows a panel, so a change on one is visible on all of them.
function refresh() {
  for (const path of [
    '/admin/bookings',
    '/admin/vouchers',
    '/admin/payments',
    '/admin/enquiries',
    '/admin/careers',
  ]) {
    revalidatePath(path);
  }
}

function describe(hotelSlug: string | null, kind: string, field: string) {
  const where = hotelSlug ? (getHotelBySlug(hotelSlug)?.name ?? hotelSlug) : 'central';
  return `${notificationPage(kind)?.label ?? kind} ${field} (${where})`;
}

export async function addRecipient(
  _prev: RecipientState,
  formData: FormData,
): Promise<RecipientState> {
  const parsed = recipientSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Please check the address.',
    };
  }

  const auth = await guard();
  if (!auth.ok) return { status: 'error', message: auth.message };

  const { kind, field, address } = parsed.data;
  // An unknown slug becomes the central list rather than being stored against
  // a property that does not exist, where nothing would ever read it.
  const hotelSlug =
    parsed.data.hotelSlug && hotels.some((h) => h.slug === parsed.data.hotelSlug)
      ? parsed.data.hotelSlug
      : null;

  const existing = await prisma.notificationEmail.findFirst({
    where: { hotelSlug, kind, field, address },
  });
  if (existing) return { status: 'success', message: 'Already on the list.' };

  const row = await prisma.notificationEmail.create({
    data: { hotelSlug, kind, field, address },
  });

  await recordAudit({
    user: auth.user,
    action: 'recipients.added',
    entity: 'NotificationEmail',
    entityId: row.id,
    hotelSlug,
    summary: `Added an address to ${describe(hotelSlug, kind, field)}`,
    before: null,
    // The address itself is the change, and the audit log is staff-only — but
    // it is still somebody's inbox, so it is recorded here and never logged.
    after: { address },
    ip: auth.ip,
  });
  log.info('recipients.added', { kind, field, hotel: hotelSlug });

  refresh();
  return { status: 'success', message: 'Added.' };
}

export async function removeRecipient(
  _prev: RecipientState,
  formData: FormData,
): Promise<RecipientState> {
  const auth = await guard();
  if (!auth.ok) return { status: 'error', message: auth.message };

  const id = String(formData.get('id') ?? '');
  const row = await prisma.notificationEmail.findUnique({ where: { id } });
  if (!row) return { status: 'error', message: 'That address is already gone.' };

  await prisma.notificationEmail.delete({ where: { id } });

  await recordAudit({
    user: auth.user,
    action: 'recipients.removed',
    entity: 'NotificationEmail',
    entityId: id,
    hotelSlug: row.hotelSlug,
    summary: `Removed an address from ${describe(row.hotelSlug, row.kind, row.field)}`,
    before: { address: row.address },
    after: null,
    ip: auth.ip,
  });
  log.info('recipients.removed', { kind: row.kind, field: row.field, hotel: row.hotelSlug });

  refresh();
  return { status: 'success', message: 'Removed.' };
}
