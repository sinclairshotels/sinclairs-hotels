import type { BookingOffice } from './types';

export const siteConfig = {
  name: 'Sinclairs Hotels & Resorts',
  shortName: 'Sinclairs',
  description:
    'A collection of hotels and resorts across India, designed for the value traveller — affordable comfort without compromising on cleanliness, service, or character.',
  url: 'https://www.sinclairshotels.com',
};

// The only two numbers the site publishes. Properties have their own lines, but
// a guest is never sent to one: a call goes to reservations and everything else
// goes through the enquiry form, so there is nowhere for a per-property number
// to drift back onto a page from.
// The one thing a guest gets for booking here rather than through an agent,
// stated in the same words everywhere it appears: the hero, the room list, the
// booking page, the confirmation email and the printed voucher. One constant so
// those five can never drift into five slightly different promises.
export const directBookingPerk = {
  short: 'Late check-out until 1 pm, subject to availability · Best rate guaranteed',
  long: 'Late check-out until 1 pm, subject to availability, and the best rate guaranteed — on every direct booking.',
  // Listed separately where there is room to set them out, because they are two
  // different promises: one is a favour the property may not be able to grant
  // on a full day, the other is unconditional.
  items: ['Late check-out until 1 pm, subject to availability', 'Best rate guaranteed'],
} as const;

// Check-in and check-out are not the same across the estate, so a booking
// cannot state one pair for all nine. These are the published times, read off
// the Terms and Conditions in content/legal.ts — that prose is the source, this
// is the same thing in a shape a page can render. Change both together.
//
// Both are the property's standard times. The direct-booking promise is now a
// late check-out until 1 pm rather than an early check-in, so check-in here is
// simply what it is and check-out is the time a stay ends without one.
export const stayTimes: Record<string, { checkIn: string; checkOut: string }> = {
  siliguri: { checkIn: '12 noon', checkOut: '11 am' },
  burdwan: { checkIn: '12 noon', checkOut: '11 am' },
  darjeeling: { checkIn: '12 noon', checkOut: '11 am' },
  kalimpong: { checkIn: '12 noon', checkOut: '11 am' },
  dooars: { checkIn: '12 noon', checkOut: '10 am' },
  ooty: { checkIn: '12 noon', checkOut: '10 am' },
  'port-blair': { checkIn: '12 noon', checkOut: '10 am' },
  udaipur: { checkIn: '1 pm', checkOut: '11 am' },
  gangtok: { checkIn: '2 pm', checkOut: '12 noon' },
};

// Printed in the confirmation email's footer and on the contact page. A
// registered address is a legal identity, not marketing copy, so it is stated
// once rather than retyped per surface.
export const registeredOffice = {
  company: 'Sinclairs Hotels Limited',
  lines: ['Pressman House, 10A Lee Road', 'Kolkata 700020'],
} as const;

export const reservationsHours = '8 am – 10 pm IST, every day';

export const contactNumbers = {
  tollFree: '1800 120 267 000',
  tollFreeHref: 'tel:1800120267000',
  whatsapp: '+91 92571 08784',
  // Digits only, no +, which is the form wa.me takes. The displayed number
  // above is the same one spaced for reading; keep them in step.
  whatsappNumber: '919257108784',
} as const;

// An empty compose box asks the guest to introduce themselves before they have
// asked anything. This says who they are writing to and why, and they can
// delete it — a prefill is a starting point, not a script.
export const whatsappMessage = 'Hi Sinclairs Hotels, I would like to ask about a booking.';

export function whatsappHref(message: string = whatsappMessage): string {
  return `https://wa.me/${contactNumbers.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const socialLinks = [
  { label: 'Facebook', href: 'https://www.facebook.com/sinclairshotelsandresorts/' },
  { label: 'Instagram', href: 'https://www.instagram.com/sinclairshotelsandresorts/' },
  { label: 'Twitter', href: 'https://www.twitter.com/sinclairshotels' },
] as const;

// The top bar carries only what a guest is deciding between, with Book Now as
// the one CTA. Home is the logo, Media sits in the footer, and Enquire is gone
// as a destination of its own — /contact is the enquiry form now.
export const primaryNav = [
  { label: 'Hotels', href: '/hotels' },
  { label: 'Weddings', href: '/weddings' },
  { label: 'Meetings', href: '/meetings-events' },
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
  "Some entities are fraudulently using our brand name, along with our address. They are offering rooms at our hotels and resorts and collecting payment in fake bank accounts to cheat you. Our official hotel website is www.sinclairshotels.com — please double-check the website address before engaging, and ensure it's www.sinclairshotels.com to avoid scams. We are NOT responsible for losses incurred on fake websites. In case of any doubts, please call our Senior Reservation Manager (98305 56333) or send us an enquiry through this website.";

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
