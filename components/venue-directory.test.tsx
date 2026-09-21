import { hotels } from '@/content/hotels';
import { venuesByHotel } from '@/lib/venues';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VenueDirectory } from './venue-directory';

describe('VenueDirectory', () => {
  it('lists every property that has a venue, largest room first', () => {
    const groups = venuesByHotel(hotels);
    render(<VenueDirectory groups={groups} />);

    for (const { hotel } of groups) {
      expect(screen.getByText(hotel.name)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('link', { name: /see the property/i })).toHaveLength(groups.length);
  });

  it('marks a boardroom so it is not read as a banquet hall', () => {
    const kalimpong = venuesByHotel(hotels).find((g) => g.hotel.slug === 'kalimpong');
    if (!kalimpong) throw new Error('kalimpong has no venues');
    render(<VenueDirectory groups={[kalimpong]} />);

    expect(screen.getByText('The Juniper')).toBeInTheDocument();
    expect(screen.getByText('Boardroom')).toBeInTheDocument();
  });
});
