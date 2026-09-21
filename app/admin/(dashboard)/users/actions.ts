'use server';

import { randomBytes } from 'node:crypto';
import { hotels } from '@/content/hotels';
import { recordAudit } from '@/lib/audit';
import { authorize, revokeAllSessionsFor } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import type { UserRole } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

export type UserFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
  setupUrl?: string;
};

const ROLES = ['ADMIN', 'REVENUE', 'RESERVATIONS', 'HOTEL', 'VIEWER'] as const;

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  name: z.string().trim().min(2, 'Enter their name').max(120),
  role: z.enum(ROLES),
  hotelSlugs: z.preprocess(
    (val) => (Array.isArray(val) ? val : val === undefined || val === null ? [] : [val]),
    z.array(z.string().trim().max(60)).max(20),
  ),
});

function setupToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createUser(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const auth = await authorize('users:manage');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`users:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const parsed = userSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    hotelSlugs: formData.getAll('hotelSlugs'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  const knownSlugs = new Set(hotels.map((hotel) => hotel.slug));
  const slugs = d.hotelSlugs.filter((slug) => knownSlugs.has(slug));

  // A Hotel user with no restriction would see every property, which is the
  // opposite of what that role is for.
  if (d.role === 'HOTEL' && slugs.length === 0) {
    return {
      status: 'error',
      message: 'A Hotel user must be restricted to at least one property.',
    };
  }

  if (await prisma.user.findUnique({ where: { email: d.email } })) {
    return { status: 'error', message: 'Someone already has that email address.' };
  }

  const token = setupToken();
  const user = await prisma.user.create({
    data: {
      email: d.email,
      name: d.name,
      role: d.role as UserRole,
      // No password is set here: the account cannot be signed into until the
      // person follows their setup link and chooses one, so nobody — including
      // whoever created it — ever knows their password.
      setupToken: token,
      hotels: { create: slugs.map((hotelSlug) => ({ hotelSlug })) },
    },
  });

  log.info('user.created', { user_id: user.id, role: user.role, hotels: slugs.length });
  await recordAudit({
    user: auth.user,
    action: 'user.created',
    entity: 'User',
    entityId: user.id,
    summary: `${d.name} added as ${d.role}${slugs.length > 0 ? ` for ${slugs.join(', ')}` : ''}`,
    after: { email: d.email, role: d.role, hotels: slugs },
    ip,
  });

  revalidatePath('/admin/users');

  return {
    status: 'success',
    message: `${d.name} added. Send them the setup link below — it is shown once.`,
    setupUrl: `/admin/login/setup?token=${token}`,
  };
}

export type ToggleUserState = { status: 'idle' | 'success' | 'error'; message?: string };

export async function setUserActive(
  _prevState: ToggleUserState,
  formData: FormData,
): Promise<ToggleUserState> {
  const auth = await authorize('users:manage');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { status: 'error', message: 'That account no longer exists.' };

  // Locking yourself out is never the intent, and there would be nobody left
  // to undo it.
  if (user.id === auth.user.id && !active) {
    return { status: 'error', message: 'You cannot deactivate your own account.' };
  }

  await prisma.user.update({ where: { id }, data: { active } });
  // Deactivating has to end sessions already open, or the account keeps
  // working until its cookie happens to expire.
  if (!active) await revokeAllSessionsFor(id);

  await recordAudit({
    user: auth.user,
    action: active ? 'user.reactivated' : 'user.deactivated',
    entity: 'User',
    entityId: id,
    summary: `${user.name} ${active ? 'reactivated' : 'deactivated'}`,
    before: { active: user.active },
    after: { active },
    ip: clientIp(await headers()),
  });

  revalidatePath('/admin/users');
  return { status: 'success', message: `${user.name} ${active ? 'reactivated' : 'deactivated'}.` };
}
