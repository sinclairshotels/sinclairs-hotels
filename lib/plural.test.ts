import { describe, expect, it } from 'vitest';
import { counted, plural } from './plural';

describe('plural', () => {
  it('is singular at exactly one and plural everywhere else', () => {
    expect(plural(1, 'dining venue')).toBe('dining venue');
    expect(plural(0, 'dining venue')).toBe('dining venues');
    expect(plural(2, 'dining venue')).toBe('dining venues');
  });

  it('takes an irregular plural where -s will not do', () => {
    expect(plural(1, 'property', 'properties')).toBe('property');
    expect(plural(3, 'property', 'properties')).toBe('properties');
  });
});

describe('counted', () => {
  it('puts the number in front of the right form', () => {
    expect(counted(1, 'event space')).toBe('1 event space');
    expect(counted(4, 'event space')).toBe('4 event spaces');
  });
});
