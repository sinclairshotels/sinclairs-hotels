import type { Hotel } from '@/content/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookHotelCard } from './book-hotel-card';

const fixtureHotel: Hotel = {
  slug: 'burdwan',
  name: 'Sinclairs Burdwan',
  location: 'Burdwan',
  state: 'West Bengal',
  tagline: 'A comfortable stay in the heart of Burdwan.',
  description: 'A full description of the property.',
  heroImage: '/images/hotels/burdwan/hero.webp',
  thumbnailImage: '/images/hotels/burdwan/thumb.webp',
  amenities: ['Wi-Fi', 'Restaurant'],
  rooms: [],
  dining: [],
  gallery: [],
  sightseeing: [],
};

describe('BookHotelCard', () => {
  it('renders the name, location and entry price', () => {
    render(<BookHotelCard hotel={fixtureHotel} fromPrice={4950} />);

    expect(screen.getByText('Sinclairs Burdwan')).toBeInTheDocument();
    expect(screen.getByText('Burdwan, West Bengal')).toBeInTheDocument();
    expect(screen.getByText(/₹4,950/)).toBeInTheDocument();
  });

  it('links a priced property to its booking page', () => {
    render(<BookHotelCard hotel={fixtureHotel} fromPrice={4950} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/book/burdwan');
  });

  it('offers an enquiry instead of a price when nothing is loaded', () => {
    render(<BookHotelCard hotel={fixtureHotel} />);

    expect(screen.getByText('Enquire')).toBeInTheDocument();
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/contact?property=burdwan');
  });

  it('shows a price of zero rather than treating it as nothing loaded', () => {
    render(<BookHotelCard hotel={fixtureHotel} fromPrice={0} />);

    expect(screen.getByText(/₹0/)).toBeInTheDocument();
    expect(screen.queryByText('Enquire')).not.toBeInTheDocument();
  });
});
