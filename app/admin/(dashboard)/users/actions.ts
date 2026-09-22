'use server';

import { randomBytes } from 'node:crypto';
import { hotels } from '@/content/hotels';
import { recordAudit } from '@/lib/audit';
import { authorize, revokeAllSessionsFor } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { SECTIONS, type Section, isSection } from '@/lib/roles';
import type { SectionLevel } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

export type UserFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
  setupUrl?: string;
};

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  name: z.string().trim().min(2, 'Enter their name').max(120),
  role: z.enum(['ADMIN', 'USER']),
  allProperties: z.preprocess((v) => v === 'on' || v === 'true', z.boolean()),
  hotelSlugs: z.preprocess(
    (val) => (Array.isArray(val) ? val : val === undefined || val === null ? [] : [val]),
    z.array(z.string().trim().max(60)).max(50),
  ),
});

// The form posts one value per section: 'none', 'VIEW' or 'EDIT'. Reading it
// back this way rather than as a list of checkboxes means an unticked section
// is an explicit 'none' — a checkbox that is simply absent from the payload
// cannot be told apart from a field the browser never rendered, and on an edit
// that difference is the whole question.
function readGrants(formData: FormData): Map<Section, SectionLevel> {
  const grants = new Map<Section, SectionLevel>();
  for (const section of SECTIONS) {
    const value = String(formData.get(`section:${section}`) ?? 'none');
    if (value === 'VIEW' || value === 'EDIT') grants.set(section, value);
  }
  return grants;
}

function describeGrants(grants: Map<Section, SectionLevel>): string {
  if (grants.size === 0) return 'no sections';
  return [...grants.entries()].map(([section, level]) => `${section}:${level}`).join(', ');
}

function describeScope(allProperties: boolean, slugs: string[]): string {
  return allProperties ? 'all properties' : slugs.join(', ') || 'no properties';
}

function setupToken(): string {
  return randomBytes(32).toString('base64url');
}

function knownSlugs(input: string[]): string[] {
  const known = new Set(hotels.map((hotel) => hotel.slug));
  return input.filter((slug) => known.has(slug));
}

// Shared by create and update: a User who can reach nothing, or is scoped to
// nothing, has an account that cannot do anything. That is a mistake every
// time, and silently saving it wastes someone's afternoon working out why the
// admin is empty for them.
function validateUser(
  role: 'ADMIN' | 'USER',
  grants: Map<Section, SectionLevel>,
  allProperties: boolean,
  slugs: string[],
): string | null {
  if (role === 'ADMIN') return null;
  if (grants.size === 0) return 'Tick at least one section, or make them an Admin.';
  if (!allProperties && slugs.length === 0) {
    return 'Choose All properties, or tick at least one property.';
  }
  return null;
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
  const slugs = knownSlugs(d.hotelSlugs);
  const grants = d.role === 'ADMIN' ? new Map<Section, SectionLevel>() : readGrants(formData);
  const allProperties = d.role === 'ADMIN' ? true : d.allProperties;

  const invalid = validateUser(d.role, grants, allProperties, slugs);
  if (invalid) return { status: 'error', message: invalid };

  if (await prisma.user.findUnique({ where: { email: d.email } })) {
    return { status: 'error', message: 'Someone already has that email address.' };
  }

  const token = setupToken();
  const user = await prisma.user.create({
    data: {
      email: d.email,
      name: d.name,
      role: d.role,
      allProperties,
      // No password is set here: the account cannot be signed into until the
      // person follows their setup link and chooses one, so nobody — including
      // whoever created it — ever knows their password.
      setupToken: token,
      hotels: { create: allProperties ? [] : slugs.map((hotelSlug) => ({ hotelSlug })) },
      grants: {
        create: [...grants.entries()].map(([section, level]) => ({ section, level })),
      },
    },
  });

  log.info('user.created', { user_id: user.id, role: user.role, sections: grants.size });
  await recordAudit({
    user: auth.user,
    action: 'user.created',
    entity: 'User',
    entityId: user.id,
    summary: `${d.name} added as ${d.role === 'ADMIN' ? 'Admin' : 'User'} — ${describeGrants(
      grants,
    )}; ${describeScope(allProperties, slugs)}`,
    after: {
      email: d.email,
      role: d.role,
      sections: Object.fromEntries(grants),
      allProperties,
      hotels: slugs,
    },
    ip,
  });

  revalidatePath('/admin/users');

  return {
    status: 'success',
    message: `${d.name} added. Send them the setup link below — it is shown once.`,
    setupUrl: `/admin/login/setup?token=${token}`,
  };
}

export async function updateUser(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const auth = await authorize('users:manage');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`users:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const id = String(formData.get('id') ?? '');
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { hotels: true, grants: true },
  });
  if (!existing) return { status: 'error', message: 'That account no longer exists.' };

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
  const slugs = knownSlugs(d.hotelSlugs);
  const grants = d.role === 'ADMIN' ? new Map<Section, SectionLevel>() : readGrants(formData);
  const allProperties = d.role === 'ADMIN' ? true : d.allProperties;

  const invalid = validateUser(d.role, grants, allProperties, slugs);
  if (invalid) return { status: 'error', message: invalid };

  // Demoting the last Admin leaves nobody who can promote anyone, and the
  // bootstrap only fires against an empty table — so there would be no way
  // back in short of editing the database by hand.
  if (existing.role === 'ADMIN' && d.role !== 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
    if (admins <= 1) {
      return {
        status: 'error',
        message: 'This is the only Admin. Make someone else an Admin first.',
      };
    }
  }

  if (d.email !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email: d.email } });
    if (clash && clash.id !== id) {
      return { status: 'error', message: 'Someone already has that email address.' };
    }
  }

  const before = {
    email: existing.email,
    role: existing.role,
    sections: Object.fromEntries(
      existing.grants.filter((g) => isSection(g.section)).map((g) => [g.section, g.level]),
    ),
    allProperties: existing.allProperties,
    hotels: existing.hotels.map((h) => h.hotelSlug),
  };

  // Replace rather than diff: the form posts the complete intended state for
  // every section and every property, so reconciling row by row would be more
  // code for the same result.
  await prisma.$transaction([
    prisma.userSectionGrant.deleteMany({ where: { userId: id } }),
    prisma.userHotel.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: {
        email: d.email,
        name: d.name,
        role: d.role,
        allProperties,
        hotels: { create: allProperties ? [] : slugs.map((hotelSlug) => ({ hotelSlug })) },
        grants: {
          create: [...grants.entries()].map(([section, level]) => ({ section, level })),
        },
      },
    }),
  ]);

  // Deliberately no session revocation. getSession() reads role, grants and
  // properties from these rows on every request, so the change takes effect on
  // this person's next page load without signing them out mid-task. Only
  // deactivation ends a session, because that is ending access rather than
  // changing it.
  log.info('user.updated', { user_id: id, role: d.role, sections: grants.size });
  await recordAudit({
    user: auth.user,
    action: 'user.updated',
    entity: 'User',
    entityId: id,
    summary: `${d.name} set to ${d.role === 'ADMIN' ? 'Admin' : 'User'} — ${describeGrants(
      grants,
    )}; ${describeScope(allProperties, slugs)}`,
    before,
    after: {
      email: d.email,
      role: d.role,
      sections: Object.fromEntries(grants),
      allProperties,
      hotels: slugs,
    },
    ip,
  });

  revalidatePath('/admin/users');
  return { status: 'success', message: `${d.name} updated. It applies on their next page load.` };
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

  if (!active && user.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
    if (admins <= 1) {
      return { status: 'error', message: 'This is the only active Admin.' };
    }
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
