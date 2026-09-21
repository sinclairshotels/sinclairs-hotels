import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContactLink } from './contact-link';

describe('ContactLink', () => {
  beforeEach(() => {
    window.dataLayer = [];
  });

  it('renders the underlying tel: link unchanged', () => {
    render(
      <ContactLink method="phone" href="tel:1800120267000" ctaSource="footer">
        1800 120 267 000
      </ContactLink>,
    );
    expect(screen.getByRole('link', { name: '1800 120 267 000' })).toHaveAttribute(
      'href',
      'tel:1800120267000',
    );
  });

  it('pushes contact_click with method, cta_source and hotel on click', () => {
    render(
      <ContactLink method="phone" href="tel:+913592280701" ctaSource="hotel_page" hotel="gangtok">
        Call the hotel
      </ContactLink>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Call the hotel' }));
    expect(window.dataLayer).toEqual([
      { event: 'contact_click', method: 'phone', cta_source: 'hotel_page', hotel: 'gangtok' },
    ]);
  });

  it('omits the hotel key entirely when the link belongs to no single hotel', () => {
    render(
      <ContactLink method="phone" href="tel:1800120267000" ctaSource="footer">
        Toll free
      </ContactLink>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Toll free' }));
    expect((window.dataLayer ?? [])[0]).not.toHaveProperty('hotel');
  });
});
