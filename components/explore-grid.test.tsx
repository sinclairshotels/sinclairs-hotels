import { getHotelBySlug } from '@/content/hotels';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExploreGrid } from './explore-grid';

describe('ExploreGrid', () => {
  it('keeps the spots in the order the content file lists them', () => {
    render(
      <ExploreGrid
        spots={[
          { name: 'Tiger Hill', image: '/images/a.webp' },
          { name: 'Lloyd Botanical Garden' },
          { name: 'Ghoom Monastery', image: '/images/b.webp' },
        ]}
      />,
    );

    const rendered = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(rendered).toEqual(['Tiger Hill', 'Lloyd Botanical Garden', 'Ghoom Monastery']);
  });

  it('opens a photo, and leaves a spot without one as plain text', () => {
    render(
      <ExploreGrid
        spots={[
          { name: 'Tiger Hill', image: '/images/a.webp' },
          { name: 'Lloyd Botanical Garden' },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open photo: Tiger Hill' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Lloyd Botanical Garden/ }),
    ).not.toBeInTheDocument();
  });

  it("renders a real property's list without dropping a spot", () => {
    const darjeeling = getHotelBySlug('darjeeling');
    if (!darjeeling) throw new Error('darjeeling is missing');
    render(<ExploreGrid spots={darjeeling.sightseeing} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(darjeeling.sightseeing.length);
  });
});
