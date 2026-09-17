import { SESSION_COOKIE } from '@/lib/auth-shared';
import { type NextRequest, NextResponse } from 'next/server';

// A preview deployment answers on a generated *.vercel.app hostname, which can
// never start with `staff.` — so the hostname rule below would hide /admin on
// exactly the builds that exist to be reviewed. VERCEL_ENV is set by the
// platform at build time and reads `production` on the live deployment, so
// this can only ever open on a preview. It opens the *path* and nothing else:
// the session checks behind it are unchanged, and robots.txt already refuses
// every non-canonical host.
const previewAdminAccess = process.env.VERCEL_ENV === 'preview';

// The internal admin/voucher tool only exists on the staff.* hostname — on the
// public hostname it must behave as if /admin doesn't exist at all, and on the
// staff hostname nothing but /admin is reachable.
export async function proxy(request: NextRequest) {
  // request.nextUrl.hostname reflects the server's bind address in some
  // environments, not the domain actually requested — the raw Host header
  // (what Vercel's edge sets to the real custom domain) is the reliable source.
  const host = request.headers.get('host') ?? '';
  const isStaffHost = host.startsWith('staff.');
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');

  if (isAdminPath && !isStaffHost && !previewAdminAccess) {
    return NextResponse.rewrite(new URL('/__not_found__', request.url));
  }

  if (!isAdminPath) {
    // A preview serves both halves of the site from one deployment, so only
    // the staff hostname is admin-only.
    if (!isStaffHost) return NextResponse.next();
    return NextResponse.redirect(new URL('/admin/bookings', request.url));
  }

  if (request.nextUrl.pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  // Middleware runs on the edge and cannot reach Postgres, so this is only a
  // cheap gate: it turns a visitor with no session cookie around before the
  // app renders. Whether the cookie names a live, unexpired, still-permitted
  // session is decided in the dashboard layout and again in every action,
  // which are the real enforcement points.
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // Bare /admin (or /admin/) has no page of its own — only the subroutes below
  // it do — so send an authenticated visit there to the same default landing
  // spot as the non-admin-path redirect above, instead of a dead-end 404.
  if (request.nextUrl.pathname === '/admin' || request.nextUrl.pathname === '/admin/') {
    return NextResponse.redirect(new URL('/admin/bookings', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt)$).*)',
  ],
};
