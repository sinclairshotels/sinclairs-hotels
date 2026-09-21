import type { Hotel } from '../types';

export const siliguriHotel: Hotel = {
  slug: 'siliguri',
  name: 'Sinclairs Siliguri',
  location: 'Siliguri',
  state: 'West Bengal',
  tagline: 'Endless greenery with tea gardens amidst a bustling city.',
  description:
    'Situated in Pradhan Nagar, at the heart of the city, Sinclairs Siliguri is a luxury hotel equipped with modern amenities. One of the most renowned hotels in the region, it is ideal for businessmen and for tourists who want to make the best of what the city has to offer. The hotel offers rooms and suites over two levels, with guests able to dine at the multicuisine restaurant while taking in soothing views of the poolside and gardens, or unwind at the lounge bar which offers a range of premium drinks. For conferencing, multiple banquet halls and outdoor meeting facilities can accommodate up to 500 people, making Sinclairs one of the leading conference venues in Siliguri.',
  history:
    "Sinclairs' very first hotel, opened here in 1976 — the gateway city that grew around a 19th-century railway junction linking the Bengal plains to Darjeeling and the eastern Himalayas.",
  heroImage: '/images/hotels/siliguri/destination/Sinclairs-Siliguri-with-pool.webp',
  thumbnailImage: '/images/hotels/siliguri/destination/Sinclairs-Siliguri-with-pool.webp',
  amenities: [
    'Multicuisine Restaurant',
    'Doctor by Appointment',
    'Same Day Laundry Service',
    'Airport/Railway Transfers',
    'Outdoor Swimming Pool',
    'Free Wi-Fi',
    'Lounge Bar',
    'Sightseeing Tours',
    'Elevator',
    'Gym',
    'Car Parking & Valet Service',
    'Open Air Terrace',
    'In-house Generator',
    'Room Service',
    'Lawn and Open Air Garden Café',
    'Car Hire',
    'Smoking Area',
    'Spa',
  ],
  rooms: [
    {
      name: 'Premier Room',
      description:
        'Recently refurbished with modern comforts, the room is equipped with ensuite bathrooms and rain showers. Room size: 192 sq. ft., with herbal bathroom amenities, a rain shower, twin lighting options, an LCD TV with satellite channels, split AC system and free Wi-Fi.',
      images: [
        '/images/hotels/siliguri/accommodations/premier-room/Sinclairs-Siliguri-Premier-Room.webp',
      ],
    },
    {
      name: 'Garden Suite',
      description:
        'A bedroom with ensuite bathroom and shower, attached with a small seating area and a private terrace. Room size: 290 sq. ft., with a king size bed, writing desk, attached terrace garden with sit out, LCD TV with satellite channels, tea/coffee set, safe and free Wi-Fi.',
      images: [
        '/images/hotels/siliguri/accommodations/garden-suite/Sinclairs-Siliguri-Garden-Suite.webp',
      ],
    },
    {
      name: 'Premier Suite',
      description:
        'The rooms are luxurious and contemporary with a spacious bedroom, living room and two ensuite bathrooms and showers. Room size: 450 sq. ft., with a king size bed, separate living room, writing desk, two 32-inch LCD televisions, tea/coffee set, safe and free Wi-Fi.',
      images: [
        '/images/hotels/siliguri/accommodations/premier-suite/Sinclairs-Siliguri-Premier-Suite.webp',
      ],
    },
  ],
  dining: [
    {
      name: 'The Palms',
      description:
        'Serves classic favourites in international and local cuisine, with soothing views of the poolside and gardens and a bar offering a variety of premium drinks. Multicuisine, casual dress code, open 7.30 AM to 10.30 PM.',
      images: ['/images/hotels/siliguri/dining/Sinclairs-Siliguri-The-Palms-Restaurant.webp'],
    },
  ],
  gallery: [
    {
      src: '/images/hotels/siliguri/destination/Sinclairs-Siliguri-with-pool.webp',
      alt: 'Sinclairs Siliguri exterior with outdoor swimming pool',
    },
  ],
  sightseeing: [
    { name: 'The Kanchenjunga Stadium', image: '/images/hotels/siliguri/explore/stadium.webp' },
    { name: 'Kalchakra Monastery' },
    { name: 'Salugara Monastery', image: '/images/hotels/siliguri/explore/Monastery.webp' },
    { name: 'ISKCON Temple' },
  ],
  weddings: {
    intro:
      'With six banquet spaces and a total capacity of 500 guests, Sinclairs Siliguri is built for a wedding on any scale — from an intimate sangeet in The Regacy to a Darbar Hall reception under the chandeliers.',
    highlights: [
      'The Darbar seats up to 220 guests',
      'The Terrace for outdoor receptions up to 500',
      'Dedicated haldi, mehendi and sangeet arrangements',
      'Multi-cuisine wedding menus',
    ],
    gallery: [
      {
        src: '/images/hotels/siliguri/weddings/Wedding.webp',
        alt: 'A wedding celebration at Sinclairs Siliguri',
      },
      {
        src: '/images/hotels/siliguri/weddings/haldi (3).webp',
        alt: 'Haldi ceremony celebrations at Sinclairs Siliguri',
      },
      {
        src: '/images/hotels/siliguri/weddings/mehendi (2).webp',
        alt: 'Mehendi ceremony decor at Sinclairs Siliguri',
      },
      {
        src: '/images/hotels/siliguri/weddings/vow.webp',
        alt: 'A couple exchanging vows at Sinclairs Siliguri',
      },
      {
        src: '/images/hotels/siliguri/weddings/couple shoot (4).webp',
        alt: 'A couple portrait shoot at Sinclairs Siliguri',
      },
      {
        src: '/images/hotels/siliguri/weddings/honeymoon (3).webp',
        alt: 'A honeymoon getaway at Sinclairs Siliguri',
      },
    ],
  },
  meetings: {
    intro:
      "Six configurable banquet spaces — from the intimate Emperor Hall to the 500-capacity Terrace — make Sinclairs Siliguri one of the region's leading conference venues, right in the heart of the city.",
    highlights: [
      'Six halls seating from 10 to 500 guests',
      'The Darbar and Imperial for mid-size conferences',
      'In-house catering and Wi-Fi throughout',
      'Central Siliguri location, close to NJP station',
    ],
  },
  eventSpaces: {
    totalSqFt: 13120,
    maxCapacity: 500,
    venues: [
      { name: 'The Darbar', areaSqFt: 2400, capacity: 220 },
      { name: 'Imperial', areaSqFt: 1750, capacity: 80 },
      { name: 'The Regacy', areaSqFt: 750, capacity: 40 },
      { name: 'The Summit', areaSqFt: 450, capacity: 18 },
      { name: 'The Emperor', areaSqFt: 270, capacity: 10 },
      { name: 'The Terrace', areaSqFt: 7500, capacity: 500 },
    ],
  },
  mapEmbedUrl:
    'https://maps.google.com/maps?q=Sinclairs%20Siliguri&t=m&z=17&output=embed&iwloc=near',
  contact: {
    address: 'P.O. Pradhan Nagar, Siliguri 734003, West Bengal, India',
    notificationEmail: 'siliguri@sinclairshotels.com',
  },
};

export default siliguriHotel;
