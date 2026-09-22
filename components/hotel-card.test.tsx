import type { Hotel } from '@/content/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HotelCard } from './hotel-card';

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

describe('HotelCard', () => {
  it('renders the hotel name and location', () => {
    render(<HotelCard hotel={fixtureHotel} />);
    expect(screen.getByText('Sinclairs Burdwan')).toBeInTheDocument();
    expect(screen.getByText('Burdwan, West Bengal')).toBeInTheDocument();
  });

  it('quotes the entry price when a rate is loaded', () => {
    render(<HotelCard hotel={fixtureHotel} fromPrice={5400} />);
    expect(screen.getByText(/From/)).toBeInTheDocument();
    expect(screen.getByText(/per night/)).toBeInTheDocument();
  });

  it('says Enquire rather than inventing a price nothing can sell', () => {
    render(<HotelCard hotel={fixtureHotel} fromPrice={null} />);
    expect(screen.getByText('Enquire')).toBeInTheDocument();
    expect(screen.queryByText(/per night/)).not.toBeInTheDocument();
  });

  it('says nothing about price where the caller does not know one', () => {
    render(<HotelCard hotel={fixtureHotel} />);
    expect(screen.queryByText('Enquire')).not.toBeInTheDocument();
    expect(screen.queryByText(/per night/)).not.toBeInTheDocument();
  });

  it('links to the hotel detail page', () => {
    render(<HotelCard hotel={fixtureHotel} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/hotels/burdwan');
  });
});
