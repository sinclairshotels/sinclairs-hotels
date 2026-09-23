import type { Hotel } from '../types';

export const udaipurHotel: Hotel = {
  slug: 'udaipur',
  name: 'Sinclairs Palace Retreat Udaipur',
  location: 'Haldighati, Udaipur',
  state: 'Rajasthan',
  tagline: 'Palatial stays and memorable celebrations in Haldighati.',
  description:
    "Experience the grandeur and elegance of a bygone royal era at Sinclairs Palace Retreat, a palace hotel set in the heart of Haldighati, an hour's drive from Udaipur city. The 95-room hotel blends rich history with modern opulence, offering guests a royal retreat with impeccable service and panoramic views of the surrounding landscapes. The palace exudes luxury and grandeur, making it an ideal venue for an extravagant wedding, social gathering, or royal conference.",
  history:
    "The group's newest property, opened in September 2025 on Haldighati Road — the site of the 1576 battle between Maharana Pratap and the Mughal forces of Akbar.",
  heroImage: '/images/hotels/udaipur/destination/Facade_night view.webp',
  heroGallery: [
    '/images/hotels/udaipur/destination/Facade_night view.webp',
    '/images/hotels/udaipur/gallery/Palace (3).webp',
    '/images/hotels/udaipur/destination/Garden.webp',
    '/images/hotels/udaipur/destination/Courtyard Night view.webp',
  ],
  thumbnailImage: '/images/hotels/udaipur/gallery/Palace (3).webp',
  sceneryImage: '/images/hotels/udaipur/explore/kumbhalgarh.webp',
  amenities: [
    'Intercom',
    'Tea/Coffee Maker',
    'Work Desk',
    'Television',
    'Ceiling Fan',
    'Air Conditioning',
  ],
  rooms: [
    {
      name: 'Premier Room',
      bedType: 'King bed',
      amenities: ['Ensuite bathroom', 'Hot and cold shower', 'Mini fridge', 'In-room dining'],
      sizeSqFt: 334,
      description:
        'Rajasthani-inspired details bring character to a comfortable room with a king-size bed. Return from exploring Haldighati to your own space to unwind, with an en suite shower, mini fridge and the option of in-room dining.',
      images: [
        '/images/hotels/udaipur/accommodations/premier-room/Premier room (1).webp',
        '/images/hotels/udaipur/accommodations/premier-room/Premier room (2).webp',
        '/images/hotels/udaipur/accommodations/premier-room/Premier room (3).webp',
        '/images/hotels/udaipur/accommodations/premier-room/Premier room_Bed.webp',
      ],
    },
    {
      name: 'Premier Plus Room',
      bedType: 'King bed',
      amenities: ['Ensuite bathroom', 'Hot and cold shower', 'Mini fridge', 'In-room dining'],
      sizeSqFt: 363,
      description:
        'Enjoy more space to settle in, with a king-size bed and interiors inspired by Rajasthan. An en suite shower, mini fridge and in-room dining make the Premier Plus Room a comfortable choice for a leisurely stay.',
      images: [
        '/images/hotels/udaipur/accommodations/premier-plus-room/Premier Plus (1).webp',
        '/images/hotels/udaipur/accommodations/premier-plus-room/Premier Plus (2).webp',
        '/images/hotels/udaipur/accommodations/premier-plus-room/Premier Plus (3).webp',
        '/images/hotels/udaipur/accommodations/premier-plus-room/Premier Plus (4).webp',
      ],
    },
    {
      name: 'Premier Suite',
      bedType: 'King bed',
      amenities: ['Ensuite bathroom', 'Hot and cold shower', 'Mini fridge', 'In-room dining'],
      sizeSqFt: 457,
      description:
        'Separate living and sleeping areas give this suite an easy sense of space. Relax between outings or celebrations, then retreat to the king-size bedroom. An attached bathroom, mini fridge and in-room dining add everyday convenience.',
      images: [
        '/images/hotels/udaipur/accommodations/premier-suite/Premier suite (1).webp',
        '/images/hotels/udaipur/accommodations/premier-suite/Premier suite seating.webp',
        '/images/hotels/udaipur/accommodations/premier-suite/Premier suite (2).webp',
        '/images/hotels/udaipur/accommodations/premier-suite/Premier suite_washroom (2).webp',
      ],
    },
    {
      name: 'Villa',
      bedType: 'Queen bed',
      amenities: [
        'Ensuite bathroom',
        'Hot and cold shower',
        'Mini fridge',
        'Wardrobe',
        'In-room dining',
      ],
      sizeSqFt: 400,
      description:
        'The Villa offers a welcoming setting for a relaxed stay, with a queen-size bed and Rajasthani-inspired décor. A large wardrobe and luggage rack make it easy to unpack, while an en suite shower and mini fridge complete the space.',
      images: [
        '/images/hotels/udaipur/accommodations/villa/Villa (1).webp',
        '/images/hotels/udaipur/accommodations/villa/Villa (2).webp',
        '/images/hotels/udaipur/accommodations/villa/Villa entrance.webp',
      ],
    },
  ],
  dining: [
    {
      name: 'The Gharana',
      description:
        'a vegetarian, multicuisine restaurant serving a daily fresh selection of Indian and local specialties for breakfast, lunch, and dinner (casual dress code)',
      openingHours: '7 am – 11 pm',
      images: ['/images/hotels/udaipur/dining/Gharana_Restaurant (1).webp'],
    },
  ],
  gallery: [
    {
      src: '/images/hotels/udaipur/gallery/Palace (1).webp',
      alt: 'Aerial view of Sinclairs Palace Retreat Udaipur and its fountain courtyard',
    },
    {
      src: '/images/hotels/udaipur/gallery/Outside view.webp',
      alt: 'View of a domed pavilion framed by an archway, with the Haldighati hills beyond',
    },
    {
      src: '/images/hotels/udaipur/destination/Corridor.webp',
      alt: 'Checkered marble corridor at Sinclairs Palace Retreat Udaipur, opening onto the fountain courtyard',
    },
    {
      src: '/images/hotels/udaipur/destination/Corridor Night.webp',
      alt: 'The palace corridor lit up at night',
    },
    {
      src: '/images/hotels/udaipur/destination/Courtyard Night view.webp',
      alt: "The palace's central domed courtyard lit up at night",
    },
    {
      src: '/images/hotels/udaipur/destination/Fountain.webp',
      alt: 'The illuminated fountain at the palace entrance courtyard, by night',
    },
    {
      src: '/images/hotels/udaipur/destination/Garden.webp',
      alt: 'Sinclairs Palace Retreat Udaipur facade with its landscaped lawn, by day',
    },
    {
      src: '/images/hotels/udaipur/gallery/Painting.webp',
      alt: 'Traditional Rajasthani wall painting inside the palace',
    },
  ],
  coords: { lat: 24.93, lng: 73.76 },
  drive: { roadFactor: 1.2, averageSpeedKph: 40 },
  sightseeing: [
    {
      name: 'Haldighati Museum',
      blurb: 'The battle of 1576 told with dioramas, on the pass itself.',
      coords: { lat: 24.931, lng: 73.715 },
      image: '/images/hotels/udaipur/explore/haldighati pass.webp',
    },
    {
      name: 'Chetak Samadhi',
      blurb: 'The memorial to Maharana Pratap’s horse, a kilometre beyond the pass.',
      coords: { lat: 24.939, lng: 73.708 },
      image: '/images/hotels/udaipur/explore/chetak samadhi.webp',
    },
    {
      name: 'Rakt Talai',
      blurb: 'The field where the battle was fought, marked by chhatris.',
      coords: { lat: 24.925, lng: 73.718 },
      image: '/images/hotels/udaipur/explore/Rakht-Talai-Haldighati.webp',
    },
    {
      name: 'Nathdwara Shrinathji Temple',
      blurb: 'The 17th-century Krishna shrine, and Rajasthan’s busiest pilgrimage.',
      coords: { lat: 24.937, lng: 73.823 },
      roadKm: 18,
      image: '/images/hotels/udaipur/explore/Shrinathji_Temple-Nathdwara_Rajsamand12.webp',
    },
    {
      name: 'Eklingji Temple',
      blurb: 'The Mewar rulers’ own Shiva temple, in a walled complex of 108 shrines.',
      coords: { lat: 24.737, lng: 73.745 },
      roadKm: 24,
    },
    {
      name: 'Kumbhalgarh Fort',
      blurb: 'The 15th-century hill fort behind the second-longest wall in the world.',
      coords: { lat: 25.148, lng: 73.587 },
      roadKm: 55,
      image: '/images/hotels/udaipur/explore/kumbhalgarh.webp',
    },
    {
      name: 'City Palace Udaipur',
      blurb: 'The Mewar palace over Lake Pichola, and its crystal gallery.',
      coords: { lat: 24.576, lng: 73.683 },
      roadKm: 40,
    },
    {
      name: 'Lake Pichola',
      blurb: 'The lake the city is built around; take the boat at sunset.',
      coords: { lat: 24.572, lng: 73.679 },
      roadKm: 41,
    },
    {
      name: 'Fateh Sagar Lake',
      blurb: 'The northern lake, with Nehru Garden on its island.',
      coords: { lat: 24.6, lng: 73.68 },
      roadKm: 44,
    },
    {
      name: 'Saheliyon Ki Bari',
      blurb: 'The garden of the maidens, with its fountains and lotus pool.',
      coords: { lat: 24.601, lng: 73.689 },
      roadKm: 44,
    },
  ],
  eventSpaces: {
    totalSqFt: 9600,
    maxCapacity: 500,
    venues: [
      { name: 'Rajmahal', areaSqFt: 7000, capacity: 500 },
      { name: 'Rajmahal Annexe', areaSqFt: 2000, capacity: 125 },
      { name: 'Haveli', areaSqFt: 600, capacity: 40 },
    ],
  },
  weddings: {
    intro:
      'A genuine Rajasthani palace, complete with a fountain courtyard and domed pavilions, Sinclairs Palace Retreat Udaipur is built for a wedding on a royal scale — the Rajmahal alone seats 500.',
    highlights: [
      'Rajmahal seats up to 500 guests',
      'Palace courtyard for a fairytale ceremony',
      'Dedicated haldi, mehendi and sangeet arrangements',
      'Vegetarian, multicuisine wedding menus at The Gharana',
    ],
    gallery: [
      {
        src: '/images/hotels/udaipur/weddings/Sinclairs Palace Retreat Udaipur Weddings.webp',
        alt: 'A wedding celebration at Sinclairs Palace Retreat Udaipur',
      },
      {
        src: '/images/hotels/udaipur/weddings/A Royal Fairytale.webp',
        alt: 'A royal wedding celebration within the palace courtyard',
      },
      {
        src: '/images/hotels/udaipur/weddings/Weddings- To Abhirup.webp',
        alt: 'A wedding celebration at the palace',
      },
      {
        src: '/images/hotels/udaipur/weddings/Romance blossoms in every courtyard.webp',
        alt: 'A couple celebrating amid the palace courtyards',
      },
      {
        src: '/images/hotels/udaipur/weddings/Mehendi.webp',
        alt: 'Mehendi ceremony decor at Sinclairs Palace Retreat Udaipur',
      },
      {
        src: '/images/hotels/udaipur/weddings/Sangeet.webp',
        alt: 'Sangeet night celebrations at Sinclairs Palace Retreat Udaipur',
      },
    ],
  },
  meetings: {
    intro:
      "The Rajmahal's 7,000 sq ft can seat up to 500 delegates, with the Rajmahal Annexe and the Haveli for breakouts — making Sinclairs Palace Retreat Udaipur one of the region's largest royal conference venues, set within a genuine heritage palace an hour from Udaipur city.",
    highlights: [
      'Rajmahal seats up to 500 guests',
      'Rajmahal Annexe and Haveli for smaller sessions',
      'Vegetarian, multicuisine catering at The Gharana',
      "An hour's drive from Udaipur airport",
    ],
  },
  mapEmbedUrl:
    'https://maps.google.com/maps?q=Sinclairs%20Palace%20Retreat%20Udaipur&t=m&z=17&output=embed&iwloc=near',
  contact: {
    address: 'Karanji Ka Guda, District Udaipur 313322, Rajasthan, India',
    notificationEmail: 'palace.udaipur@sinclairshotels.com',
  },
};

export default udaipurHotel;
