import { awards } from '@/content/awards';
import { experiences } from '@/content/experiences';
import { hotels } from '@/content/hotels';
import { pressMentions } from '@/content/site';
import type { Hotel } from '@/content/types';

// The widest a browser is ever served. A replacement is resized to its slot's
// width and never enlarged past what the upload actually contains — resolution
// that was never captured cannot be added, only bytes.
export const HERO_WIDTH = 3840;
export const STANDARD_WIDTH = 2400;

export interface PhotoSlot {
  // Stable across deploys: it is what an upload is filed under and what an
  // audit line names, so it is built from content identity (hotel, section,
  // room name, index) rather than array position alone.
  key: string;
  label: string;
  // The public/ path this position renders today.
  contentPath: string;
  targetWidth: number;
  // Where this image sits inside the content object the page renders, so an
  // override can be applied to that one position rather than to every field
  // that happens to hold the same file. Absent for a slot a page names as a
  // literal, which resolves through photoUrl(slot.key, ...) instead.
  at?: (string | number)[];
  // Set for a slot that belongs to a property, so the audit log can be filtered
  // by hotel the way every other entry is.
  hotelSlug?: string;
}

export interface PhotoSection {
  key: string;
  title: string;
  slots: PhotoSlot[];
}

export interface PhotoPage {
  key: string;
  title: string;
  href: string;
  sections: PhotoSection[];
}

function slot(
  key: string,
  label: string,
  contentPath: string,
  targetWidth = STANDARD_WIDTH,
  at?: (string | number)[],
): PhotoSlot {
  return { key, label, contentPath, targetWidth, at };
}

function forHotel(slots: PhotoSlot[], hotelSlug: string): PhotoSlot[] {
  return slots.map((s) => ({ ...s, hotelSlug }));
}

function hotelPage(hotel: Hotel): PhotoPage {
  const h = hotel.slug;

  const overview: PhotoSlot[] = [
    slot(`${h}:overview:hero`, 'Hero image', hotel.heroImage, HERO_WIDTH, ['heroImage']),
    ...(hotel.heroGallery ?? []).map((src, i) =>
      slot(`${h}:overview:hero-gallery:${i}`, `Hero carousel ${i + 1}`, src, HERO_WIDTH, [
        'heroGallery',
        i,
      ]),
    ),
    slot(`${h}:overview:thumb`, 'Thumbnail — cards and nav', hotel.thumbnailImage, STANDARD_WIDTH, [
      'thumbnailImage',
    ]),
  ];

  const rooms = hotel.rooms.flatMap((room, r) =>
    (room.images ?? []).map((src, i) =>
      slot(`${h}:rooms:${room.name}:${i}`, `${room.name} — photo ${i + 1}`, src, STANDARD_WIDTH, [
        'rooms',
        r,
        'images',
        i,
      ]),
    ),
  );

  const dining = [
    ...hotel.dining.flatMap((venue, d) =>
      (venue.images ?? []).map((src, i) =>
        slot(
          `${h}:dining:${venue.name}:${i}`,
          `${venue.name} — photo ${i + 1}`,
          src,
          STANDARD_WIDTH,
          ['dining', d, 'images', i],
        ),
      ),
    ),
    ...(hotel.foodGallery ?? []).map((image, i) =>
      slot(`${h}:dining:food:${i}`, `Food gallery ${i + 1}`, image.src, STANDARD_WIDTH, [
        'foodGallery',
        i,
        'src',
      ]),
    ),
  ];

  const weddings = (hotel.weddings?.gallery ?? []).map((image, i) =>
    slot(`${h}:weddings:${i}`, `Weddings ${i + 1}`, image.src, STANDARD_WIDTH, [
      'weddings',
      'gallery',
      i,
      'src',
    ]),
  );

  const meetings = (hotel.meetings?.gallery ?? []).map((image, i) =>
    slot(`${h}:meetings:${i}`, `Meetings ${i + 1}`, image.src, STANDARD_WIDTH, [
      'meetings',
      'gallery',
      i,
      'src',
    ]),
  );

  const gallery = hotel.gallery.map((image, i) =>
    slot(`${h}:gallery:${i}`, `Gallery ${i + 1}`, image.src, STANDARD_WIDTH, ['gallery', i, 'src']),
  );

  const explore = hotel.sightseeing.flatMap((spot, i) =>
    spot.image
      ? [
          slot(`${h}:explore:${spot.name}`, spot.name, spot.image, STANDARD_WIDTH, [
            'sightseeing',
            i,
            'image',
          ]),
        ]
      : [],
  );

  const sections: PhotoSection[] = [
    { key: 'overview', title: 'Overview', slots: forHotel(overview, h) },
    { key: 'rooms', title: 'Rooms', slots: forHotel(rooms, h) },
    { key: 'dining', title: 'Dining', slots: forHotel(dining, h) },
    { key: 'weddings', title: 'Weddings', slots: forHotel(weddings, h) },
    { key: 'meetings', title: 'Meetings', slots: forHotel(meetings, h) },
    { key: 'gallery', title: 'Gallery', slots: forHotel(gallery, h) },
    { key: 'explore', title: 'Explore', slots: forHotel(explore, h) },
  ];

  return {
    key: `hotel:${h}`,
    title: hotel.name,
    href: `/hotels/${h}`,
    sections: sections.filter((section) => section.slots.length > 0),
  };
}

// Images a page file names directly rather than reading from content. Adding one
// to a page and forgetting it here would put it under "Not used on any page",
// where it is one click from being retired — so photo-slots.test.ts scans the
// app and component tree for /images/… literals and fails if any is missing.
const HOME: PhotoPage = {
  key: 'home',
  title: 'Home',
  href: '/',
  sections: [
    {
      key: 'home:cards',
      title: 'Events and weddings cards',
      slots: [
        slot(
          'home:events-card',
          'Events & Conferences card',
          '/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Pinnacle-Setup-1.webp',
        ),
        slot('home:weddings-card', 'Weddings card', '/images/weddings/Wedding-Portrait.webp'),
        slot(
          'home:weddings-lattice',
          'Weddings hero — lattice',
          '/images/weddings/Wedding-Lattice.webp',
          HERO_WIDTH,
        ),
        slot('home:weddings-mehendi', 'Weddings — mehendi', '/images/weddings/Mehendi.webp'),
      ],
    },
    {
      key: 'home:experiences',
      title: 'Signature experiences',
      slots: experiences.map((experience, i) =>
        slot(`home:experience:${i}`, experience.title, experience.image, STANDARD_WIDTH, [
          i,
          'image',
        ]),
      ),
    },
    {
      key: 'home:awards',
      title: 'Awards',
      slots: awards.map((award, i) =>
        slot(
          `home:award:${award.propertySlug}`,
          `${award.propertySlug} badge`,
          award.badgeImage,
          STANDARD_WIDTH,
          [i, 'badgeImage'],
        ),
      ),
    },
  ],
};

const CONTACT: PhotoPage = {
  key: 'contact',
  title: 'Contact',
  href: '/contact',
  sections: [
    {
      key: 'contact:hero',
      title: 'Hero',
      slots: [
        slot(
          'contact:hero',
          'Hero image',
          '/images/hotels/dooars/amenities/Welcoming guest with the traditional khada.webp',
          HERO_WIDTH,
        ),
      ],
    },
  ],
};

// The remaining marketing pages. They are not in the order the contact sheet was
// asked for, but every image they name has to be claimed by some slot: an image
// that only appears here would otherwise be listed as used by nothing and offered
// for deletion, which would break the page that renders it.
const OTHER_PAGES: PhotoPage[] = [
  {
    key: 'hotels-listing',
    title: 'Hotels listing',
    href: '/hotels',
    sections: [
      {
        key: 'hotels-listing:images',
        title: 'Page images',
        slots: [
          slot(
            'hotels-listing:hero',
            'Hero image',
            '/images/hotels/port-blair/destination/SinclairsBayviewAerielView.webp',
            HERO_WIDTH,
          ),
          slot(
            'hotels-listing:editorial',
            'Editorial row',
            '/images/hotels/darjeeling/dining/Sinclairs Darjeeling Lobby.webp',
          ),
          slot(
            'hotels-listing:closing',
            'Closing band',
            '/images/hotels/darjeeling/amenities/Sinclairs Darjeeling Kanchenjunga view.webp',
            HERO_WIDTH,
          ),
        ],
      },
    ],
  },
  {
    key: 'weddings',
    title: 'Weddings',
    href: '/weddings',
    sections: [
      {
        key: 'weddings:hero',
        title: 'Hero carousel',
        slots: [
          slot(
            'weddings:hero:0',
            'Carousel 1',
            '/images/weddings/Wedding-Portrait.webp',
            HERO_WIDTH,
          ),
          slot(
            'weddings:hero:1',
            'Carousel 2 — palace',
            '/images/hotels/udaipur/weddings/A Royal Fairytale.webp',
            HERO_WIDTH,
          ),
          slot(
            'weddings:hero:2',
            'Carousel 3',
            '/images/weddings/Wedding-Lattice.webp',
            HERO_WIDTH,
          ),
        ],
      },
      {
        key: 'weddings:moments',
        title: 'Moments',
        slots: [
          slot(
            'weddings:moment:0',
            'Memorable weddings',
            '/images/hotels/darjeeling/weddings/Haldi.webp',
          ),
          slot('weddings:moment:1', 'Help us plan your day', '/images/weddings/Mehendi.webp'),
          slot(
            'weddings:moment:2',
            'A tasteful wedding menu',
            '/images/hotels/burdwan/weddings/wedding feast.webp',
          ),
          slot(
            'weddings:moment:3',
            'Lavish stays',
            '/images/hotels/darjeeling/accommodations/kanchenjunga-room/Kanchenjunga Room 1.webp',
          ),
        ],
      },
      {
        key: 'weddings:closing',
        title: 'Closing band',
        slots: [
          slot(
            'weddings:closing',
            'Closing band',
            '/images/weddings/Wedding-Portrait.webp',
            HERO_WIDTH,
          ),
        ],
      },
    ],
  },
  {
    key: 'meetings-events',
    title: 'Meetings & Events',
    href: '/meetings-events',
    sections: [
      {
        key: 'meetings-events:images',
        title: 'Page images',
        slots: [
          slot(
            'meetings:hero',
            'Hero image',
            '/images/hotels/kalimpong/amenities/The Orchid 1.webp',
            HERO_WIDTH,
          ),
          slot(
            'meetings:feature:0',
            'Feature — banqueting',
            '/images/hotels/dooars/amenities/The Iris Hall 1 (2).webp',
          ),
          slot(
            'meetings:feature:1',
            'Feature — catering',
            '/images/hotels/gangtok/dining/RestaurantBuffet2.webp',
          ),
          slot(
            'meetings:feature:2',
            'Feature — offsites',
            '/images/hotels/gangtok/explore/Gangtok Tsogmo Lake.webp',
          ),
          slot(
            'meetings:closing',
            'Closing band',
            '/images/hotels/ooty/gallery/The Regal room.webp',
            HERO_WIDTH,
          ),
        ],
      },
    ],
  },
  {
    key: 'media',
    title: 'Press & Media',
    href: '/media',
    sections: [
      {
        key: 'media:images',
        title: 'Page images',
        slots: [
          slot(
            'media:hero',
            'Hero image',
            '/images/hotels/gangtok/destination/SinclairsGangtoknightview.webp',
            HERO_WIDTH,
          ),
        ],
      },
      {
        key: 'media:clippings',
        title: 'Clippings',
        // Derived from the content rather than listed, so a slot's locator can
        // never drift from the entry it names.
        slots: pressMentions.flatMap((mention, i) => {
          const image = 'image' in mention ? mention.image : undefined;
          return image
            ? [
                slot(`media:${i}`, `${mention.outlet} — ${mention.title}`, image, STANDARD_WIDTH, [
                  i,
                  'image',
                ]),
              ]
            : [];
        }),
      },
    ],
  },
];

// Home, then every hotel in site order, then the contact page, then the
// remaining marketing pages. "Not used on any page" is built by difference in
// lib/photo-files.ts, so it is only ever as correct as this list.
export function photoPages(): PhotoPage[] {
  return [HOME, ...hotels.map(hotelPage), CONTACT, ...OTHER_PAGES];
}

// The slots whose locators are relative to one hotel object, one array of
// experiences, awards or press mentions. withPhotos() applies an override at
// the locator, so it needs the slots for exactly the value it is given.
export function hotelSlots(hotel: Hotel): PhotoSlot[] {
  return hotelPage(hotel).sections.flatMap((section) => section.slots);
}

export function experienceSlots(): PhotoSlot[] {
  return sectionSlots(HOME, 'home:experiences');
}

export function awardSlots(): PhotoSlot[] {
  return sectionSlots(HOME, 'home:awards');
}

export function pressSlots(): PhotoSlot[] {
  const media = OTHER_PAGES.find((page) => page.key === 'media');
  return media ? sectionSlots(media, 'media:clippings') : [];
}

function sectionSlots(page: PhotoPage, sectionKey: string): PhotoSlot[] {
  return page.sections.find((section) => section.key === sectionKey)?.slots ?? [];
}

export function allSlots(): PhotoSlot[] {
  return photoPages().flatMap((page) => page.sections.flatMap((section) => section.slots));
}

export function slotByKey(key: string): PhotoSlot | undefined {
  return allSlots().find((s) => s.key === key);
}

// One file can be rendered in more than one position — a hotel's hero is also
// its listing card — so the set is smaller than the slot list.
export function claimedPaths(): Set<string> {
  return new Set(allSlots().map((s) => s.contentPath));
}
