import { hotels } from '@/content/hotels';
import { diningPhotos } from '@/lib/dining';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiningShowcase } from './dining-showcase';

describe('DiningShowcase', () => {
  it('shows one photo per property, linking to that hotel’s dining section', () => {
    const entries = diningPhotos(hotels);
    render(<DiningShowcase entries={entries} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(entries.length);
    for (const { hotel } of entries) {
      expect(screen.getByRole('link', { name: new RegExp(hotel.name) })).toHaveAttribute(
        'href',
        `/hotels/${hotel.slug}#dining`,
      );
    }
  });

  it('covers every property that serves food', () => {
    const served = hotels.filter((hotel) => hotel.dining.length > 0);
    expect(diningPhotos(hotels)).toHaveLength(served.length);
  });
});
