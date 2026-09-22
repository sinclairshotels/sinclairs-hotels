import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// content/reviews.ts ships foodRatings empty on purpose — no source in this
// repository publishes a food score. So the rendering is proved against a
// fixture, and the empty case against the real content.
vi.mock('@/content/reviews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/content/reviews')>();
  const fixture = {
    propertyName: 'Sinclairs Gangtok',
    rating: 4.3,
    outOf: 5,
    source: 'Tripadvisor',
    url: 'https://www.tripadvisor.in/example',
    reviewCount: 412,
  };
  return {
    ...actual,
    foodRatingFor: (name: string) => (name === fixture.propertyName ? fixture : undefined),
  };
});

const { FoodRating } = await import('@/components/food-rating');

describe('FoodRating', () => {
  it('shows the score, the scale and the source it came from', () => {
    render(<FoodRating hotelName="Sinclairs Gangtok" />);

    expect(screen.getByText('4.3')).toBeInTheDocument();
    expect(screen.getByText('/ 5')).toBeInTheDocument();
    expect(screen.getByText(/412 reviews/)).toBeInTheDocument();

    const source = screen.getByRole('link', { name: 'Tripadvisor' });
    expect(source).toHaveAttribute('href', 'https://www.tripadvisor.in/example');
  });

  it('renders nothing for a property with no food rating', () => {
    const { container } = render(<FoodRating hotelName="Sinclairs Darjeeling" />);

    expect(container).toBeEmptyDOMElement();
  });
});
