'use server';

import { SESSION_COOKIE, revokeSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  // Revoked server-side as well as cleared from the browser, so a copied
  // cookie stops working too.
  await revokeSession(cookieStore.get(SESSION_COOKIE)?.value);
  cookieStore.delete(SESSION_COOKIE);
  redirect('/admin/login');
}
