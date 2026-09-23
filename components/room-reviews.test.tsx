import { reviews } from '@/content/reviews';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoomReviews } from './room-reviews';

describe('RoomReviews', () => {
  it('shows only quotes about the property being looked at', () => {
    const hotelName = reviews[0]?.propertyName as string;
    render(<RoomReviews hotelName={hotelName} />);

    for (const caption of screen.getAllByText(new RegExp(hotelName))) {
      expect(caption).toBeInTheDocument();
    }
    // Nobody else's property is named anywhere on the panel.
    const others = [...new Set(reviews.map((r) => r.propertyName))].filter(
      (name) => name !== hotelName,
    );
    for (const other of others) {
      expect(screen.queryByText(new RegExp(other))).not.toBeInTheDocument();
    }
  });

  // It used to borrow another hotel's quote rather than show an empty panel.
  // A guest deciding on Bayview was reading praise of Darjeeling.
  it('shows nothing at all for a property with no quotes of its own', () => {
    const { container } = render(<RoomReviews hotelName="Sinclairs Nowhere" />);
    expect(container).toBeEmptyDOMElement();
  });
});
