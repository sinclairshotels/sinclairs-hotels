export interface NavItem {
  label: string;
  href: string;
}

export interface RoomType {
  name: string;
  description: string;
  // Square feet, as the properties themselves measure rooms. Metres are
  // derived for display rather than stored, so the two can never disagree.
  // Absent where nobody has measured the room — the tile then shows nothing
  // rather than an empty label, and /admin/rates/monthly lists it as missing.
  sizeSqFt?: number;
  // What the room card states as bullets, drawn from the room's own copy
  // rather than written fresh: where the description does not say, the bullet
  // is absent, the same rule the size follows. Four amenities is what fits a
  // card — the full description is a click away.
  bedType?: string;
  view?: string;
  amenities?: string[];
  images?: string[];
}

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface DiningVenue {
  name: string;
  description: string;
  // Shown on its own line, never inside the prose: hours change and a sentence
  // is the worst place to find one. One house format throughout — lowercase
  // am/pm, no leading zero, an en dash with spaces, sittings joined by ' · '
  // — enforced by content/opening-hours.test.ts rather than by good intentions.
  openingHours?: string;
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

export interface DriveProfile {
  roadFactor: number;
  averageSpeedKph: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SightseeingSpot {
  name: string;
  // One line, what a guest would want to know before deciding to go. Absent
  // where nobody has written one yet — the entry then shows its name alone
  // rather than filler.
  blurb?: string;
  // Where the place is. The distance shown on the page is worked out from this
  // and the hotel's own coordinates, so there is no typed figure to fall out of
  // date, and a place without coordinates shows no distance at all rather than
  // a guess. content/sightseeing.test.ts lists the ones still missing.
  coords?: LatLng;
  // Road kilometres, where the property publishes its own figure. It wins over
  // the estimate worked out from the coordinates — a hill road that doubles
  // back is nothing like the line across the valley, and the team's number is
  // the one guests are quoted on the phone.
  roadKm?: number;
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
  // A qualification printed under the room list, where the rooms promise
  // something the weather can withhold. Only the hill properties carry one:
  // a Kanchenjunga view is a view of cloud for half of July.
  roomsNote?: string;
  dining: DiningVenue[];
  foodGallery?: GalleryImage[];
  gallery: GalleryImage[];
  sightseeing: SightseeingSpot[];
  // The property's own position, which every Explore distance is measured
  // from. Absent means the section shows no distances at all — one missing
  // hotel coordinate silently wrongs every place beneath it, so it is better
  // to show none than to measure from the wrong town.
  coords?: LatLng;
  // How the roads round this property behave, for the drive time beside each
  // distance. Absent means no times are shown — see lib/distance.ts.
  drive?: DriveProfile;
  eventSpaces?: EventSpaces;
  weddings?: WeddingContent;
  meetings?: MeetingsContent;
  mapEmbedUrl?: string;
  contact?: ContactInfo;
  gstin?: string;
  webCheckinUrl?: string;
  thingsToCarryUrl?: string;
}
