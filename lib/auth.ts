import {
  type ScryptOptions,
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { MIN_PASSWORD_LENGTH, SESSION_COOKIE } from '@/lib/auth-shared';
import { prisma } from '@/lib/db';
import {
  type AuthedUser,
  type Capability,
  can,
  canAccessHotel,
  hotelScopeFilter,
  isSection,
} from '@/lib/roles';
import type { User } from '@prisma/client';
import { cookies } from 'next/headers';

// promisify loses the overload that takes options, and the cost parameters
// have to travel with every call for an old hash to stay verifiable.
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

// scrypt from node:crypto rather than argon2/bcrypt: it is memory-hard, it is
// in the standard library, and this codebase does not add a native dependency
// for something it already has. The parameters are stored in the hash so they
// can be raised later without invalidating existing passwords.
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const SCRYPT_KEY_BYTES = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT_KEY_BYTES, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
  });

  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  // A user who has not set a password yet has no hash, and no password may
  // match — the account is reachable only through its setup link.
  if (!stored) return false;

  const [scheme, cost, blockSize, parallelism, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !cost || !blockSize || !parallelism || !salt || !key) return false;

  const expected = Buffer.from(key, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelism),
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

// Thirty minutes of inactivity ends a session; ten hours ends it regardless.
// The idle rule is the one that matters on a shared front-desk machine.
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_TIMEOUT_MS = 10 * 60 * 60 * 1000;

// Writing lastSeenAt on literally every request would mean a write per page
// view for no benefit; a minute of granularity is far finer than a 30-minute
// timeout needs.
const TOUCH_INTERVAL_MS = 60 * 1000;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  { ip, userAgent }: { ip?: string; userAgent?: string } = {},
): Promise<string> {
  const token = randomBytes(32).toString('base64url');

  // Only the hash is stored, so a leaked database does not hand over live
  // sessions the way storing the token itself would.
  await prisma.session.create({
    data: { tokenHash: tokenHash(token), userId, ip: ip ?? null, userAgent: userAgent ?? null },
  });

  return token;
}

export async function getSession(): Promise<AuthedUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { include: { hotels: true, grants: true } } },
  });

  if (!session || session.revokedAt) return null;

  const now = Date.now();
  const idleFor = now - session.lastSeenAt.getTime();
  const aliveFor = now - session.createdAt.getTime();

  if (idleFor > IDLE_TIMEOUT_MS || aliveFor > ABSOLUTE_TIMEOUT_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return null;
  }

  // Checked on every request, not just at sign-in, so disabling an account
  // ends its existing sessions rather than waiting for them to expire.
  if (!session.user.active) return null;

  if (idleFor > TOUCH_INTERVAL_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }

  // Read from the row on every request, never copied into the session at
  // sign-in: an Admin changing what someone may do takes effect on that
  // person's next page load, without them signing out and back in.
  const grants: AuthedUser['grants'] = {};
  for (const grant of session.user.grants) {
    if (isSection(grant.section)) grants[grant.section] = grant.level;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    grants,
    allProperties: session.user.allProperties,
    hotels: session.user.hotels.map((row) => row.hotelSlug),
    sessionId: session.id,
  };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: tokenHash(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Used when an account is disabled, its role changes, or its password is
// reset: anything that should not keep acting under the old terms.
export async function revokeAllSessionsFor(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

export type AuthResult = { ok: true; user: AuthedUser } | { ok: false; message: string };

// For server actions, which return form state rather than redirecting. Every
// admin action starts with one of these — an action without an authorize()
// call is the bug this shape is meant to make obvious in review.
export async function authorize(capability: Capability): Promise<AuthResult> {
  const user = await getSession();
  if (!user) return { ok: false, message: 'Your session has ended. Please sign in again.' };
  if (!can(user, capability)) {
    return { ok: false, message: 'You do not have permission to do that.' };
  }
  return { ok: true, user };
}

export async function authorizeHotel(
  capability: Capability,
  hotelSlug: string,
): Promise<AuthResult> {
  const result = await authorize(capability);
  if (!result.ok) return result;
  if (!canAccessHotel(result.user, hotelSlug)) {
    return { ok: false, message: 'That property is not one you have access to.' };
  }
  return result;
}

export function describeUser(user: Pick<User, 'name' | 'email'>): string {
  return `${user.name} <${user.email}>`;
}

export type { AuthedUser, Capability };
export { can, canAccessHotel, hotelScopeFilter };
export { SESSION_COOKIE, MIN_PASSWORD_LENGTH };
