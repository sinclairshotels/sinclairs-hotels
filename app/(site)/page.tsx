import { AwardsSection } from '@/components/awards-section';
import { BookDirect } from '@/components/book-direct';
import { BookingWidget } from '@/components/booking-widget';
import { DiningShowcase } from '@/components/dining-showcase';
import { ExperiencesCarousel } from '@/components/experiences-carousel';
import { HotelCard } from '@/components/hotel-card';
import { JourneyHero } from '@/components/journey-hero';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';
import { SpotlightGallery } from '@/components/spotlight-gallery';
import { awards } from '@/content/awards';
import { experiences } from '@/content/experiences';
import { hotels } from '@/content/hotels';
import { reviews } from '@/content/reviews';
import { diningPhotos } from '@/lib/dining';
import { fromPricePerHotel } from '@/lib/from-price';
import { totalEventSpaces } from '@/lib/venues';
import Image from 'next/image';
import Link from 'next/link';

const sightseeingPhotos = hotels.flatMap((hotel) =>
  hotel.sightseeing
    .filter((spot) => spot.image)
    .slice(0, 3)
    .map((spot) => ({
      src: spot.image as string,
      alt: `${spot.name}, near ${hotel.name} in ${hotel.location}`,
    })),
);

// The entry price comes from the rate rows, which staff change without a
// deploy, so the page is revalidated rather than frozen at build time.
export const revalidate = 600;

export default async function HomePage() {
  const fromPrices = await fromPricePerHotel();
  const [, , secondaryBottom] = hotels;
  const states = new Set(hotels.map((h) => h.state)).size;
  const totalDining = hotels.reduce((sum, h) => sum + h.dining.length, 0);
  const eventSpaces = totalEventSpaces(hotels);
  const largestCapacity = Math.max(...hotels.map((h) => h.eventSpaces?.maxCapacity ?? 0));

  const stats = [
    { value: String(hotels.length), label: 'Destinations' },
    { value: String(states), label: 'States Across India' },
    { value: String(totalDining), label: 'Restaurants & Bars' },
    { value: String(eventSpaces), label: 'Event Spaces' },
  ];

  return (
    <>
      <section className="relative h-[75vh] min-h-[620px] overflow-hidden">
        <JourneyHero
          slides={[...hotels]
            .sort((a, b) => (a.slug === 'burdwan' ? 1 : b.slug === 'burdwan' ? -1 : 0))
            .map((hotel) => ({
              image: hotel.heroImage,
              name: hotel.name,
              location: `${hotel.location}, ${hotel.state}`,
              slug: hotel.slug,
            }))}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/95 via-forest-dark/50 to-forest-dark/15" />
        <div className="absolute inset-x-0 bottom-0 pb-24 sm:pb-32">
          <div className="animate-fade-up mx-auto w-full max-w-7xl px-6 text-cream">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <p className="text-[0.65rem] uppercase tracking-[0.25em] text-cream drop-shadow-md sm:whitespace-nowrap sm:text-xs sm:tracking-[0.5em]">
                Business &amp; Leisure, Across India
              </p>
              <span className="hidden h-px w-10 bg-gold sm:block" />
            </div>
            <h1 className="mt-6 max-w-2xl font-display text-4xl leading-[1.1] drop-shadow-lg sm:text-6xl sm:leading-[1.05] lg:text-7xl">
              Your Oasis of{' '}
              <em className="font-normal italic text-gold-light drop-shadow-[0_2px_16px_rgba(189,148,85,0.55)]">
                Relaxation
              </em>{' '}
              Awaits
            </h1>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-10 w-full max-w-5xl px-4">
        <BookingWidget hotels={hotels} />
      </div>

      <section className="border-b border-forest/10 pb-10 pt-16 sm:pt-20">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 px-6 text-center sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-3xl text-forest">{stat.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-ink/50">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <BookDirect />

      <section className="bg-forest py-14 sm:py-20 text-cream">
        <Reveal className="mx-auto max-w-3xl px-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-gold" />
            <p className="text-xs uppercase tracking-[0.3em] text-gold-light">
              About Sinclairs Hotels
            </p>
            <span className="h-px w-10 bg-gold" />
          </div>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl">Your Oasis of Relaxation</h2>
          <p className="mt-6 text-base leading-relaxed text-cream/85">
            Sinclairs Hotels and Resorts is a collection of hotels across India, designed to meet
            the needs of the value traveller. Our hotels are located in select locations across
            India and offer affordable accommodations, without compromising on comfort and
            cleanliness. From breath-taking mountain getaways to destinations steeped in history,
            our hotels offer a variety of experiences, each with its own unique character and charm.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 sm:py-20">
        <Reveal className="mb-12">
          <SectionHeading
            align="center"
            eyebrow="Featured Properties"
            title="Hotels and Resorts"
            lede="Whether staying for business or leisure, discover our properties across India."
          />
        </Reveal>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {hotels.map((hotel, i) => (
            <Reveal key={hotel.slug} delay={(i % 3) * 80}>
              <HotelCard hotel={hotel} fromPrice={fromPrices.get(hotel.slug) ?? null} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-10">
        <Reveal className="mb-6">
          <SectionHeading
            align="center"
            eyebrow="Nearby Every Property"
            title="A World to Explore, Just Outside"
            lede="From misty tea gardens to royal forts, ancient monasteries to island beaches — a glimpse of what’s waiting near every Sinclairs address."
          />
        </Reveal>
        <SpotlightGallery images={sightseeingPhotos} />
      </section>

      <section className="border-y border-forest/10 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-10">
            <SectionHeading
              align="center"
              eyebrow="Signature Experiences"
              title="Memories that last a lifetime"
              lede="From misty mountain railways to island sunsets — unforgettable experiences await."
            />
          </Reveal>
          <ExperiencesCarousel experiences={experiences} />
        </div>
      </section>

      <section className="border-y border-forest/10 bg-forest-dark py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            tone="dark"
            eyebrow="Culinary Journey"
            title="A Journey of Delectable Flavours"
            lede="Every property cooks for its own place — a Bengali thali in Burdwan, thukpa in the hills, seafood off the Andaman coast. Open a hotel to see what it serves."
          />
          <div className="mt-10">
            <DiningShowcase entries={diningPhotos(hotels)} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <Reveal className="mb-10">
          <SectionHeading
            align="center"
            eyebrow="Celebrate With Us"
            title="Unforgettable Events and Weddings Await You"
            lede={`From an intimate boardroom to a ${largestCapacity.toLocaleString('en-IN')}-guest reception, every property comes with the venues, catering and service to match the occasion.`}
          />
        </Reveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="group overflow-hidden rounded-lg border border-forest/10 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="relative aspect-[16/11] overflow-hidden">
              <Image
                src="/images/hotels/darjeeling/amenities/Sinclairs-Darjeeling-Pinnacle-Setup-1.webp"
                alt="A conference set up in The Pinnacle banquet hall at Sinclairs Darjeeling"
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="transform-gpu object-cover transition duration-700 group-hover:scale-110"
              />
            </div>
            <div className="p-6">
              <h3 className="font-display text-xl text-forest">Events &amp; Conferences</h3>
              <p className="mt-2 text-sm text-ink/70">
                From planning to execution, our teams support you every step of the way.
              </p>
              <Link
                href="/meetings-events"
                className="mt-4 inline-block rounded bg-forest px-5 py-2 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark"
              >
                Learn More
              </Link>
            </div>
          </div>
          <div className="group overflow-hidden rounded-lg border border-forest/10 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="relative aspect-[16/11] overflow-hidden">
              <Image
                src="/images/weddings/Wedding-Portrait.webp"
                alt="A wedding celebration at a Sinclairs property"
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="transform-gpu object-cover transition duration-700 group-hover:scale-110"
              />
            </div>
            <div className="p-6">
              <h3 className="font-display text-xl text-forest">Weddings</h3>
              <p className="mt-2 text-sm text-ink/70">
                Host your dream wedding at our hotel — we&apos;ll handle the details so you can
                enjoy your day.
              </p>
              <Link
                href="/weddings"
                className="mt-4 inline-block rounded bg-forest px-5 py-2 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-forest/5 py-10 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="Recognised Excellence"
              title="Awards and Recognitions"
              lede="Six of our properties have been honoured with Tripadvisor’s Travellers’ Choice Award 2026, ranking among the top hotels reviewed by travellers worldwide."
            />
          </Reveal>
          <Reveal className="mt-8 sm:mt-12" delay={150}>
            <AwardsSection awards={awards} reviews={reviews} />
          </Reveal>
        </div>
      </section>

      <section className="relative flex h-[42vh] min-h-[320px] items-center justify-center overflow-hidden">
        {secondaryBottom && (
          <div className="absolute inset-0 animate-hero-zoom">
            <Image
              src={secondaryBottom.heroImage}
              alt=""
              fill
              sizes="100vw"
              quality={90}
              className="object-cover"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-forest-dark/75" />
        <div className="relative px-6 text-center text-cream">
          <h2 className="font-display text-3xl sm:text-4xl">Ready for Your Escape?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-cream/80">
            Share your travel dates and let our reservations team find the perfect stay for you.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded bg-gold px-7 py-3 text-sm uppercase tracking-wider text-forest-dark transition hover:bg-gold-light"
          >
            Enquire Now
          </Link>
        </div>
      </section>
    </>
  );
}
