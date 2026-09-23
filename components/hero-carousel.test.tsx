import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroCarousel } from './hero-carousel';

const IMAGES = Array.from({ length: 9 }, (_, i) => `/images/hero-${i}.webp`);

describe('HeroCarousel', () => {
  // The bug this guards: every slide is inside the viewport, so nine <Image>
  // elements meant nine full-bleed heroes fetched before the page painted.
  // Opacity and loading="lazy" both fail to defer an in-viewport image, so the
  // only thing that does is not rendering it yet.
  // Queried through the DOM rather than by role: every slide after the first
  // is alt="" and therefore presentational, which is correct — they are the
  // same view of the same brand, and nine alt texts would be nine
  // interruptions for a screen reader.
  it('mounts only the first slide and the one after it', () => {
    const { container } = render(<HeroCarousel images={IMAGES} alt="Sinclairs" />);
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('gives the first slide the alt text and leaves the rest decorative', () => {
    render(<HeroCarousel images={IMAGES} alt="Sinclairs" />);
    expect(screen.getByAltText('Sinclairs')).toBeInTheDocument();
  });

  it('renders the one image of a single-image hero', () => {
    const { container } = render(<HeroCarousel images={[IMAGES[0] as string]} alt="Sinclairs" />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
