import { ExploreGrid } from '@/components/explore-grid';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';
import type { Hotel } from '@/content/types';
import { exploreEntries } from '@/lib/sightseeing';

export function ExploreSection({ hotel }: { hotel: Hotel }) {
  if (hotel.sightseeing.length === 0) return null;

  return (
    <section id="explore" className="scroll-mt-32 py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Nearby"
            title={`Explore ${hotel.location}`}
            lede={`What the ${hotel.name} team sends guests out to see, in the order they recommend it. Distances and times are by road, estimated from the hotel.`}
          />
        </Reveal>

        <div className="mt-10">
          <ExploreGrid spots={exploreEntries(hotel)} />
        </div>
      </div>
    </section>
  );
}
