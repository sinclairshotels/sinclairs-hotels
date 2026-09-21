import { DEFAULT_TAX_SLAB, type TaxSlab } from '@/lib/booking';
import { prisma } from '@/lib/db';

// The slab in force for a quote made now: the most recent setting whose
// effective date has arrived. A future-dated row is staff scheduling a change,
// not a change already in effect.
export async function currentTaxSlab(now: Date = new Date()): Promise<TaxSlab> {
  const setting = await prisma.taxSetting.findFirst({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (!setting) return DEFAULT_TAX_SLAB;

  return {
    threshold: setting.threshold.toNumber(),
    lowRate: setting.lowRate.toNumber(),
    highRate: setting.highRate.toNumber(),
  };
}
