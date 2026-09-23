import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JourneyHero } from './journey-hero';

const SLIDES = Array.from({ length: 9 }, (_, i) => ({
  image: `/images/hotel-${i}.webp`,
  name: `Hotel ${i}`,
  location: `Town ${i}`,
  slug: `hotel-${i}`,
}));

describe('JourneyHero', () => {
  // The home page's six full-bleed heroes were all fetched before it painted.
  it('mounts only the slide showing and the one after it', () => {
    const { container } = render(<JourneyHero slides={SLIDES} />);
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });

  it('names the property showing, with a link to it', () => {
    render(<JourneyHero slides={SLIDES} />);
    expect(screen.getByRole('link', { name: /Hotel 0/ })).toHaveAttribute(
      'href',
      '/hotels/hotel-0',
    );
  });

  it('offers a dot per slide', () => {
    render(<JourneyHero slides={SLIDES} />);
    expect(screen.getAllByRole('button', { name: /^Show / })).toHaveLength(9);
  });

  it('renders nothing rather than crashing when there are no slides', () => {
    const { container } = render(<JourneyHero slides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
