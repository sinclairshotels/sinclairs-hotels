import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ReservationLink } from './reservation-link';

const click = (name: string) => fireEvent.click(screen.getByRole('link', { name }));
const lastPush = () => (window.dataLayer ?? [])[1] as Record<string, unknown>;

describe('ReservationLink', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('sends a CTA that names no property to the booking landing page', () => {
    render(<ReservationLink ctaSource="nav">Book Now</ReservationLink>);
    const link = screen.getByRole('link', { name: 'Book Now' });
    expect(link).toHaveAttribute('href', '/book');
    // Our own engine, so no new tab and nothing to guard against.
    expect(link).not.toHaveAttribute('target');
  });

  it('sends a CTA that knows its property straight to that property', () => {
    render(
      <ReservationLink ctaSource="hotel_stat_bar" params={{ hotel: 'darjeeling' }}>
        Check Availability
      </ReservationLink>,
    );
    expect(screen.getByRole('link', { name: 'Check Availability' })).toHaveAttribute(
      'href',
      '/book/darjeeling',
    );
  });

  it('sends an empty items array when the CTA belongs to no single property', () => {
    render(<ReservationLink ctaSource="nav">Book Now</ReservationLink>);
    click('Book Now');
    expect(lastPush()).toEqual({
      event: 'begin_checkout',
      cta_source: 'nav',
      ecommerce: { items: [] },
    });
  });

  it('carries the property as an ecommerce item when given one', () => {
    render(
      <ReservationLink
        ctaSource="hotel_stat_bar"
        params={{ hotel: 'darjeeling' }}
        item={{ slug: 'darjeeling', name: 'Sinclairs Darjeeling' }}
      >
        Check Availability
      </ReservationLink>,
    );
    click('Check Availability');
    expect(lastPush()).toEqual({
      event: 'begin_checkout',
      cta_source: 'hotel_stat_bar',
      hotel: 'darjeeling',
      ecommerce: {
        items: [
          {
            item_id: 'darjeeling',
            item_name: 'Sinclairs Darjeeling',
            item_brand: 'Sinclairs',
            item_category: 'Hotel',
          },
        ],
      },
    });
  });

  it('records the room type as the item variant from a room card', () => {
    render(
      <ReservationLink
        ctaSource="hotel_room_card"
        params={{ hotel: 'darjeeling', room: 'Deluxe Room' }}
        item={{ slug: 'darjeeling', name: 'Sinclairs Darjeeling', variant: 'Deluxe Room' }}
      >
        Book Now
      </ReservationLink>,
    );
    click('Book Now');
    const push = lastPush();
    expect(push.room).toBe('Deluxe Room');
    expect((push.ecommerce as { items: { item_variant?: string }[] }).items[0]?.item_variant).toBe(
      'Deluxe Room',
    );
  });

  it('resets the ecommerce object before every click', () => {
    render(<ReservationLink ctaSource="nav">Book Now</ReservationLink>);
    click('Book Now');
    expect(window.dataLayer?.[0]).toEqual({ ecommerce: null });
  });
});
