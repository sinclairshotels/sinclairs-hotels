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
  // A boardroom is a meeting room, not an event space — it is listed with the
  // venues but never counted in a property's "Event Spaces" figure.
  kind?: 'boardroom';
}

export interface EventSpaces {
  totalSqFt: number;
  maxCapacity: number;
  venues: EventVenue[];
}

export interface ContactInfo {
  address: string;
  phone: string;
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
