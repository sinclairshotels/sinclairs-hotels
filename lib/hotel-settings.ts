import { type ChildPolicy, DEFAULT_CHILD_POLICY } from '@/lib/child-ages';
import { prisma } from '@/lib/db';

// Every property's child brackets in one read, for the search form — which
// carries the property selector, so it needs all of them rather than the one
// the page happens to be about. A property with no settings row yet answers
// with the group defaults, which is what the printed policy says anyway.
export async function childPolicies(): Promise<Record<string, ChildPolicy>> {
  const rows = await prisma.hotelSettings.findMany({
    select: { hotelSlug: true, childFreeUnder: true, childMaxAge: true },
  });

  return Object.fromEntries(
    rows.map((row) => [
      row.hotelSlug,
      { freeUnder: row.childFreeUnder, childMaxAge: row.childMaxAge },
    ]),
  );
}

export async function childPolicyFor(hotelSlug: string): Promise<ChildPolicy> {
  const row = await prisma.hotelSettings.findUnique({
    where: { hotelSlug },
    select: { childFreeUnder: true, childMaxAge: true },
  });
  return row
    ? { freeUnder: row.childFreeUnder, childMaxAge: row.childMaxAge }
    : DEFAULT_CHILD_POLICY;
}
