import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookingGuestForm } from './booking-guest-form';

vi.mock('@/app/(site)/book/actions', () => ({ createBooking: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ pushDataLayerEvent: vi.fn() }));

const stay = {
  hotelSlug: 'gangtok',
  roomTypeId: 'room-deluxe',
  ratePlanId: 'plan-deluxe-ep',
  checkIn: '2099-06-01',
  checkOut: '2099-06-04',
  rooms: 2,
  adults: 3,
  children: 1,
};

describe('BookingGuestForm', () => {
  it('collects the guest details the booking needs', () => {
    render(<BookingGuestForm stay={stay} />);

    expect(screen.getByLabelText('Full Name')).toBeRequired();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText('Billing Address')).toBeRequired();
    expect(screen.getByLabelText('Special Requests (optional)')).not.toBeRequired();
    expect(screen.getByRole('button', { name: /pay & confirm booking/i })).toBeInTheDocument();
  });

  it('carries the whole stay in hidden fields for the server to re-check', () => {
    const { container } = render(<BookingGuestForm stay={stay} />);

    const hidden = Object.fromEntries(
      Array.from(container.querySelectorAll('input[type="hidden"]')).map((input) => [
        input.getAttribute('name'),
        input.getAttribute('value'),
      ]),
    );

    expect(hidden).toEqual({
      hotelSlug: 'gangtok',
      roomTypeId: 'room-deluxe',
      ratePlanId: 'plan-deluxe-ep',
      checkIn: '2099-06-01',
      checkOut: '2099-06-04',
      rooms: '2',
      adults: '3',
      children: '1',
    });
  });

  it('never posts a price — the server prices the stay itself', () => {
    const { container } = render(<BookingGuestForm stay={stay} />);

    const names = Array.from(container.querySelectorAll('input, textarea')).map((el) =>
      el.getAttribute('name'),
    );

    expect(names).not.toContain('total');
    expect(names).not.toContain('rate');
    expect(names).not.toContain('roomTotal');
  });

  it('carries a honeypot that is hidden from real guests', () => {
    const { container } = render(<BookingGuestForm stay={stay} />);
    const honeypot = container.querySelector('input[name="company"]');
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    expect(honeypot).toHaveAttribute('tabindex', '-1');
  });
});
