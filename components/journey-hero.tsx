'use client';

import { mergeMounted, slidesToMount } from '@/lib/carousel-mount';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Slide = { image: string; name: string; location: string; slug: string };

export function JourneyHero({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  // See lib/carousel-mount.ts. This one mattered most: six full-bleed heroes,
  // 1.9 MB, every one fetched before the home page had painted.
  const [mounted, setMounted] = useState(() => slidesToMount(0, slides.length));

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6500);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    setMounted((current) => mergeMounted(current, slidesToMount(index, slides.length)));
  }, [index, slides.length]);

  const current = slides[index];
  if (!current) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {slides.map((slide, i) => (
        <div
          key={slide.slug}
          className={`absolute inset-0 transition-opacity duration-[1600ms] ease-in-out ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="relative h-full w-full animate-hero-zoom-loop">
            {mounted.has(i) && (
              <Image
                src={slide.image}
                alt={slide.name}
                fill
                priority={i === 0}
                className="object-cover"
                sizes="100vw"
                quality={90}
              />
            )}
          </div>
        </div>
      ))}

      <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_6vw_0_rgba(13,33,25,0.35)]" />

      <div className="absolute right-6 top-6 z-10 flex flex-col items-end gap-3 sm:right-10 sm:top-10">
        <Link
          href={`/hotels/${current.slug}`}
          className="animate-fade-up rounded-full border border-cream/30 bg-forest-dark/40 px-4 py-2 text-xs uppercase tracking-wider text-cream backdrop-blur-sm transition hover:bg-forest-dark/70"
          key={current.slug}
        >
          {current.name} <span className="text-cream/60">— {current.location}</span>
        </Link>
        {slides.length > 1 && (
          <div className="flex gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.slug}
                type="button"
                aria-label={`Show ${slide.name}`}
                onClick={() => setIndex(i)}
                className={`h-px rounded-full transition-all duration-700 ${
                  i === index
                    ? 'w-8 bg-gold shadow-[0_0_6px_rgba(189,148,85,0.8)]'
                    : 'w-4 bg-cream/40 hover:bg-cream/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
