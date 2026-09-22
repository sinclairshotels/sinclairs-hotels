import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ageSession, cleanupTestStaff, createTestStaff } from '../test-utils/auth';
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  can,
  canAccessHotel,
  getSession,
  hashPassword,
  hotelScopeFilter,
  revokeAllSessionsFor,
  verifyPassword,
} from './auth';
import { prisma } from './db';

const cookieState = vi.hoisted(() => ({ token: undefined as string | undefined }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'staff_session' && cookieState.token ? { value: cookieState.token } : undefined,
  }),
}));

beforeEach(async () => {
  cookieState.token = undefined;
  await cleanupTestStaff();
});

afterAll(async () => {
  await cleanupTestStaff();
  await prisma.$disconnect();
});

describe('password hashing', () => {
  it('round-trips a password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false);
  });

  it('salts, so the same password hashes differently every time', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });

  it('never matches an account that has not set a password', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('', null)).toBe(false);
  });

  it('rejects a malformed hash rather than throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$only$four$parts')).toBe(false);
  });

  it('stores its cost parameters, so old hashes stay verifiable', async () => {
    const hash = await hashPassword('parameterised');
    expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);
  });
});

describe('getSession', () => {
  it('returns the signed-in user', async () => {
    const staff = await createTestStaff({
      role: 'USER',
      sections: { bookings: 'EDIT' },
      name: 'Desk Staff',
    });
    cookieState.token = staff.token;

    const session = await getSession();
    expect(session).toMatchObject({ id: staff.id, role: 'USER', name: 'Desk Staff' });
  });

  it('returns nothing without a cookie, or with an unknown token', async () => {
    expect(await getSession()).toBeNull();
    cookieState.token = 'not-a-real-token';
    expect(await getSession()).toBeNull();
  });

  it('ends a session that has been idle past the timeout', async () => {
    const staff = await createTestStaff();
    cookieState.token = staff.token;
    await ageSession(staff.token, IDLE_TIMEOUT_MS / 60_000 + 1);

    expect(await getSession()).toBeNull();
  });

  it('keeps a session that is inside the idle window', async () => {
    const staff = await createTestStaff();
    cookieState.token = staff.token;
    await ageSession(staff.token, IDLE_TIMEOUT_MS / 60_000 - 5);

    expect(await getSession()).not.toBeNull();
  });

  it('revokes an expired session rather than just refusing it', async () => {
    const staff = await createTestStaff();
    cookieState.token = staff.token;
    await ageSession(staff.token, IDLE_TIMEOUT_MS / 60_000 + 1);
    await getSession();

    const sessions = await prisma.session.findMany({ where: { userId: staff.id } });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('ends a session older than the absolute cap however active it has been', async () => {
    const staff = await createTestStaff();
    cookieState.token = staff.token;
    await prisma.session.updateMany({
      where: { userId: staff.id },
      data: {
        createdAt: new Date(Date.now() - ABSOLUTE_TIMEOUT_MS - 60_000),
        lastSeenAt: new Date(),
      },
    });

    expect(await getSession()).toBeNull();
  });

  it('stops working the moment the account is deactivated', async () => {
    const staff = await createTestStaff();
    cookieState.token = staff.token;
    expect(await getSession()).not.toBeNull();

    await prisma.user.update({ where: { id: staff.id }, data: { active: false } });
    expect(await getSession()).toBeNull();
  });

  it('stops working when its sessions are revoked', async () => {
    const staff = await createTestStaff();
    cookieState.token = staff.token;
    await revokeAllSessionsFor(staff.id);

    expect(await getSession()).toBeNull();
  });

  it('stores only a hash of the token, never the token itself', async () => {
    const staff = await createTestStaff();
    const sessions = await prisma.session.findMany({ where: { userId: staff.id } });
    expect(sessions[0]?.tokenHash).not.toBe(staff.token);
    expect(sessions[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('section grants', () => {
  const user = (sections: Record<string, 'VIEW' | 'EDIT'>) =>
    ({ role: 'USER', grants: sections }) as Parameters<typeof can>[0];

  it('gives an Admin everything, including what cannot be granted', () => {
    const admin = { role: 'ADMIN', grants: {} } as Parameters<typeof can>[0];
    for (const capability of [
      'rates:write',
      'bookings:write',
      'payments:refund',
      'photos:manage',
      'users:manage',
      'tax:manage',
    ] as const) {
      expect(can(admin, capability)).toBe(true);
    }
  });

  it('denies a section the user holds no grant for', () => {
    expect(can(user({ bookings: 'EDIT' }), 'rates:read')).toBe(false);
    expect(can(user({ bookings: 'EDIT' }), 'bookings:read')).toBe(true);
  });

  it('lets View read but never write', () => {
    const viewer = user({ rates: 'VIEW', payments: 'VIEW' });
    expect(can(viewer, 'rates:read')).toBe(true);
    expect(can(viewer, 'rates:write')).toBe(false);
    expect(can(viewer, 'payments:read')).toBe(true);
    expect(can(viewer, 'payments:refund')).toBe(false);
  });

  it('lets Edit do both', () => {
    const editor = user({ rates: 'EDIT' });
    expect(can(editor, 'rates:read')).toBe(true);
    expect(can(editor, 'rates:write')).toBe(true);
  });

  // The whole point of two roles: Users, Tax and creating accounts are not
  // sections on the form, so no combination of ticks can reach them.
  it('keeps Users and Tax beyond any grant a User could hold', () => {
    const everything = user(
      Object.fromEntries(
        [
          'today',
          'bookings',
          'rates',
          'vouchers',
          'payments',
          'enquiries',
          'newsletter',
          'photos',
          'audit',
        ].map((section) => [section, 'EDIT' as const]),
      ),
    );
    expect(can(everything, 'users:manage')).toBe(false);
    expect(can(everything, 'tax:manage')).toBe(false);
    expect(can(everything, 'payments:refund')).toBe(true);
  });
});

describe('hotel scoping', () => {
  it('treats allProperties as every property, including ones added later', () => {
    const central = { role: 'USER' as const, allProperties: true, hotels: [] };
    expect(canAccessHotel(central, 'gangtok')).toBe(true);
    expect(canAccessHotel(central, 'a-hotel-that-does-not-exist-yet')).toBe(true);
    expect(hotelScopeFilter(central)).toEqual({});
  });

  it('restricts a scoped user to their own properties', () => {
    const user = {
      role: 'USER' as const,
      allProperties: false,
      hotels: ['gangtok', 'darjeeling'],
    };
    expect(canAccessHotel(user, 'gangtok')).toBe(true);
    expect(canAccessHotel(user, 'ooty')).toBe(false);
    expect(hotelScopeFilter(user)).toEqual({ hotelSlug: { in: ['gangtok', 'darjeeling'] } });
  });

  // An empty hotel list used to mean "everything", so losing the rows promoted
  // a scoped user rather than locking them out. It is now a column.
  it('gives a scoped user with no properties left nothing, not everything', () => {
    const stranded = { role: 'USER' as const, allProperties: false, hotels: [] };
    expect(canAccessHotel(stranded, 'gangtok')).toBe(false);
    expect(hotelScopeFilter(stranded)).toEqual({ hotelSlug: { in: [] } });
  });

  it('reads the hotels and grants assigned to a user into their session', async () => {
    const staff = await createTestStaff({
      role: 'USER',
      hotels: ['ooty'],
      sections: { bookings: 'EDIT', rates: 'VIEW' },
    });
    cookieState.token = staff.token;

    const session = await getSession();
    expect(session?.allProperties).toBe(false);
    expect(session?.hotels).toEqual(['ooty']);
    expect(session?.grants).toEqual({ bookings: 'EDIT', rates: 'VIEW' });
  });

  // An Admin changing someone's access must not have to sign them out: the
  // session row is untouched and the next request reads the new grants.
  it('picks up a grant change on the next request, without a new session', async () => {
    const staff = await createTestStaff({ role: 'USER', sections: { bookings: 'VIEW' } });
    cookieState.token = staff.token;
    expect(can((await getSession()) as never, 'bookings:write')).toBe(false);

    await prisma.userSectionGrant.updateMany({
      where: { userId: staff.id, section: 'bookings' },
      data: { level: 'EDIT' },
    });

    const after = await getSession();
    expect(after?.sessionId).toBeTruthy();
    expect(can(after as never, 'bookings:write')).toBe(true);
  });
});
