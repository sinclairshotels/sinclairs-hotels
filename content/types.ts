export interface NavItem {
  label: string;
  href: string;
}

export interface RoomType {
  name: string;
  description: string;
  images?: string[];
}

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface DiningVenue {
  name: string;
  description: string;
  images?: string[];
}

export interface EventVenue {
  name: string;
  areaSqFt: number;
  capacity: number;
  // Labels a room as a boardroom on the venue lists. It still counts as one of
  // the property's event spaces.
  kind?: 'boardroom';
}

export interface EventSpaces {
  totalSqFt: number;
  maxCapacity: number;
  venues: EventVenue[];
}

export interface ContactInfo {
  address: string;
  // Where staff mail about this property is routed. Deliberately not called
  // `email`: no guest-facing surface shows a property address any more, so a
  // field that reads like one on a hotel page is a trap. Every guest contact
  // point is the enquiry form.
  notificationEmail: string;
}

export interface BookingOffice {
  name: string;
  city: string;
  phone: string;
  email: string;
}

export interface SightseeingSpot {
  name: string;
  image?: string;
}

export interface WeddingContent {
  intro: string;
  highlights: string[];
  gallery: GalleryImage[];
}

export interface MeetingsContent {
  intro: string;
  highlights: string[];
  gallery?: GalleryImage[];
}

export interface Hotel {
  slug: string;
  name: string;
  location: string;
  state: string;
  tagline: string;
  description: string;
  history?: string;
  heroImage: string;
  heroGallery?: string[];
  thumbnailImage: string;
  // The landscape this property sits in, for the home page's hero carousel:
  // a view, not the building, the lobby or the pool. Required so the choice is
  // made in content per property rather than guessed from a folder at render
  // time, and registered as a photo slot so staff can change it.
  sceneryImage: string;
  amenities: string[];
  rooms: RoomType[];
  dining: DiningVenue[];
  foodGallery?: GalleryImage[];
  gallery: GalleryImage[];
  sightseeing: SightseeingSpot[];
  eventSpaces?: EventSpaces;
  weddings?: WeddingContent;
  meetings?: MeetingsContent;
  mapEmbedUrl?: string;
  contact?: ContactInfo;
  gstin?: string;
  webCheckinUrl?: string;
  thingsToCarryUrl?: string;
}
