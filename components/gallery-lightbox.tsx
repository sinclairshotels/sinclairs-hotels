'use client';

import { Lightbox } from '@/components/lightbox';
import type { GalleryImage } from '@/content/types';
import Image from 'next/image';
import { useState } from 'react';

export function GalleryLightbox({ images }: { images: GalleryImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid auto-rows-[180px] grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((image, i) => (
          <button
            key={image.src}
            type="button"
            aria-label={`Open photo: ${image.alt}`}
            onClick={() => setOpenIndex(i)}
            className={`group relative overflow-hidden rounded-lg shadow-sm transition duration-300 hover:shadow-xl ${
              i === 0 ? 'col-span-2 row-span-2' : ''
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 768px) 25vw, 50vw"
              className="transform-gpu object-cover transition duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/80 via-forest-dark/0 to-forest-dark/0 opacity-0 transition duration-300 group-hover:opacity-100" />
            <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-forest-dark/40 text-cream opacity-0 backdrop-blur-sm transition duration-300 group-hover:opacity-100">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="absolute inset-x-0 bottom-0 translate-y-2 px-4 pb-4 pt-8 text-left text-xs leading-relaxed text-cream opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 line-clamp-2">
              {image.alt}
            </p>
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          images={images}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
