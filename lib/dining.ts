import type { GalleryImage, Hotel } from '@/content/types';

export interface HotelDiningPhoto {
  hotel: Hotel;
  photo: GalleryImage;
  venueNames: string[];
}

function firstPhoto(hotel: Hotel): GalleryImage | undefined {
  const plated = hotel.foodGallery?.[0];
  if (plated) return plated;

  for (const venue of hotel.dining) {
    const src = venue.images?.[0];
    if (src) return { src, alt: `${venue.name} at ${hotel.name}` };
  }
  return undefined;
}

// One photo per property for the home page's dining section, which links
// straight to that hotel's own dining venues. A property with no food
// photography at all is left out rather than shown under someone else's photo.
export function diningPhotos(list: readonly Hotel[]): HotelDiningPhoto[] {
  return list.flatMap((hotel) => {
    const photo = firstPhoto(hotel);
    if (!photo || hotel.dining.length === 0) return [];
    return [{ hotel, photo, venueNames: hotel.dining.map((venue) => venue.name) }];
  });
}
