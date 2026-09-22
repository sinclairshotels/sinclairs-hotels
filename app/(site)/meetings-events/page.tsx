import { BusinessIcon, SightseeingIcon } from '@/components/amenity-icon';
import { ClosingCta } from '@/components/closing-cta';
import { MeetingVenueCard } from '@/components/meeting-venue-card';
import { SectionHeading } from '@/components/section-heading';
import { CateringIcon } from '@/components/service-icons';
import { hotels as contentHotels } from '@/content/hotels';
import { hotelSlots } from '@/lib/photo-slots';
import { currentOverrides, photoUrl, withPhotos } from '@/lib/photos';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = pageMetadata({
  title: 'Meetings & Events',
  description: 'Host your next business gathering or conference at a Sinclairs property.',
  path: '/meetings-events',
  image: '/images/hotels/kalimpong/amenities/The Orchid 1.webp',
});

const features = [
  {
    title: 'Versatile Venues',
    description:
      'Our hotels have a variety of event spaces to meet your needs. Thoughtfully designed, each space offers exclusivity and access to the latest technology.',
    icon: BusinessIcon,
    image: '/images/hotels/dooars/amenities/The Iris Hall 1 (2).webp',
    alt: 'The Iris Hall dressed in banquet style, opening onto the gardens',
  },
  {
    title: 'Bespoke Menus',
    description:
      'Our culinary team crafts special menus featuring Indian and local cuisines, together with thoughtful service, to ensure a seamless event.',
    icon: CateringIcon,
    image: '/images/hotels/gangtok/dining/RestaurantBuffet2.webp',
    alt: 'A lavish catering spread, freshly laid',
  },
  {
    title: 'Team Building Activities',
    description:
      'Between meetings, we organise tours around town — from monasteries to lakes and mountains — helping you experience each destination at its best.',
    icon: SightseeingIcon,
    image: '/images/hotels/gangtok/explore/Gangtok Tsogmo Lake.webp',
    alt: 'Tsomgo Lake, a popular excursion near Sinclairs Gangtok',
  },
];

const venueHotelCount = contentHotels.filter((hotel) => hotel.eventSpaces).length;
const totalVenues = contentHotels.reduce((sum, h) => sum + (h.eventSpaces?.venues.length ?? 0), 0);
const totalSqFt = contentHotels.reduce((sum, h) => sum + (h.eventSpaces?.totalSqFt ?? 0), 0);
const largestCapacity = Math.max(...contentHotels.map((h) => h.eventSpaces?.maxCapacity ?? 0));

const stats = [
  { value: String(totalVenues), label: 'Conference Venues' },
  { value: totalSqFt.toLocaleString('en-IN'), label: 'Sq Ft of Event Space' },
  { value: largestCapacity.toLocaleString('en-IN'), label: 'Capacity, Largest Venue' },
  { value: String(venueHotelCount), label: 'Properties Nationwide' },
];

export const revalidate = 600;

export default async function MeetingsEventsPage() {
  const overrides = await currentOverrides();
  const venueHotels = contentHotels
    .map((hotel) => withPhotos(hotel, hotelSlots(hotel), overrides))
    .filter((hotel) => hotel.eventSpaces);
  const shownFeatures = features.map((feature, i) => ({
    ...feature,
    image: photoUrl(`meetings:feature:${i}`, feature.image, overrides),
  }));

  return (
    <div>
      <section className="relative flex h-[58vh] min-h-[400px] items-end overflow-hidden">
        <div className="absolute inset-0 animate-hero-zoom">
          <Image
            src={photoUrl(
              'meetings:hero',
              '/images/hotels/kalimpong/amenities/The Orchid 1.webp',
              overrides,
            )}
            alt="The Orchid, a banquet hall at Sinclairs Retreat Kalimpong, set up for a conference"
            fill
            priority
            className="object-cover"
            sizes="100vw"
            quality={90}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/95 via-forest-dark/50 to-forest-dark/15" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-16 text-cream">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <p className="text-[0.65rem] uppercase tracking-[0.15em] text-cream drop-shadow-md sm:whitespace-nowrap sm:text-xs sm:tracking-[0.4em]">
                Business &amp; Events
              </p>
            </div>
            <h1 className="mt-5 font-display text-4xl leading-[1.1] sm:text-5xl sm:leading-[1.1] lg:text-6xl">
              Where Business Meets
              <br />
              Impeccable Hospitality
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cream/85">
              Discover the ultimate blend of elegance, adaptability, and outstanding service when
              hosting your meetings and events at Sinclairs Hotels &amp; Resorts. Our dedicated team
              works closely with you every step of the way, from boardroom meetings to multi-day
              conferences.
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

      <section className="pt-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">Our Commitment</p>
          <p className="mt-4 text-base leading-relaxed text-ink/70">
            At Sinclairs Hotels, we focus on creativity and luxury. Host your events with us for
            organised, innovative, and flawless experiences — set against the backdrop of the
            mountains, forests, and heritage towns where our hotels are located.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-6 px-6 pb-16 sm:grid-cols-3">
          {shownFeatures.map((feature) => (
            <div
              key={feature.title}
              className="group overflow-hidden rounded-lg border border-forest/10 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative aspect-[3/2] overflow-hidden">
                <Image
                  src={feature.image}
                  alt={feature.alt}
                  fill
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="transform-gpu object-cover transition duration-700 group-hover:scale-110"
                />
              </div>
              <div className="p-5">
                <feature.icon className="h-6 w-6 stroke-current stroke-[1.6] text-gold" />
                <h3 className="mt-3 font-display text-lg text-forest">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-forest/10 bg-white py-12">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            align="center"
            eyebrow="Every Property"
            title="Conference &amp; Banquet Venues"
            lede="There are endless reasons to celebrate, and Sinclairs offers flexible meeting venues to make your event memorable — be it a corporate triumph, a milestone, or an offsite that feels like a getaway."
          />
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {venueHotels.map((hotel) => (
              <MeetingVenueCard key={hotel.slug} hotel={hotel} />
            ))}
          </div>
        </div>
      </section>

      <ClosingCta
        image={photoUrl(
          'meetings:closing',
          '/images/hotels/ooty/gallery/The Regal room.webp',
          overrides,
        )}
        heading="Plan Your Event"
        body="Tell us about your requirements and our sales team will get back to you with venue options and a quote."
        href="/contact?type=meetings"
      />
    </div>
  );
}
