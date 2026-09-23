import type { Hotel } from '../types';

export const darjeelingHotel: Hotel = {
  slug: 'darjeeling',
  name: 'Sinclairs Darjeeling',
  location: 'Darjeeling',
  state: 'West Bengal',
  tagline: "Kanchenjunga, the world's third highest peak, is the reason to be here.",
  description:
    'Strategically located a few minutes from the town centre, Chowrasta, Sinclairs Darjeeling offers splendid views of Mount Kanchenjunga, unmatched by any other hotel in the region. The hotel is an exciting blend of modernity and Victorian charm, perfect for those looking to explore the hill town or relax in comfort. Sinclairs Darjeeling offers 46 rooms and suites, including a special suite for honeymooners that opens out to a private balcony with unhindered views of the Himalayan mountain range.',
  history:
    "One of the group's earliest hotels, opened in 1981 in a hill station the British developed from the 1840s as a sanatorium retreat — later home to the UNESCO World Heritage-listed Darjeeling Himalayan Railway.",
  heroImage: '/images/hotels/darjeeling/destination/Sinclairs-Darjeeling-Entrance-1.webp',
  heroGallery: [
    '/images/hotels/darjeeling/destination/Sinclairs-Darjeeling-Entrance-1.webp',
    '/images/hotels/darjeeling/amenities/Sinclairs Darjeeling Kanchenjunga view.webp',
    '/images/hotels/darjeeling/destination/Sinclairs-Darjeeling-Facade-View.webp',
    '/images/hotels/darjeeling/destination/Sinclairs-Darjeeling-Entrance-2.webp',
  ],
  thumbnailImage: '/images/hotels/darjeeling/destination/Sinclairs-Darjeeling-Entrance-2.webp',
  sceneryImage: '/images/hotels/darjeeling/amenities/Sinclairs Darjeeling Kanchenjunga View 2.webp',
  amenities: [
    'Multicuisine Restaurant',
    'Doctor by Appointment',
    'Laundry',
    'In-house generator',
    'Airport/Railway Transfers',
    'Pool Table',
    'Bar',
    'Cafe',
    'Sundeck and viewing gallery',
    'Smoking Area',
    'Garden',
    'Heating',
    'Free Wi-Fi',
    'Sightseeing Tours',
    'Business Centre',
    'Car Hire',
    'Express Check-In/Check-Out',
    'Library',
    'Luggage Storage',
    'Room Service',
    'Kids play area',
    'Indoor games room with board games, carom and table tennis',
  ],
  rooms: [
    {
      name: 'Deluxe Room',
      amenities: ['Ensuite bathroom', 'Hot and cold shower'],
      sizeSqFt: 223,
      description:
        'Each of these cozy and well appointed rooms have ensuite washrooms, and are equipped with modern facilities, including an attached bath with hot and cold shower.',
      images: [
        '/images/hotels/darjeeling/accommodations/deluxe-room/Deluxe Room Double.webp',
        '/images/hotels/darjeeling/accommodations/deluxe-room/Deluxe Room Double1.webp',
        '/images/hotels/darjeeling/accommodations/deluxe-room/Deluxe Room Twin Bed.webp',
        '/images/hotels/darjeeling/accommodations/deluxe-room/Deluxe Room Twin Bed2.webp',
        '/images/hotels/darjeeling/accommodations/deluxe-room/Deluxe Room Bathroom.webp',
      ],
    },
    {
      name: 'Premier Room',
      view: 'Kanchenjunga view',
      amenities: ['Ensuite bathroom', 'Hot and cold shower'],
      sizeSqFt: 223,
      description:
        'Enjoy beautiful mountain views with a spectacular sunrise from these rooms overlooking the Himalayas, with a Kanchenjunga view and an attached bath with hot and cold shower.',
      images: [
        '/images/hotels/darjeeling/accommodations/premier-room/Sinclairs-Darjeeling-Premier-Room-1.webp',
        '/images/hotels/darjeeling/accommodations/premier-room/Sinclairs-Darjeeling-Premier-Room-2.webp',
        '/images/hotels/darjeeling/accommodations/premier-room/Sinclairs-Darjeeling-Premier-Room-3.webp',
      ],
    },
    {
      name: 'Kanchenjunga Room',
      view: 'Kanchenjunga view',
      amenities: ['Ensuite bathroom', 'Hot and cold shower'],
      sizeSqFt: 271,
      description:
        'This room has a stunning view of the mountains and is ideal for newly-weds, with a Kanchenjunga view and an attached bath with hot and cold shower.',
      images: [
        '/images/hotels/darjeeling/accommodations/kanchenjunga-room/Kanchenjunga Room 1.webp',
        '/images/hotels/darjeeling/accommodations/kanchenjunga-room/Kanchenjunga Room 2.webp',
        '/images/hotels/darjeeling/accommodations/kanchenjunga-room/Kanchenjunga Room 3.webp',
        '/images/hotels/darjeeling/accommodations/kanchenjunga-room/Kanchenjunga Room Bathroom.webp',
      ],
    },
    {
      name: 'Burra Sahib Suite',
      view: 'Kanchenjunga view',
      amenities: ['Ensuite bathroom', 'Hot and cold shower', 'Separate living room'],
      sizeSqFt: 446,
      description:
        'This spacious suite has a bedroom and a living room with wooden floors and rich furnishings which reflect the typical hill style of the hotel, with a Kanchenjunga view and an attached bath with hot and cold shower.',
      images: [
        '/images/hotels/darjeeling/accommodations/burra-sahib-suite/Sinclairs-Darjeeling-Burra-Sahib-Suite-Bathroom-View1.webp',
        '/images/hotels/darjeeling/accommodations/burra-sahib-suite/Sinclairs-Darjeeling-Burra-Sahib-Suite1.webp',
        '/images/hotels/darjeeling/accommodations/burra-sahib-suite/Sinclairs-Darjeeling-Burra-Sahib-Suite2.webp',
        '/images/hotels/darjeeling/accommodations/burra-sahib-suite/Sinclairs-Darjeeling-Burra-Sahib-Suite4.webp',
        '/images/hotels/darjeeling/accommodations/burra-sahib-suite/Sinclairs-Darjeeling-Burra-Sahib-Suite5.webp',
      ],
    },
    {
      name: 'Deluxe Family Room',
      amenities: ['Writing desk'],
      sizeSqFt: 446,
      description:
        'For guests with greater space requirements, this room is the ideal solution to ensure your privacy and have your family next to you in complete comfort and style. It consists of two adjoining double rooms, with the possibility of adding an extra bed in both rooms, sharing a common bathroom with separate areas for relaxing and a writing desk.',
      images: [
        '/images/hotels/darjeeling/accommodations/deluxe-family-room/Deluxe Family Room1.webp',
        '/images/hotels/darjeeling/accommodations/deluxe-family-room/Deluxe Family Room2.webp',
        '/images/hotels/darjeeling/accommodations/deluxe-family-room/Deluxe Family Room3.webp',
        '/images/hotels/darjeeling/accommodations/deluxe-family-room/Deluxe Family Room Bathroom.webp',
      ],
    },
  ],
  dining: [
    {
      name: 'Kanchenjunga Restaurant',
      description:
        'The hotel\u2019s multicuisine restaurant, serving Indian, Continental and Chinese through the day, with the Kanchenjunga range filling the windows at breakfast.',
    },
    {
      name: 'Mount View Caf\u00e9',
      description:
        'A casual all-day caf\u00e9 for tea, coffee and light plates between sightseeing runs.',
      images: ['/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Lobby-Balcony.webp'],
    },
    {
      name: 'The Dorjee Lounge',
      description:
        'A colonial style bar with an unhindered view of the Himalayan mountain range, ideal for a game of pool or relaxing with a book.',
      openingHours: '11 am – 11 pm',
      images: [
        '/images/hotels/darjeeling/dining/Dorjee Lounge Set Up.webp',
        '/images/hotels/darjeeling/dining/Dorjee Lounge Pool Table.webp',
        '/images/hotels/darjeeling/dining/Sinclairs Darjeeling Bar Cabinet.webp',
        '/images/hotels/darjeeling/dining/Sinclairs Darjeeling Lobby.webp',
        '/images/hotels/darjeeling/dining/Sinclairs Darjeeling Reception.webp',
      ],
    },
  ],
  gallery: [
    {
      src: '/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Lobby-Balcony.webp',
      alt: 'Lobby-level balcony dining area with mountain views at Sinclairs Darjeeling',
    },
    {
      src: '/images/hotels/darjeeling/destination/Sinclairs-Darjeeling-Entrance-2.webp',
      alt: 'Flower-lined entrance porch at Sinclairs Darjeeling by daylight',
    },
    {
      src: '/images/hotels/darjeeling/destination/Sinclairs-Darjeeling-Facade-View.webp',
      alt: 'Sinclairs Darjeeling building facade with signage, viewed from the street',
    },
    {
      src: '/images/hotels/darjeeling/amenities/Sinclairs Darjeeling Kanchenjunga View 2.webp',
      alt: 'Panoramic view of Mount Kanchenjunga from Sinclairs Darjeeling',
    },
    {
      src: '/images/hotels/darjeeling/amenities/Serene surroundings of the Spa.webp',
      alt: 'Cottage-style spa block set among trees at Sinclairs Darjeeling',
    },
    {
      src: '/images/hotels/darjeeling/amenities/Sinclairs Darjeeling Games Room1.webp',
      alt: 'Indoor games room with a table tennis table at Sinclairs Darjeeling',
    },
    {
      src: '/images/hotels/darjeeling/amenities/Sinclairs Darjeeling Toddler Corner.webp',
      alt: "Toddler's play corner at Sinclairs Darjeeling",
    },
    {
      src: '/images/hotels/darjeeling/amenities/Toy Train.webp',
      alt: "The Green View Express toy train ride in the hotel's children's park",
    },
    {
      src: '/images/hotels/darjeeling/amenities/Library.webp',
      alt: 'The library lounge at Sinclairs Darjeeling',
    },
    {
      src: '/images/hotels/darjeeling/amenities/Elephants at the Children Park.webp',
      alt: "Elephant statues in the hotel's children's park",
    },
    {
      src: '/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Pinnacle-Setup-1.webp',
      alt: 'The Pinnacle banquet hall set in classroom style for a conference at Sinclairs Darjeeling',
    },
    {
      src: '/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Pinnacle-Setup-2.webp',
      alt: 'The Pinnacle banquet hall with a podium set up for a presentation',
    },
    {
      src: '/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Pinnacle-Setup-3.webp',
      alt: 'The Pinnacle banquet hall arranged in a U-shape layout for a meeting',
    },
  ],
  coords: { lat: 27.041, lng: 88.263 },
  drive: { roadFactor: 1.9, averageSpeedKph: 25 },
  sightseeing: [
    {
      name: 'Tiger Hill',
      blurb: 'Sunrise over Kanchenjunga, and Everest on a clear morning. Leave before 4 am.',
      coords: { lat: 27.0007, lng: 88.2672 },
      roadKm: 11,
      image: '/images/hotels/darjeeling/explore/Drive to Tiger Hill.webp',
    },
    {
      name: 'Darjeeling Himalayan Railway (Toy Train)',
      blurb: 'The 1881 narrow-gauge line, a UNESCO site; joy rides run up to Ghoom.',
      coords: { lat: 27.0428, lng: 88.264 },
      image: '/images/hotels/darjeeling/explore/Darjeeling Himalayan Railway.webp',
    },
    {
      name: 'Batasia Loop',
      blurb: 'The spiral where the toy train turns, wrapped round the Gorkha war memorial.',
      coords: { lat: 27.029, lng: 88.2497 },
      roadKm: 5,
      image: '/images/hotels/darjeeling/explore/Batasia Loop.webp',
    },
    {
      name: 'Chowrasta',
      blurb: 'The Mall’s open square, for a bench, a bookshop and the view.',
      coords: { lat: 27.0431, lng: 88.2637 },
      image: '/images/hotels/darjeeling/explore/Darjeeling Chowrasta.webp',
    },
    {
      name: 'The Mall',
      blurb: 'The pedestrian ring round Observatory Hill, ten minutes from the hotel.',
      coords: { lat: 27.0425, lng: 88.2635 },
      image: '/images/hotels/darjeeling/explore/the Mall.webp',
    },
    {
      name: 'Lloyd Botanical Garden',
      blurb: 'Himalayan orchids and a cold house, in a bowl below the market.',
      coords: { lat: 27.0391, lng: 88.2578 },
    },
    {
      name: 'Ropeway',
      blurb: 'The Rangeet valley cable car, out over the tea gardens.',
      coords: { lat: 27.0483, lng: 88.2542 },
      image: '/images/hotels/darjeeling/explore/Darjeeling Ropeway.webp',
    },
    {
      name: 'Zoological Park',
      blurb: 'Padmaja Naidu’s snow leopards and red pandas, high on Jawahar Road.',
      coords: { lat: 27.0508, lng: 88.256 },
      image: '/images/hotels/darjeeling/explore/Padmaja Naidu Himalayan Zoological Park.webp',
    },
    {
      name: 'Himalayan Mountaineering Institute',
      blurb: 'Tenzing Norgay’s institute, and the museum of the 1953 Everest climb.',
      coords: { lat: 27.051, lng: 88.2565 },
      image: '/images/hotels/darjeeling/explore/Himalayan Mountaineering Institute.webp',
    },
    {
      name: 'Ghoom Monastery',
      blurb: 'The 1850 Yiga Choeling gompa and its fifteen-foot Maitreya.',
      coords: { lat: 27.0099, lng: 88.2452 },
      roadKm: 8,
      image: '/images/hotels/darjeeling/explore/Ghoom Monastery.webp',
    },
    {
      name: 'Mirik',
      blurb: 'A lake town among tea gardens and orange groves, a half-day out.',
      coords: { lat: 26.8869, lng: 88.1869 },
      roadKm: 49,
      image: '/images/hotels/darjeeling/explore/Mirik.webp',
    },
  ],
  eventSpaces: {
    totalSqFt: 960,
    maxCapacity: 100,
    venues: [{ name: 'The Pinnacle', areaSqFt: 960, capacity: 100 }],
  },
  weddings: {
    intro:
      "Say your vows with the world's third-highest peak as your backdrop. Sinclairs Darjeeling pairs colonial-era charm with unhindered views of Mount Kanchenjunga, making it one of the most photogenic wedding settings in the Eastern Himalayas.",
    highlights: [
      'Mountain-view banquet hall for ceremonies and receptions',
      'Dedicated haldi, mehendi and sangeet arrangements',
      'Bespoke wedding menus from our multicuisine kitchen',
      'Honeymoon suite with a private Kanchenjunga-facing balcony',
    ],
    gallery: [
      {
        src: '/images/hotels/darjeeling/weddings/Beautiful Weddings.webp',
        alt: 'A wedding celebration set against the Darjeeling hills',
      },
      {
        src: '/images/hotels/darjeeling/weddings/Mountain Wedding Vows.webp',
        alt: 'A couple exchanging vows with the Himalayas in view',
      },
      {
        src: '/images/hotels/darjeeling/weddings/Mehendi.webp',
        alt: 'Mehendi ceremony decor at a Darjeeling wedding',
      },
      {
        src: '/images/hotels/darjeeling/weddings/Sangeet.webp',
        alt: 'Sangeet night celebrations at a Darjeeling wedding',
      },
      {
        src: '/images/hotels/darjeeling/weddings/Haldi.webp',
        alt: 'Haldi ceremony under the Darjeeling sky',
      },
      {
        src: '/images/hotels/darjeeling/weddings/Renewal of Vows.webp',
        alt: 'A couple renewing their vows overlooking the mountains',
      },
    ],
  },
  meetings: {
    intro:
      'The Pinnacle brings mountain views into every meeting. Configurable for boardroom discussions, classroom-style training or a full conference, it comes backed by a dedicated Business Centre and in-house catering.',
    highlights: [
      'The Pinnacle: 960 sq ft, up to 100 guests',
      'Classroom, theatre, U-shape and boardroom layouts',
      'Business Centre with Wi-Fi and printing support',
      'In-house catering for working lunches and gala dinners',
    ],
    gallery: [
      {
        src: '/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Pinnacle-Setup-1.webp',
        alt: 'The Pinnacle banquet hall set in classroom style for a conference at Sinclairs Darjeeling',
      },
      {
        src: '/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Pinnacle-Setup-2.webp',
        alt: 'The Pinnacle banquet hall with a podium set up for a presentation',
      },
      {
        src: '/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Pinnacle-Setup-3.webp',
        alt: 'The Pinnacle banquet hall arranged in a U-shape layout for a meeting',
      },
    ],
  },
  mapEmbedUrl:
    'https://maps.google.com/maps?q=Sinclairs%20Darjeeling&t=m&z=17&output=embed&iwloc=near',
  contact: {
    address: '18/1 Gandhi Road, Darjeeling 734101, West Bengal, India',
    notificationEmail: 'darjeeling@sinclairshotels.com',
  },
};

export default darjeelingHotel;
