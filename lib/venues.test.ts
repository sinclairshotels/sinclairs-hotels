import { getHotelBySlug, hotels } from '@/content/hotels';
import { eventSpaceCount, totalEventSpaces, venuesByHotel } from '@/lib/venues';
import { describe, expect, it } from 'vitest';

describe('event space counts', () => {
  it('counts a boardroom as one of the property’s event spaces', () => {
    const gangtok = getHotelBySlug('gangtok');
    if (!gangtok) throw new Error('gangtok is missing');

    expect(eventSpaceCount(gangtok)).toBe(2);
    expect(gangtok.eventSpaces?.venues.map((v) => v.name)).toEqual([
      'The Cherry Hall',
      'Jasmine Boardroom',
    ]);
  });

  it('adds up to the same figure the home page and the weddings page show', () => {
    const summed = hotels.reduce((total, hotel) => total + eventSpaceCount(hotel), 0);
    expect(totalEventSpaces(hotels)).toBe(summed);
  });

  it('lists a property’s venues largest first', () => {
    const groups = venuesByHotel(hotels);
    for (const { venues } of groups) {
      const capacities = venues.map((venue) => venue.capacity);
      expect(capacities).toEqual([...capacities].sort((a, b) => b - a));
    }
  });
});
