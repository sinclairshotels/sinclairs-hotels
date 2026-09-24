// Who counts as a child, and who is carried free.
//
// The properties do not agree, and the printed policy is per property, so the
// two ages are HotelSettings columns rather than constants. What they decide is
// money: a four-year-old on the group default is free, a six-year-old pays the
// room's extra-child charge, and a thirteen-year-old pays the extra-adult one
// whichever box the guest ticked on the search form.
//
// Pure, so the rule can be tested without a database, and shared by the search
// form, the availability query and the booking transaction — three places that
// must agree about the same child.

export interface ChildPolicy {
  // Below this age, free. 5 means a four-year-old is free and a five-year-old
  // is not, which is how "free under 5" is read at a desk.
  freeUnder: number;
  // The last age that still counts as a child. Older is an adult.
  childMaxAge: number;
}

export const DEFAULT_CHILD_POLICY: ChildPolicy = { freeUnder: 5, childMaxAge: 12 };

// Old enough to be asked about at all. Seventeen is the last age a parent
// books as a child anywhere on this site.
export const MAX_CHILD_AGE_OFFERED = 17;

export interface GuestSplit {
  // Charged as adults: the adults the guest entered, plus any "child" older
  // than the property's child band.
  adults: number;
  // Charged as children.
  children: number;
  // Carried free, and taking no seat.
  free: number;
}

export function splitGuests(adults: number, childAges: number[], policy: ChildPolicy): GuestSplit {
  let extraAdults = 0;
  let children = 0;
  let free = 0;

  for (const age of childAges) {
    if (age < policy.freeUnder) free += 1;
    else if (age <= policy.childMaxAge) children += 1;
    else extraAdults += 1;
  }

  return { adults: adults + extraAdults, children, free };
}

// What the picker says next to the age boxes, in the property's own numbers
// rather than the group defaults.
export function childPolicyLines(policy: ChildPolicy): { free: string; child: string } {
  return {
    free: `Under ${policy.freeUnder} stays free`,
    child: `${policy.freeUnder}–${policy.childMaxAge} is charged as a child; ${policy.childMaxAge + 1} and over as an adult`,
  };
}

// A child's age is asked for one box at a time, and travels as "3,8". Anything
// that is not a number in range is dropped rather than guessed — the count of
// children is what the guest actually chose, so a missing age is treated as
// the oldest a child can be, which never under-charges.
export function parseChildAges(raw: string | undefined, children: number): number[] {
  const parsed = (raw ?? '')
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((age) => Number.isInteger(age) && age >= 0 && age <= MAX_CHILD_AGE_OFFERED);

  return Array.from({ length: children }, (_, i) => parsed[i] ?? MAX_CHILD_AGE_OFFERED);
}

export function formatChildAges(ages: number[]): string {
  return ages.join(',');
}
