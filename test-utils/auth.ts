// Helpers for tests that need a signed-in member of staff.
//
// These create real User and Session rows and hand back the cookie value the
// browser would carry, so tests exercise the actual authorization path rather
// than a mocked-out one. A test that stubs `authorize()` proves only that it
// can stub `authorize()`; the thing worth testing is that a Reservations user
// really is refused when they try to edit a rate.

import { createSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { UserRole } from '@prisma/client';

export const TEST_USER_DOMAIN = 'vitest-staff.invalid';

export interface TestStaff {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  token: string;
}

export async function createTestStaff({
  role = 'ADMIN',
  hotels = [],
  active = true,
  name = 'Test Staff',
}: {
  role?: UserRole;
  hotels?: string[];
  active?: boolean;
  name?: string;
} = {}): Promise<TestStaff> {
  const email = `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}@${TEST_USER_DOMAIN}`;

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role,
      active,
      passwordHash: 'scrypt$16384$8$1$dGVzdA==$dGVzdA==',
      hotels: { create: hotels.map((hotelSlug) => ({ hotelSlug })) },
    },
  });

  return { id: user.id, email, name, role, token: await createSession(user.id) };
}

export async function cleanupTestStaff(): Promise<void> {
  // Sessions and hotel rows cascade from the user.
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_USER_DOMAIN } } });
}

// Backdates a session so the idle timeout has passed without a test having to
// wait thirty minutes for it.
export async function ageSession(token: string, minutesAgo: number): Promise<void> {
  const { createHash } = await import('node:crypto');
  await prisma.session.update({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    data: { lastSeenAt: new Date(Date.now() - minutesAgo * 60_000) },
  });
}

// A known Admin for the Playwright specs. They must not rely on the
// first-run bootstrap: that only fires against an empty User table, so a
// single leftover row from another suite would silently turn every e2e
// sign-in into a failed login.
export async function ensureE2EAdmin(email: string, password: string): Promise<void> {
  const { hashPassword } = await import('@/lib/auth');
  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, active: true, role: 'ADMIN' },
    create: { email, name: 'E2E Admin', role: 'ADMIN', passwordHash },
  });
}
