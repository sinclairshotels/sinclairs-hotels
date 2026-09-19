'use client';

import type { GalleryImage } from '@/content/types';
import Image from 'next/image';
import { useEffect } from 'react';

// The full-screen viewer, shared by every grid that opens one. `index` is
// controlled by the caller so a grid can mix photos with other tiles and still
// open the right one.
export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const count = images.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % count);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, count, onIndex, onClose]);

  const current = images[index];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10">
      <button
        type="button"
        aria-label="Close lightbox"
        onClick={onClose}
        className="absolute inset-0 bg-forest-dark/95"
      />

      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-cream transition hover:bg-white/20 sm:right-6 sm:top-6"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        aria-label="Previous photo"
        onClick={() => onIndex((index - 1 + count) % count)}
        className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-cream transition hover:bg-white/20 sm:left-6"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next photo"
        onClick={() => onIndex((index + 1) % count)}
        className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-cream transition hover:bg-white/20 sm:right-6"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* The caption sits under the photo, not on it: the padding here is what
          keeps `object-contain` from filling the space the caption occupies. */}
      <div className="relative h-full w-full max-w-5xl pb-24 sm:pb-20">
        <Image
          key={current.src}
          src={current.src}
          alt={current.alt}
          fill
          sizes="100vw"
          className="animate-fade-up object-contain"
        />
      </div>

      <p className="absolute inset-x-0 bottom-6 mx-auto max-w-2xl px-6 text-center text-sm leading-relaxed text-cream">
        {current.alt}
        <span className="ml-2 text-cream/60">
          {index + 1} / {count}
        </span>
      </p>
    </div>
  );
}
