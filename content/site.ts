import type { BookingOffice } from './types';

export const siteConfig = {
  name: 'Sinclairs Hotels & Resorts',
  shortName: 'Sinclairs',
  description:
    'A collection of hotels and resorts across India, designed for the value traveller — affordable comfort without compromising on cleanliness, service, or character.',
  url: 'https://www.sinclairshotels.com',
};

// Staah sells the inventory this site does not: the website sells its own
// allotment per hotel, room type and night through /book, and Staah sells the
// rest. No CTA here points at this URL any more — it is kept because Staah is
// still a live channel staff work in, and a fallback needs somewhere to point.
export const reservationUrl =
  'https://reservation.sinclairshotels.com/inst/#group?groupId=882Mjkbac8S7wLYqvHyxVFGKNMfaaeRV5yNO8NFk4hB5fg15ZQ3NDc=&JDRN=Y';

export const socialLinks = [
  { label: 'Facebook', href: 'https://www.facebook.com/sinclairshotelsandresorts/' },
  { label: 'Instagram', href: 'https://www.instagram.com/sinclairshotelsandresorts/' },
  { label: 'Twitter', href: 'https://www.twitter.com/sinclairshotels' },
] as const;

export const primaryNav = [
  { label: 'Home', href: '/' },
  { label: 'Hotels', href: '/hotels' },
  { label: 'Meetings', href: '/meetings-events' },
  { label: 'Weddings', href: '/weddings' },
  { label: 'Media', href: '/media' },
  { label: 'Enquire Now', href: '/enquiry' },
  { label: 'Contact', href: '/contact' },
] as const;

// Ported from the legacy site's /media press list. Yangang-specific mentions are
// dropped — it was a since-departed boutique property, not one of the current 9 — and
// none of these link back to the legacy domain's own hosted PDF/JPG clippings (this
// repo doesn't hotlink WordPress); only the two Telegraph pieces with a locally
// re-hosted photo, and the one mention on a genuine third-party outlet, carry a link.
export const pressMentions = [
  {
    date: 'July 2023',
    outlet: 'The Telegraph',
    title: 'Sinclairs Gangtok that offers amazing ambience with bespoke hospitality',
    image: '/images/press/gangtok-telegraph.webp',
  },
  {
    date: 'July 2023',
    outlet: 'The Telegraph',
    title: 'Glimpse of Sinclairs Retreat situated amid the lush green hilltops of Chalsa, Dooars',
    image: '/images/press/dooars-telegraph.webp',
  },
  {
    date: 'February 2023',
    outlet: 'Curly Tales India',
    title: '7 Best Resorts In Darjeeling For A Relaxing, Beautiful Stay At The Queen Of Hills',
    url: 'https://curlytales.com/best-resorts-in-darjeeling-for-a-relaxing-beautiful-stay-at-the-queen-of-hills/',
  },
  {
    date: 'June 2022',
    outlet: 'The New Indian Express',
    title: '7 Sinclairs properties bag Travellers Choice Award',
  },
  {
    date: 'June 2022',
    outlet: 'IIFL',
    title:
      'Seven Sinclairs properties bag the TripAdvisor Travellers Choice Award, rank among top 10% of hotels worldwide',
  },
  {
    date: 'June 2022',
    outlet: 'Hotelier India',
    title: 'Seven Sinclairs properties bag the TripAdvisor Travellers Choice Award',
  },
  {
    date: 'November 2020',
    outlet: 'Times of India',
    title: 'A new boutique hotel opens in Gangtok after Covid delays',
  },
  {
    date: 'November 2020',
    outlet: 'Business Standard',
    title: 'Sinclairs Hotels launches its eighth property at Gangtok, Sikkim',
  },
  {
    date: 'November 2020',
    outlet: 'Hospitality Biz',
    title: 'Sinclairs Hotels announces launch of Sinclairs Gangtok',
  },
  {
    date: 'November 2020',
    outlet: 'Projects Today',
    title: 'Sinclairs Hotels announces launch of Sinclairs Gangtok',
  },
  {
    date: 'November 2020',
    outlet: 'Hotelier India',
    title: 'Sinclairs Hotels launches its 8th property at Gangtok, Sikkim',
  },
  {
    date: 'November 2020',
    outlet: 'Global News Network of India',
    title: 'Sinclairs Hotels announces launch of Sinclairs Gangtok, the 8th property in the chain',
  },
  {
    date: 'August 2020',
    outlet: 'Mystic East',
    title:
      'Exclusive interview — Mr Suchanti shares his success mantra of building the brand Sinclairs',
  },
  {
    date: 'August 2020',
    outlet: 'The Hotel Times',
    title: "Three properties of Sinclairs Hotels win TripAdvisor 2020 Travellers' Choice Award",
  },
] as const;

// Verbatim from the legacy site's own fraud-alert notice (the linked PDF itself is
// broken even on the live site, so the notice text — the part that was ever
// guest-facing — is what's ported, not a re-hosted file).
export const fraudAlert =
  "Some entities are fraudulently using our brand name, along with our address. They are offering rooms at our hotels and resorts and collecting payment in fake bank accounts to cheat you. Our official hotel website is www.sinclairshotels.com — please double-check the website address before engaging, and ensure it's www.sinclairshotels.com to avoid scams. We are NOT responsible for losses incurred on fake websites. In case of any doubts, please call our Senior Reservation Manager (98305 56333) or mail us at kolkata@sinclairshotels.com.";

// The legacy voucher tool's full booking-office directory (per-office address/GSTIN)
// lived in a database table this migration hasn't pulled yet — only the head office,
// using contact details already verified elsewhere in this repo (components/footer.tsx),
// is listed here for now. Add real offices as that data is retrieved.
export const bookingOffices: BookingOffice[] = [
  {
    name: 'Sinclairs Hotels — Head Office',
    city: 'Kolkata',
    phone: '1800 120 267 000',
    email: 'reservations@sinclairshotels.com',
  },
];
