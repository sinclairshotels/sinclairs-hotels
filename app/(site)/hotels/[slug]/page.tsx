import { getAmenityIcon } from '@/components/amenity-icon';
import { BookingWidget } from '@/components/booking-widget';
import { ClosingCta } from '@/components/closing-cta';
import { ContactLink } from '@/components/contact-link';
import { ExploreSection } from '@/components/explore-section';
import { FoodRating } from '@/components/food-rating';
import { GalleryLightbox } from '@/components/gallery-lightbox';
import { HeroCarousel } from '@/components/hero-carousel';
import { HotelViewTracking } from '@/components/hotel-view-tracking';
import { JsonLd } from '@/components/json-ld';
import { LocationMap } from '@/components/location-map';
import { MeetingsSection } from '@/components/meetings-section';
import { ReservationLink } from '@/components/reservation-link';
import { RoomImageCarousel } from '@/components/room-image-carousel';
import { SectionHeading } from '@/components/section-heading';
import { WeddingSection } from '@/components/wedding-section';
import { awards } from '@/content/awards';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { contactNumbers, siteConfig } from '@/content/site';
import { formatInr } from '@/lib/booking';
import { FROM_PRICE_DAYS, fromPricePerHotel } from '@/lib/from-price';
import { mapsEmbedEnabled } from '@/lib/maps';
import { hotelSlots } from '@/lib/photo-slots';
import { currentOverrides, withPhotos } from '@/lib/photos';
import { roomDisplayNames } from '@/lib/room-display';
import { formatRoomSize } from '@/lib/room-size';
import { pageMetadata } from '@/lib/seo';
import { eventSpaceCount } from '@/lib/venues';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return hotels.map((hotel) => ({ slug: hotel.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = getHotelBySlug(slug);
  if (!hotel) return {};
  return pageMetadata({
    title: hotel.name,
    description: `${hotel.tagline} Located in ${hotel.location}, ${hotel.state}.`,
    path: `/hotels/${hotel.slug}`,
    image: hotel.heroImage,
  });
}

const subNav = [
  { href: '#overview', label: 'Overview' },
  { href: '#rooms', label: 'Rooms' },
  { href: '#dining', label: 'Dining' },
  { href: '#weddings', label: 'Weddings' },
  { href: '#meetings', label: 'Meetings' },
  { href: '#gallery', label: 'Gallery' },
  { href: '#explore', label: 'Explore' },
  { href: '#location', label: 'Location' },
];

// Staff rename and retire rooms without a deploy, so the room list cannot be
// baked in at build time — but it changes rarely enough not to be dynamic.
export const revalidate = 600;

export default async function HotelPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const contentHotel = getHotelBySlug(slug);
  if (!contentHotel) notFound();

  const overrides = await currentOverrides();
  // Photos are the one content type staff change without a deploy, so the paths
  // the page renders come from here rather than straight from the content file.
  const hotel = withPhotos(contentHotel, hotelSlots(contentHotel), overrides);

  const fromPrice = (await fromPricePerHotel()).get(hotel.slug) ?? null;

  const display = await roomDisplayNames(hotel.slug);
  const visibleRooms = hotel.rooms
    .map((room) => {
      const staff = display.get(room.name);
      return {
        ...room,
        name: staff?.name ?? room.name,
        active: staff?.active ?? true,
        // Staff's figure wins where they have entered one; the content file is
        // the fallback, since that is where the seeded values came from.
        sizeSqFt: staff?.sizeSqFt ?? room.sizeSqFt ?? null,
      };
    })
    .filter((room) => room.active)
    .map((room) => ({ ...room, displayName: room.name }));

  const award = awards.find((a) => a.propertySlug === hotel.slug);
  const sections = subNav.filter((item) => {
    if (item.href === '#weddings') return Boolean(hotel.weddings);
    if (item.href === '#meetings') return Boolean(hotel.meetings && hotel.eventSpaces);
    if (item.href === '#gallery') return hotel.gallery.length > 0;
    if (item.href === '#explore') return hotel.sightseeing.length > 0;
    if (item.href === '#location') return Boolean(hotel.contact);
    return true;
  });

  const hotelJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: hotel.name,
    description: hotel.description,
    url: `${siteConfig.url}/hotels/${hotel.slug}`,
    image: `${siteConfig.url}${hotel.heroImage}`,
    ...(hotel.contact && { address: hotel.contact.address }),
    telephone: contactNumbers.tollFree,
    amenityFeature: hotel.amenities.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
    })),
    // Only stated when a rate is actually loaded. An Offer quoting a price the
    // engine would not sell is worse than no Offer: Google shows it, a guest
    // clicks it, and the search returns something else.
    ...(fromPrice !== null && {
      priceRange: `From ${formatInr(fromPrice)} per night`,
      makesOffer: {
        '@type': 'Offer',
        name: 'Room Only',
        availability: 'https://schema.org/InStock',
        url: `${siteConfig.url}/book/${hotel.slug}`,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: fromPrice,
          priceCurrency: 'INR',
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: 1,
            unitCode: 'DAY',
          },
        },
      },
    }),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
      { '@type': 'ListItem', position: 2, name: 'Hotels', item: `${siteConfig.url}/hotels` },
      {
        '@type': 'ListItem',
        position: 3,
        name: hotel.name,
        item: `${siteConfig.url}/hotels/${hotel.slug}`,
      },
    ],
  };

  return (
    <div>
      <JsonLd data={hotelJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <HotelViewTracking slug={hotel.slug} name={hotel.name} />
      <section className="relative flex h-[72vh] min-h-[480px] items-end">
        {hotel.heroGallery?.length ? (
          <HeroCarousel images={hotel.heroGallery} alt={hotel.name} />
        ) : (
          <Image
            src={hotel.heroImage}
            alt={hotel.name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
            quality={90}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/95 via-forest-dark/50 to-forest-dark/15" />
        {award && (
          <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-lg">
            <div className="relative h-8 w-8 shrink-0">
              <Image src={award.badgeImage} alt="" fill sizes="32px" className="object-contain" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wide text-forest-dark">
              Travellers&rsquo; Choice 2026
            </span>
          </div>
        )}
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-10 text-cream">
          <p className="text-xs uppercase tracking-[0.15em] text-cream drop-shadow-md sm:text-sm sm:tracking-[0.3em]">
            {hotel.location}, {hotel.state}
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-5xl lg:text-6xl">
            {hotel.name}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-cream/85">{hotel.tagline}</p>
        </div>
      </section>

      {/* The same bar as the home page, with the property already answered —
          a guest who has chosen where to stay should not be asked again. */}
      <div className="relative z-10 mx-auto -mt-10 w-full max-w-5xl px-4">
        <BookingWidget hotels={hotels} hotel={hotel.slug} ctaSource="hotel_page_widget" />
      </div>

      <div className="relative z-10 mx-auto mt-6 w-full max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl bg-white px-6 py-5 shadow-xl sm:gap-10">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <Stat value={String(visibleRooms.length)} label="Room Types" />
            <Stat value={String(hotel.dining.length)} label="Dining Venues" />
            {hotel.eventSpaces && (
              <Stat value={String(eventSpaceCount(hotel))} label="Event Spaces" />
            )}
            <Stat value={String(hotel.amenities.length)} label="Amenities" />
            {fromPrice !== null && (
              <Stat value={`From ${formatInr(fromPrice)}`} label="Per Night" />
            )}
          </div>
          <ReservationLink
            ctaSource="hotel_stat_bar"
            params={{ hotel: hotel.slug }}
            item={{ slug: hotel.slug, name: hotel.name }}
            className="rounded bg-gold px-6 py-3 text-sm uppercase tracking-wider text-forest-dark transition hover:bg-gold-light"
          >
            Check Availability
          </ReservationLink>
        </div>
      </div>

      <nav className="sticky top-16 z-30 mt-10 border-y border-forest/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-6 py-3 text-sm">
          {sections.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="shrink-0 text-ink/70 transition hover:text-forest"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <section id="overview" className="mx-auto max-w-7xl scroll-mt-32 px-6 py-10 sm:py-16">
        <SectionHeading eyebrow="The Property" title="Overview" />
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-ink/80">{hotel.description}</p>

        {hotel.history && (
          <div className="mt-8 max-w-3xl rounded-lg border-l-4 border-gold bg-forest/5 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">Heritage</p>
            <p className="mt-3 font-display text-lg italic leading-relaxed text-forest">
              {hotel.history}
            </p>
          </div>
        )}

        {hotel.amenities.length > 0 && (
          <div className="mt-14">
            <SectionHeading title="Amenities" />
            <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              {hotel.amenities.map((amenity) => {
                const Icon = getAmenityIcon(amenity);
                return (
                  <li key={amenity} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 stroke-current stroke-[1.6] text-gold" />
                    <span className="min-w-0 text-sm text-ink/80">{amenity}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {visibleRooms.length > 0 && (
        <section
          id="rooms"
          className="scroll-mt-32 border-y border-forest/10 bg-white py-10 sm:py-16"
        >
          <div className="mx-auto max-w-7xl px-6">
            <SectionHeading
              eyebrow="Where You Stay"
              title="Rooms &amp; Suites"
              lede={`Every room at ${hotel.name}, with the detail to choose between them.`}
            />
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRooms.map((room) => (
                <div
                  key={room.name}
                  className="group flex flex-col overflow-hidden rounded-lg bg-cream shadow-sm transition hover:shadow-lg"
                >
                  <RoomImageCarousel
                    images={room.images?.length ? room.images : [hotel.heroImage]}
                    alt={room.name}
                  />
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-lg text-forest">{room.displayName}</h3>
                    {formatRoomSize(room.sizeSqFt) ? (
                      <p className="mt-1 text-xs tracking-wide text-ink/50">
                        {formatRoomSize(room.sizeSqFt)}
                      </p>
                    ) : null}
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
                      {room.description}
                    </p>
                    <ReservationLink
                      ctaSource="hotel_room_card"
                      params={{ hotel: hotel.slug, room: room.displayName }}
                      item={{ slug: hotel.slug, name: hotel.name, variant: room.displayName }}
                      className="mt-5 block rounded bg-forest-dark py-2.5 text-center text-xs uppercase tracking-wider text-cream transition hover:bg-forest"
                    >
                      Book Now
                    </ReservationLink>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {hotel.dining.length > 0 && (
        <section id="dining" className="scroll-mt-32 bg-forest-dark py-10 sm:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <SectionHeading
              tone="dark"
              eyebrow="Restaurants &amp; Bars"
              title={`Dining at ${hotel.name}`}
              lede="Signature venues for every hour of the day, from a fresh multi-cuisine table to an evening drink with a view."
            />
            <FoodRating hotelName={hotel.name} />
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {hotel.dining.map((venue, i) => (
                <div
                  key={venue.name}
                  className="group overflow-hidden rounded-lg bg-forest shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <div className="relative">
                    <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
                    <RoomImageCarousel
                      images={venue.images?.length ? venue.images : [hotel.heroImage]}
                      alt={venue.name}
                      aspectClassName="aspect-[16/11]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-forest-dark/80 via-transparent to-transparent" />
                    <span className="pointer-events-none absolute left-3 top-3 font-display text-xs text-cream/70">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg text-gold-light">{venue.name}</h3>
                    <div className="mt-2 h-px w-8 bg-gold/50" />
                    <p className="mt-3 text-sm leading-relaxed text-cream/75">
                      {venue.description}
                    </p>
                    {venue.openingHours ? (
                      <p className="mt-3 text-xs text-cream/60">
                        <span className="uppercase tracking-wider text-gold-light/80">
                          Opening hours
                        </span>{' '}
                        {venue.openingHours.split(' · ').map((sitting, s) => (
                          <span key={sitting} className="whitespace-nowrap">
                            {s > 0 ? ' · ' : ''}
                            {sitting}
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {hotel.foodGallery && hotel.foodGallery.length > 0 && (
        <section className="border-b border-forest/10 bg-forest-dark py-10 sm:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <SectionHeading
              tone="dark"
              eyebrow="Culinary Journey"
              title={`Food & Dining at ${hotel.name}`}
              lede="A daily table of fresh, chef-plated Indian, Continental and Oriental fare — from sunrise breakfasts to candlelit evenings."
            />
            <div className="mt-10">
              <GalleryLightbox images={hotel.foodGallery} />
            </div>
          </div>
        </section>
      )}

      <WeddingSection hotel={hotel} />
      <MeetingsSection hotel={hotel} />

      {hotel.gallery.length > 0 && (
        <section id="gallery" className="scroll-mt-32 py-10 sm:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <SectionHeading
              eyebrow="In Pictures"
              title="Gallery"
              lede={`The facade, the pool, the lounges — a closer look at ${hotel.name}.`}
            />
            <div className="mt-10">
              <GalleryLightbox images={hotel.gallery} />
            </div>
          </div>
        </section>
      )}

      <ExploreSection hotel={hotel} />

      {hotel.contact && (
        <section id="location" className="scroll-mt-32 py-10 sm:py-16">
          <div className="mx-auto max-w-7xl px-6">
            <SectionHeading eyebrow="Finding Us" title="Location &amp; Contact" />
            <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
              <div>
                {hotel.contact && (
                  <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink/50">Location</dt>
                      <dd className="mt-2 text-sm leading-relaxed text-ink/80">
                        {hotel.contact.address}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink/50">Reservations</dt>
                      <dd className="mt-2 text-sm text-ink/80">
                        <ContactLink
                          method="phone"
                          href={contactNumbers.tollFreeHref}
                          ctaSource="hotel_page"
                          hotel={hotel.slug}
                          className="hover:text-forest"
                        >
                          {contactNumbers.tollFree}
                        </ContactLink>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs uppercase tracking-wider text-ink/50">Enquiries</dt>
                      <dd className="mt-2 text-sm text-ink/80">
                        <Link
                          href={`/contact?property=${hotel.slug}&type=hotel`}
                          className="border-b border-gold pb-0.5 hover:text-forest"
                        >
                          Send an enquiry
                        </Link>
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
              {hotel.contact && (
                <LocationMap
                  address={hotel.contact.address}
                  query={`${hotel.name}, ${hotel.location}, ${hotel.state}`}
                  embedUrl={hotel.mapEmbedUrl}
                  title={`Map showing ${hotel.name}`}
                  enabled={mapsEmbedEnabled()}
                />
              )}
            </div>
          </div>
        </section>
      )}

      <ClosingCta
        image={hotel.heroImage}
        heading={fromPrice !== null ? `Stay from ${formatInr(fromPrice)}` : `Stay at ${hotel.name}`}
        body={
          fromPrice !== null
            ? `The lowest room-only rate at ${hotel.name} over the next ${FROM_PRICE_DAYS} days. Pick your dates to see what is available.`
            : 'Tell us your dates and our reservations team will come back to you with availability and rates.'
        }
        href={
          fromPrice !== null ? `/book/${hotel.slug}` : `/contact?property=${hotel.slug}&type=hotel`
        }
        cta={fromPrice !== null ? 'Check Availability' : undefined}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-2xl text-forest">{value}</p>
      <p className="whitespace-nowrap text-xs uppercase tracking-wider text-ink/50">{label}</p>
    </div>
  );
}
