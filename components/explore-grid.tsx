'use client';

import { Lightbox } from '@/components/lightbox';
import type { ExploreEntry } from '@/lib/sightseeing';
import Image from 'next/image';
import { useState } from 'react';

// A list of places, not a wall of thumbnails: a guest deciding what to do with
// a morning needs to know what a place is and how far it is, which a cropped
// photograph with a caption cannot say.
//
// The order in the content file is the order the property recommends, so
// entries render in it — including the ones with no photograph, which keep
// their place in the list rather than being swept to the bottom. A place with
// no photo has no image slot at all; an empty grey box is worse than none.
export function ExploreGrid({ spots }: { spots: ExploreEntry[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const photos = spots
    .filter((spot) => spot.image)
    .map((spot) => ({ src: spot.image as string, alt: spot.name }));
  const photoIndex = new Map(photos.map((photo, i) => [photo.src, i]));

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {spots.map((spot) => (
          <li
            key={spot.name}
            className="flex gap-4 rounded-lg border border-forest/10 bg-white p-3 shadow-sm transition hover:shadow-lg"
          >
            {spot.image && (
              <button
                type="button"
                aria-label={`Open photo: ${spot.name}`}
                onClick={() => setOpenIndex(photoIndex.get(spot.image as string) ?? 0)}
                className="group relative h-24 w-24 shrink-0 overflow-hidden rounded"
              >
                <Image
                  src={spot.image}
                  alt={spot.name}
                  fill
                  sizes="96px"
                  className="transform-gpu object-cover transition duration-500 group-hover:scale-110"
                />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display text-base leading-snug text-forest">{spot.name}</p>
              {spot.blurb && (
                <p className="mt-1 text-xs leading-relaxed text-ink/65">{spot.blurb}</p>
              )}
              {spot.distance && (
                <p className="mt-2 text-[11px] uppercase tracking-wider text-gold-dark">
                  {spot.distance}
                  {spot.drive ? ` · about ${spot.drive}` : ''}
                </p>
              )}
            </div>
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
