'use server';

import { constantTimeEqual } from '@/lib/admin-auth';
import { recordAudit } from '@/lib/audit';
import {
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE,
  createSession,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type LoginFormState = {
  status: 'idle' | 'error';
  message?: string;
};

// Long enough that a session cannot outlive the absolute cap in lib/auth.ts;
// the server decides when a session really ends, not the cookie.
const COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

async function startSession(userId: string, ip: string, userAgent: string | null) {
  const token = await createSession(userId, { ip, userAgent: userAgent ?? undefined });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function login(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const headerList = await headers();
  const ip = clientIp(headerList);

  if (isRateLimited(`admin-login:${ip}`)) {
    return { status: 'error', message: 'Too many attempts. Please try again in a minute.' };
  }

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { status: 'error', message: 'Enter your email and password.' };
  }

  // First run only: with no accounts at all, the ADMIN_PASSWORD this app was
  // deployed with creates the first Admin under the email being signed in
  // with. It can only ever fire against an empty table, so it is not a
  // standing back door — and once one account exists the branch is dead.
  if ((await prisma.user.count()) === 0) {
    const bootstrapPassword = process.env.ADMIN_PASSWORD;
    if (!bootstrapPassword || !constantTimeEqual(password, bootstrapPassword)) {
      return { status: 'error', message: 'Incorrect email or password.' };
    }

    const admin = await prisma.user.create({
      data: {
        email,
        name: 'Administrator',
        role: 'ADMIN',
        passwordHash: await hashPassword(password),
        // Set here rather than after the branch: the redirect below throws, so
        // the shared update at the end of this action is never reached and the
        // founding admin would read as having never signed in.
        lastLoginAt: new Date(),
      },
    });

    log.warn('auth.bootstrapped_first_admin', { user_id: admin.id });
    await recordAudit({
      user: admin,
      action: 'user.bootstrapped',
      entity: 'User',
      entityId: admin.id,
      summary: 'First administrator created from ADMIN_PASSWORD',
      ip,
    });

    await startSession(admin.id, ip, headerList.get('user-agent'));
    redirect('/admin/dashboard');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // One message for every failure: a different one for "no such account" tells
  // an attacker which emails are real.
  const failed = { status: 'error' as const, message: 'Incorrect email or password.' };

  if (!user || !user.active) {
    log.warn('auth.login_failed', { reason: user ? 'inactive' : 'unknown_user' });
    return failed;
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    log.warn('auth.login_failed', { reason: 'bad_password', user_id: user.id });
    return failed;
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  log.info('auth.login', { user_id: user.id, role: user.role });

  await startSession(user.id, ip, headerList.get('user-agent'));
  redirect('/admin/dashboard');
}

export type SetPasswordState = {
  status: 'idle' | 'error';
  message?: string;
};

// Used by the link an Admin gives a new member of staff. The token is the only
// proof of identity, so it is single-use: consumed the moment a password is set.
export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const headerList = await headers();
  const ip = clientIp(headerList);

  if (isRateLimited(`admin-setup:${ip}`)) {
    return { status: 'error', message: 'Too many attempts. Please try again in a minute.' };
  }

  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: 'error',
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password !== confirm) {
    return { status: 'error', message: 'Those passwords do not match.' };
  }

  const user = token ? await prisma.user.findUnique({ where: { setupToken: token } }) : null;
  if (!user || !user.active) {
    return { status: 'error', message: 'That setup link is no longer valid. Ask for a new one.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), setupToken: null },
  });

  log.info('auth.password_set', { user_id: user.id });

  await startSession(user.id, ip, headerList.get('user-agent'));
  redirect('/admin/dashboard');
}
