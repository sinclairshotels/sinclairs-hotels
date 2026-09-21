import type { EventVenue, Hotel } from '@/content/types';

// Every count on the site goes through here so the home page, the hotel page
// and the weddings page cannot drift apart. A boardroom counts as an event
// space like any other room — `kind` only changes how it is labelled.
export function eventSpaceCount(hotel: Hotel): number {
  return hotel.eventSpaces?.venues.length ?? 0;
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
