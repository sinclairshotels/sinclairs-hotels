import type { EventVenue, Hotel } from '@/content/types';

// A boardroom is a meeting room, not an event space: it belongs in the venue
// list a planner reads, but never in a property's "Event Spaces" headline
// figure. Every screen that shows a count goes through here so the number on
// the home page, the hotel page and the weddings page can't drift apart.
export function eventSpaces(hotel: Hotel): EventVenue[] {
  return (hotel.eventSpaces?.venues ?? []).filter((venue) => venue.kind !== 'boardroom');
}

export function eventSpaceCount(hotel: Hotel): number {
  return eventSpaces(hotel).length;
}

export function totalEventSpaces(list: readonly Hotel[]): number {
  return list.reduce((sum, hotel) => sum + eventSpaceCount(hotel), 0);
}

export interface HotelVenues {
  hotel: Hotel;
  venues: EventVenue[];
}

// Every venue at every property, largest room first within each hotel, for the
// one place that shows them all together.
export function venuesByHotel(list: readonly Hotel[]): HotelVenues[] {
  return list
    .filter((hotel) => (hotel.eventSpaces?.venues.length ?? 0) > 0)
    .map((hotel) => ({
      hotel,
      venues: [...(hotel.eventSpaces?.venues ?? [])].sort((a, b) => b.capacity - a.capacity),
    }));
}
