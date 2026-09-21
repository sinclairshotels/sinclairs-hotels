'use client';

import { Lightbox } from '@/components/lightbox';
import type { SightseeingSpot } from '@/content/types';
import Image from 'next/image';
import { useState } from 'react';

// The order in the content file is the order the property recommends, so spots
// render in it. Splitting the photo-less ones into a separate row (as this did
// before) moved them away from the places they sit beside — Darjeeling's Lloyd
// Botanical Garden landed at the bottom of the section, six spots from where it
// belongs.
export function ExploreGrid({ spots }: { spots: SightseeingSpot[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const photos = spots
    .filter((spot) => spot.image)
    .map((spot) => ({ src: spot.image as string, alt: spot.name }));
  const photoIndex = new Map(photos.map((photo, i) => [photo.src, i]));

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {spots.map((spot) => (
          <li key={spot.name}>
            {spot.image ? (
              <button
                type="button"
                aria-label={`Open photo: ${spot.name}`}
                onClick={() => setOpenIndex(photoIndex.get(spot.image as string) ?? 0)}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg shadow-sm transition duration-300 hover:shadow-xl"
              >
                <Image
                  src={spot.image}
                  alt={spot.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="transform-gpu object-cover transition duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/85 via-forest-dark/10 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-8 text-left text-xs leading-relaxed text-cream">
                  {spot.name}
                </span>
              </button>
            ) : (
              <div className="flex aspect-[4/3] w-full items-end rounded-lg border border-forest/15 bg-forest/5 px-4 pb-3.5">
                <span className="text-xs leading-relaxed text-ink/70">{spot.name}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <Lightbox
          images={photos}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
