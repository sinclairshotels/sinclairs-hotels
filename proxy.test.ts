import { SESSION_COOKIE } from '@/lib/auth-shared';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PUBLIC_HOST = 'sinclairs-hotels-git-some-branch-sinclairs-hotels.vercel.app';
const STAFF_HOST = 'staff.sinclairshotels.com';

// The preview flag is read once when the module loads, so each case has to
// import a fresh copy under the environment it is describing.
async function proxyUnder(vercelEnv: string | undefined) {
  vi.resetModules();
  // stubEnv rather than assignment: setting process.env.VERCEL_ENV to
  // undefined would store the string "undefined", which is not the same as
  // the variable being absent — and absent is the case worth testing.
  vi.stubEnv('VERCEL_ENV', vercelEnv);
  return (await import('./proxy')).proxy;
}

function request(host: string, path: string, session?: string) {
  const headers = new Headers({ host });
  if (session) headers.set('cookie', `${SESSION_COOKIE}=${session}`);
  return new NextRequest(`https://${host}${path}`, { headers });
}

const rewrittenTo = (response: Response) => response.headers.get('x-middleware-rewrite');
const redirectedTo = (response: Response) => response.headers.get('location');
const passedThrough = (response: Response) => response.headers.has('x-middleware-next');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('proxy', () => {
  describe('on the live deployment', () => {
    it('behaves as though /admin does not exist on the public hostname', async () => {
      const proxy = await proxyUnder('production');
      const response = await proxy(request('sinclairshotels.com', '/admin/bookings'));

      expect(rewrittenTo(response)).toContain('/__not_found__');
    });

    it('hides /admin when VERCEL_ENV is not set at all', async () => {
      const proxy = await proxyUnder(undefined);
      const response = await proxy(request('sinclairshotels.com', '/admin/bookings'));

      expect(rewrittenTo(response)).toContain('/__not_found__');
    });
  });

  describe('on a preview deployment', () => {
    it('lets /admin through on the generated hostname, which can never be staff.*', async () => {
      const proxy = await proxyUnder('preview');
      const response = await proxy(request(PUBLIC_HOST, '/admin/bookings'));

      expect(rewrittenTo(response)).toBeNull();
      expect(redirectedTo(response)).toContain('/admin/login');
    });

    it('opens the path only — a visitor with no session still gets the sign-in page', async () => {
      const proxy = await proxyUnder('preview');
      const response = await proxy(request(PUBLIC_HOST, '/admin/rates'));

      expect(redirectedTo(response)).toContain('/admin/login');
    });

    it('serves a session-carrying request without redirecting it', async () => {
      const proxy = await proxyUnder('preview');
      const response = await proxy(request(PUBLIC_HOST, '/admin/rates', 'a-token'));

      expect(passedThrough(response)).toBe(true);
    });

    it('still serves the public site, because one deployment answers for both', async () => {
      const proxy = await proxyUnder('preview');
      const response = await proxy(request(PUBLIC_HOST, '/hotels'));

      expect(passedThrough(response)).toBe(true);
      expect(redirectedTo(response)).toBeNull();
    });
  });

  describe('on the staff hostname', () => {
    it('sends anything outside /admin to the dashboard', async () => {
      const proxy = await proxyUnder('production');
      const response = await proxy(request(STAFF_HOST, '/hotels'));

      expect(redirectedTo(response)).toContain('/admin/bookings');
    });

    it('lets the sign-in page through without a session', async () => {
      const proxy = await proxyUnder('production');
      const response = await proxy(request(STAFF_HOST, '/admin/login'));

      expect(passedThrough(response)).toBe(true);
    });

    it('redirects bare /admin to the default landing page', async () => {
      const proxy = await proxyUnder('production');
      const response = await proxy(request(STAFF_HOST, '/admin', 'a-token'));

      expect(redirectedTo(response)).toContain('/admin/bookings');
    });
  });
});
