import { getHotelBySlug } from '@/content/hotels';
import { exploreEntries } from '@/lib/sightseeing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExploreGrid } from './explore-grid';

const plain = (name: string, image?: string) => ({ name, image, distance: null, drive: null });

describe('ExploreGrid', () => {
  it('keeps the spots in the order the content file lists them', () => {
    render(
      <ExploreGrid
        spots={[
          plain('Tiger Hill', '/images/a.webp'),
          plain('Lloyd Botanical Garden'),
          plain('Ghoom Monastery', '/images/b.webp'),
        ]}
      />,
    );

    const rendered = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(rendered).toEqual(['Tiger Hill', 'Lloyd Botanical Garden', 'Ghoom Monastery']);
  });

  it('opens a photo, and leaves a spot without one as plain text', () => {
    render(
      <ExploreGrid
        spots={[plain('Tiger Hill', '/images/a.webp'), plain('Lloyd Botanical Garden')]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open photo: Tiger Hill' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Lloyd Botanical Garden/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the distance and drive time where the place has coordinates', () => {
    render(
      <ExploreGrid
        spots={[
          {
            name: 'Tiger Hill',
            blurb: 'Sunrise over Kanchenjunga.',
            distance: '11 km',
            drive: '45 min',
          },
          plain('Lloyd Botanical Garden'),
        ]}
      />,
    );

    expect(screen.getByText('11 km · about 45 min')).toBeInTheDocument();
    expect(screen.getByText('Sunrise over Kanchenjunga.')).toBeInTheDocument();
    // A place with no coordinates says nothing about how far it is.
    expect(screen.queryByText(/km/)).toHaveTextContent('11 km');
  });

  it("renders a real property's list without dropping a spot", () => {
    const darjeeling = getHotelBySlug('darjeeling');
    if (!darjeeling) throw new Error('darjeeling is missing');
    render(<ExploreGrid spots={exploreEntries(darjeeling)} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(darjeeling.sightseeing.length);
  });
});
