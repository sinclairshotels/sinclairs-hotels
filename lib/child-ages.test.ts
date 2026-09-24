import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHILD_POLICY,
  MAX_CHILD_AGE_OFFERED,
  childPolicyLines,
  parseChildAges,
  splitGuests,
} from './child-ages';

describe('splitGuests', () => {
  const policy = DEFAULT_CHILD_POLICY;

  it('carries a child below the free age without charging or seating them', () => {
    expect(splitGuests(2, [4], policy)).toEqual({ adults: 2, children: 0, free: 1 });
  });

  it('charges the free age itself as a child', () => {
    expect(splitGuests(2, [5], policy)).toEqual({ adults: 2, children: 1, free: 0 });
  });

  it('charges a guest past the child band as an adult, whatever box was ticked', () => {
    expect(splitGuests(2, [13], policy)).toEqual({ adults: 3, children: 0, free: 0 });
    expect(splitGuests(2, [12], policy)).toEqual({ adults: 2, children: 1, free: 0 });
  });

  it('follows a property that sets its own ages', () => {
    const own = { freeUnder: 3, childMaxAge: 10 };
    expect(splitGuests(2, [2, 4, 11], own)).toEqual({ adults: 3, children: 1, free: 1 });
  });

  it('handles no children at all', () => {
    expect(splitGuests(2, [], policy)).toEqual({ adults: 2, children: 0, free: 0 });
  });
});

describe('parseChildAges', () => {
  it('reads the ages the picker sent', () => {
    expect(parseChildAges('3,8', 2)).toEqual([3, 8]);
  });

  // Never under-charge from a missing or junk age: the guest chose to bring a
  // child, so the fallback is the oldest a child can be.
  it('falls back to the oldest child age when one is missing', () => {
    expect(parseChildAges('3', 2)).toEqual([3, MAX_CHILD_AGE_OFFERED]);
    expect(parseChildAges(undefined, 1)).toEqual([MAX_CHILD_AGE_OFFERED]);
    expect(parseChildAges('nine,-2,99', 1)).toEqual([MAX_CHILD_AGE_OFFERED]);
  });

  it('ignores ages for children who are not coming', () => {
    expect(parseChildAges('3,8,10', 1)).toEqual([3]);
    expect(parseChildAges('3,8', 0)).toEqual([]);
  });
});

describe('childPolicyLines', () => {
  it('speaks the property’s own numbers', () => {
    const lines = childPolicyLines({ freeUnder: 6, childMaxAge: 11 });
    expect(lines.free).toBe('Under 6 stays free');
    expect(lines.child).toContain('6–11');
    expect(lines.child).toContain('12 and over');
  });
});
