import { ClosingCta } from '@/components/closing-cta';
import { EditorialRow } from '@/components/editorial-row';
import { HotelCard } from '@/components/hotel-card';
import { hotels as contentHotels } from '@/content/hotels';
import { currentOverrides, photoUrl, withPhotos } from '@/lib/photos';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = pageMetadata({
  title: 'Our Hotels',
  description: 'Explore Sinclairs Hotels & Resorts properties across India.',
  path: '/hotels',
  image: '/images/hotels/port-blair/destination/SinclairsBayviewAerielView.webp',
});

const milestones = [
  { year: '1971', label: 'Founded in Kolkata' },
  { year: '1976', label: 'First Hotel Opens in Siliguri' },
  { year: '1986', label: 'Listed on the Stock Exchange' },
  { year: 'Today', label: `${contentHotels.length} Destinations Across India` },
];

export const revalidate = 600;

export default async function HotelsPage() {
  const overrides = await currentOverrides();
  const hotels = withPhotos(contentHotels, overrides);

  return (
    <div>
      <section className="relative flex h-[62vh] min-h-[440px] items-end overflow-hidden">
        <div className="absolute inset-0 animate-hero-zoom">
          <Image
            src={photoUrl(
              '/images/hotels/port-blair/destination/SinclairsBayviewAerielView.webp',
              overrides,
            )}
            alt="Sinclairs Bayview perched on a coastal headland above the Bay of Bengal"
            fill
            priority
            className="object-cover"
            sizes="100vw"
            quality={90}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/95 via-forest-dark/55 to-forest-dark/20" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-14 text-cream">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <p className="text-[0.65rem] uppercase tracking-[0.15em] text-cream drop-shadow-md sm:whitespace-nowrap sm:text-xs sm:tracking-[0.4em]">
                Our Properties
              </p>
            </div>
            <h1 className="mt-5 font-display text-5xl drop-shadow-lg sm:text-6xl">
              Hotels &amp; Resorts
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-cream/85">
              {hotels.length} destinations across the Himalayas, the Dooars, the Nilgiris,
              Rajasthan, and the Andamans — each with its own character and charm.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-forest/5">
        <EditorialRow
          title="A Legacy Since 1971"
          body="Sinclairs Hotels &amp; Resorts was founded in 1971 by Kolkata entrepreneur H.C. Suchanti, opening its first hotel in Siliguri in 1976 and a second in the hills of Darjeeling in 1981. The company went public in 1986, listing on the Bombay and Calcutta Stock Exchanges. Since 1990, under the stewardship of the Suchanti family, the group has grown from those early Himalayan beginnings into nine destinations spanning the Dooars, the Nilgiris, Rajasthan and the Andaman Islands — each still built around the same promise of comfortable, well-run hospitality in some of India's most memorable places."
          image={photoUrl(
            '/images/hotels/darjeeling/dining/Sinclairs Darjeeling Lobby.webp',
            overrides,
          )}
          alt="A colonial-style lounge at Sinclairs Darjeeling, one of the group's earliest properties"
          imageSide="right"
        />
        <div className="mx-auto max-w-5xl px-6 pb-16">
          <div className="grid grid-cols-2 gap-8 border-t border-forest/10 pt-10 sm:grid-cols-4">
            {milestones.map((milestone) => (
              <div key={milestone.label} className="text-center">
                <p className="font-display text-2xl text-forest">{milestone.year}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-ink/60">
                  {milestone.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10 sm:py-16">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {hotels.map((hotel) => (
            <HotelCard key={hotel.slug} hotel={hotel} />
          ))}
        </div>
      </div>

      <ClosingCta
        image={photoUrl(
          '/images/hotels/darjeeling/amenities/Sinclairs Darjeeling Kanchenjunga view.webp',
          overrides,
        )}
        heading="Find Your Sinclairs"
        body="Share your travel dates and preferred destination, and our reservations team will help you choose the right property."
        href="/contact"
      />
    </div>
  );
}
