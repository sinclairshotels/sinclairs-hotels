'use server';

import { recordAudit } from '@/lib/audit';
import { authorize } from '@/lib/auth';
import { parseDateOnly } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { taxSettingSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type TaxState = { status: 'idle' | 'success' | 'error'; message?: string };

export async function saveTaxSetting(_prev: TaxState, formData: FormData): Promise<TaxState> {
  // Admin only, not rates:write: a typo here re-prices every quote made after
  // it, which is a different kind of control from a room's nightly rate.
  const auth = await authorize('users:manage');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const ip = clientIp(await headers());
  if (isRateLimited(`tax:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const parsed = taxSettingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Please check the form.',
    };
  }

  const { threshold, lowRate, highRate, effectiveFrom } = parsed.data;
  const date = parseDateOnly(effectiveFrom);
  if (!date) return { status: 'error', message: 'Pick the date it takes effect.' };

  const before = await prisma.taxSetting.findFirst({ orderBy: { effectiveFrom: 'desc' } });

  // Percentages on the screen, fractions in the database — nobody types 0.05.
  const created = await prisma.taxSetting.create({
    data: { threshold, lowRate: lowRate / 100, highRate: highRate / 100, effectiveFrom: date },
  });

  await recordAudit({
    user: auth.user,
    action: 'tax.changed',
    entity: 'TaxSetting',
    entityId: created.id,
    summary: `${lowRate}% up to ₹${threshold.toLocaleString('en-IN')}, ${highRate}% above, from ${effectiveFrom}`,
    before: before
      ? {
          threshold: before.threshold.toNumber(),
          lowRate: before.lowRate.toNumber(),
          highRate: before.highRate.toNumber(),
          effectiveFrom: before.effectiveFrom.toISOString().slice(0, 10),
        }
      : null,
    after: { threshold, lowRate: lowRate / 100, highRate: highRate / 100, effectiveFrom },
    ip,
  });
  log.info('tax.changed', {
    threshold,
    low_rate: lowRate,
    high_rate: highRate,
    from: effectiveFrom,
  });

  revalidatePath('/admin/tax');

  return {
    status: 'success',
    message: `Saved. Quotes made from ${effectiveFrom} use ${lowRate}% up to ₹${threshold.toLocaleString('en-IN')} and ${highRate}% above. Bookings already taken are unchanged.`,
  };
}
