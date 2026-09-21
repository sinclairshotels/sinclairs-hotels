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
    const staff = await createTestStaff({ role: 'RESERVATIONS', name: 'Desk Staff' });
    cookieState.token = staff.token;

    const session = await getSession();
    expect(session).toMatchObject({ id: staff.id, role: 'RESERVATIONS', name: 'Desk Staff' });
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

describe('role capabilities', () => {
  it('gives Admin everything the other roles have', () => {
    for (const role of ['REVENUE', 'RESERVATIONS', 'HOTEL', 'VIEWER'] as const) {
      for (const capability of ['rates:write', 'bookings:write', 'setup:write'] as const) {
        if (can({ role }, capability)) expect(can({ role: 'ADMIN' }, capability)).toBe(true);
      }
    }
  });

  it('keeps Revenue out of bookings and Reservations out of rates', () => {
    expect(can({ role: 'REVENUE' }, 'rates:write')).toBe(true);
    expect(can({ role: 'REVENUE' }, 'bookings:write')).toBe(false);
    expect(can({ role: 'RESERVATIONS' }, 'bookings:write')).toBe(true);
    expect(can({ role: 'RESERVATIONS' }, 'rates:write')).toBe(false);
  });

  it('lets a Hotel user work bookings but not rates', () => {
    expect(can({ role: 'HOTEL' }, 'bookings:write')).toBe(true);
    expect(can({ role: 'HOTEL' }, 'rates:write')).toBe(false);
  });

  it('gives Viewer no write capability at all', () => {
    for (const capability of [
      'rates:write',
      'bookings:write',
      'setup:write',
      'payments:refund',
      'users:manage',
    ] as const) {
      expect(can({ role: 'VIEWER' }, capability)).toBe(false);
    }
  });

  it('keeps refunds and user management to Admin alone', () => {
    for (const role of ['REVENUE', 'RESERVATIONS', 'HOTEL', 'VIEWER'] as const) {
      expect(can({ role }, 'payments:refund')).toBe(false);
      expect(can({ role }, 'users:manage')).toBe(false);
    }
  });
});

describe('hotel scoping', () => {
  it('treats no restriction as every property', () => {
    expect(canAccessHotel({ restrictedToHotels: null }, 'gangtok')).toBe(true);
    expect(hotelScopeFilter({ restrictedToHotels: null })).toEqual({});
  });

  it('restricts a scoped user to their own properties', () => {
    const user = { restrictedToHotels: ['gangtok', 'darjeeling'] };
    expect(canAccessHotel(user, 'gangtok')).toBe(true);
    expect(canAccessHotel(user, 'ooty')).toBe(false);
    expect(hotelScopeFilter(user)).toEqual({ hotelSlug: { in: ['gangtok', 'darjeeling'] } });
  });

  it('reads the hotels assigned to a user into their session', async () => {
    const staff = await createTestStaff({ role: 'HOTEL', hotels: ['ooty'] });
    cookieState.token = staff.token;

    const session = await getSession();
    expect(session?.restrictedToHotels).toEqual(['ooty']);
  });
});
