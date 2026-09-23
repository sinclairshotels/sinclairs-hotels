import { hotels } from '@/content/hotels';
import { describe, expect, it } from 'vitest';
import { stayWindowLine } from './stay-window';

describe('stayWindowLine', () => {
  it('reads the property its own times', () => {
    expect(stayWindowLine('gangtok')).toBe('Check-in 2 pm · Check-out 12 noon');
    expect(stayWindowLine('dooars')).toBe('Check-in 12 noon · Check-out 10 am');
  });

  it('is null for a property with no published times', () => {
    expect(stayWindowLine('not-a-hotel')).toBeNull();
  });

  it('covers every property the site sells', () => {
    for (const hotel of hotels) {
      expect(stayWindowLine(hotel.slug), hotel.slug).not.toBeNull();
    }
  });
});
