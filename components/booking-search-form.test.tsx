import type { Hotel } from '@/content/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingSearchForm } from './booking-search-form';

const push = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/analytics', () => ({
  pushEcommerceEvent: vi.fn(),
  hotelItem: vi.fn(),
  recordFunnelStep: vi.fn(),
}));

const hotel = (slug: string, name: string): Hotel => ({
  slug,
  name,
  location: 'Somewhere',
  state: 'West Bengal',
  tagline: 'A tagline.',
  description: 'A description.',
  heroImage: `/images/hotels/${slug}/hero.webp`,
  thumbnailImage: `/images/hotels/${slug}/thumb.webp`,
  amenities: [],
  rooms: [],
  dining: [],
  gallery: [],
  sightseeing: [],
});

const hotels = [hotel('gangtok', 'Sinclairs Gangtok'), hotel('ooty', 'Sinclairs Ooty')];

beforeEach(() => push.mockClear());

describe('BookingSearchForm', () => {
  it('renders every field of the stay', () => {
    render(<BookingSearchForm hotels={hotels} />);

    for (const label of ['Property', 'Check In', 'Check Out', 'Rooms', 'Adults', 'Children']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /check availability/i })).toBeInTheDocument();
  });

  it('searches the property and dates it was given', () => {
    render(
      <BookingSearchForm
        hotels={hotels}
        defaultHotel="ooty"
        defaultCheckIn="2099-06-01"
        defaultCheckOut="2099-06-04"
        defaultRooms={2}
        defaultAdults={3}
        defaultChildren={1}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /check availability/i }));

    expect(push).toHaveBeenCalledWith(
      '/book/ooty?checkIn=2099-06-01&checkOut=2099-06-04&rooms=2&adults=3&children=1',
    );
  });

  it('falls back to the first property when none is given', () => {
    render(<BookingSearchForm hotels={hotels} />);

    fireEvent.click(screen.getByRole('button', { name: /check availability/i }));

    expect(push).toHaveBeenCalledWith(expect.stringContaining('/book/gangtok?'));
  });
});
