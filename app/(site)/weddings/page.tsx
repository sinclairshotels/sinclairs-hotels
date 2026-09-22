import { ClosingCta } from '@/components/closing-cta';
import { HeroCarousel } from '@/components/hero-carousel';
import { SectionHeading } from '@/components/section-heading';
import {
  CakeIcon,
  CameraIcon,
  CateringIcon,
  FlowerIcon,
  HeartIcon,
  MusicIcon,
} from '@/components/service-icons';
import { VenueDirectory } from '@/components/venue-directory';
import { WeddingVenueCard } from '@/components/wedding-venue-card';
import { hotels as contentHotels } from '@/content/hotels';
import { currentOverrides, photoUrl, withPhotos } from '@/lib/photos';
import { pageMetadata } from '@/lib/seo';
import { totalEventSpaces, venuesByHotel } from '@/lib/venues';
import type { Metadata } from 'next';
import Image from 'next/image';

const heroImages = [
  '/images/weddings/Wedding-Portrait.webp',
  '/images/hotels/udaipur/weddings/A Royal Fairytale.webp',
  '/images/weddings/Wedding-Lattice.webp',
];

const moments = [
  {
    title: 'Memorable Weddings',
    hook: 'Green lawns, poolside portraits, terrace cocktails — indoors or out, exclusively yours.',
    image: '/images/hotels/darjeeling/weddings/Haldi.webp',
    alt: 'Haldi ceremony celebrations at Sinclairs Darjeeling',
  },
  {
    title: 'Help Us Plan Your Day',
    hook: 'An in-house team, curated partners, and a menu crafted just for you.',
    image: '/images/weddings/Mehendi.webp',
    alt: 'Mehendi ceremony decor at a Sinclairs wedding',
  },
  {
    title: 'A Tasteful Wedding Menu',
    hook: 'A symphony of flavours from across India, plated with care.',
    image: '/images/hotels/burdwan/weddings/wedding feast.webp',
    alt: 'A wedding feast laid out at Sinclairs Burdwan',
  },
  {
    title: 'Lavish Stays',
    hook: 'Spacious suites and plush interiors for you and every guest.',
    image: '/images/hotels/darjeeling/accommodations/kanchenjunga-room/Kanchenjunga Room 1.webp',
    alt: 'The Kanchenjunga Room at Sinclairs Darjeeling, with panoramic mountain views',
  },
];

export const metadata: Metadata = pageMetadata({
  title: 'Weddings',
  description: 'Celebrate your wedding at a Sinclairs property, from the mountains to the coast.',
  path: '/weddings',
  image: '/images/weddings/Wedding-Portrait.webp',
});

const occasions = [
  'Roka',
  'Mehendi',
  'Haldi',
  'Sangeet',
  'Bridal Shower',
  'Wedding Ceremony',
  'Reception',
  'Renewal of Vows',
  'Honeymoon',
];

const services = [
  { label: 'Photos and Video', icon: CameraIcon },
  { label: 'Wedding Floral Décor', icon: FlowerIcon },
  { label: 'Catering', icon: CateringIcon },
  { label: 'Live Music and DJ', icon: MusicIcon },
  { label: 'Wedding Cake', icon: CakeIcon },
  { label: 'Honeymoon Planning', icon: HeartIcon },
];

const weddingHotelSlugs = contentHotels.filter((hotel) => hotel.weddings);
const totalVenues = totalEventSpaces(contentHotels);
const totalSqFt = contentHotels.reduce((sum, h) => sum + (h.eventSpaces?.totalSqFt ?? 0), 0);
const largestCapacity = Math.max(...contentHotels.map((h) => h.eventSpaces?.maxCapacity ?? 0));

const stats = [
  { value: String(totalVenues), label: 'Banquet Venues' },
  { value: totalSqFt.toLocaleString('en-IN'), label: 'Sq Ft of Event Space' },
  { value: largestCapacity.toLocaleString('en-IN'), label: 'Capacity, Largest Venue' },
  { value: String(weddingHotelSlugs.length), label: 'Wedding Destinations' },
];

export const revalidate = 600;

export default async function WeddingsPage() {
  const overrides = await currentOverrides();
  const hotels = withPhotos(contentHotels, overrides);
  const weddingHotels = hotels.filter((hotel) => hotel.weddings);
  const heroes = heroImages.map((src) => photoUrl(src, overrides));
  const shownMoments = moments.map((moment) => ({
    ...moment,
    image: photoUrl(moment.image, overrides),
  }));

  return (
    <div>
      <section className="relative flex h-[72vh] min-h-[480px] items-end overflow-hidden">
        <HeroCarousel images={heroes} alt="Weddings at Sinclairs Hotels &amp; Resorts" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/95 via-forest-dark/50 to-forest-dark/15" />
        <div className="pointer-events-none absolute inset-4 border border-cream/25 sm:inset-8" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-16 text-cream">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <p className="text-[0.65rem] uppercase tracking-[0.15em] text-cream drop-shadow-md sm:whitespace-nowrap sm:text-xs sm:tracking-[0.4em]">
                Legendary Weddings
              </p>
            </div>
            <h1 className="mt-5 font-display text-4xl leading-[1.1] sm:text-6xl sm:leading-[1.05] lg:text-7xl">
              Unforgettable Elegance,
              <br />
              <span className="italic text-gold-light">Timeless Style</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cream/85">
              Your moment, your way — where happily ever after begins. At Sinclairs, we promise a
              memorable wedding experience across our event locations, from secluded retreats and
              mountain towns to sea getaways.
            </p>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-10 w-full max-w-5xl px-4">
        <div className="grid grid-cols-2 gap-6 rounded-xl bg-white px-6 py-6 shadow-2xl sm:grid-cols-4 sm:gap-8 sm:px-10">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-3xl text-forest">{stat.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-ink/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-4">
            {shownMoments.map((moment, i) => (
              <div key={moment.title} className={i % 2 === 1 ? 'sm:mt-10' : ''}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-sm">
                  <Image
                    src={moment.image}
                    alt={moment.alt}
                    fill
                    sizes="(min-width: 640px) 23vw, 45vw"
                    className="transform-gpu object-cover"
                  />
                </div>
                <div className="mt-3">
                  <span className="font-display text-lg text-gold/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-0.5 font-display text-base text-forest">{moment.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink/70">{moment.hook}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-forest/10 bg-white py-12">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            align="center"
            eyebrow="Where"
            title="Wedding Destinations"
            lede="From Himalayan hilltops to a Rajasthani palace to an oceanfront in the Andamans — nine settings, each with its own character."
          />
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {weddingHotels.map((hotel) => (
              <WeddingVenueCard key={hotel.slug} hotel={hotel} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            align="center"
            eyebrow="Every Room, Every Property"
            title="All Our Venues"
            lede="The full list, so you can find the one room that seats your guest list without opening nine pages."
          />
          <div className="mt-10">
            <VenueDirectory groups={venuesByHotel(hotels)} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <SectionHeading align="center" title="Wedding Events" />
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-loose text-ink/70">
          {occasions.map((occasion, i) => (
            <span key={occasion}>
              {occasion}
              {i < occasions.length - 1 && <span className="mx-3 text-gold/50">&middot;</span>}
            </span>
          ))}
        </p>

        <SectionHeading align="center" className="mt-14" title="Our Services" />
        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          {services.map((service) => (
            <div key={service.label} className="flex items-center gap-2.5">
              <service.icon className="h-5 w-5 shrink-0 stroke-current fill-none stroke-2 text-gold" />
              <span className="text-sm text-ink/80">{service.label}</span>
            </div>
          ))}
        </div>
      </section>

      <ClosingCta
        image={photoUrl('/images/weddings/Wedding-Portrait.webp', overrides)}
        heading="Contact Us, We Are Happy to Help"
        body="Share your wedding dates, guest count, and preferred property, and our events team will reach out with options."
        href="/contact?type=wedding"
      />
    </div>
  );
}
