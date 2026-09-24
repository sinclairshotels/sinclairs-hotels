import { cleanup, render, screen } from '@testing-library/react';
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
  childAges: '8',
  rateType: 'NON_REFUNDABLE' as const,
  cancellationDeadline: null,
};

describe('BookingGuestForm', () => {
  it('states the terms the guest is buying, not a blanket policy', () => {
    render(<BookingGuestForm stay={stay} />);
    expect(screen.getByText(/non-refundable and non-transferable/i)).toBeInTheDocument();

    cleanup();
    render(
      <BookingGuestForm
        stay={{
          ...stay,
          rateType: 'REFUNDABLE',
          cancellationDeadline: new Date('2099-05-25T00:00:00.000Z'),
        }}
      />,
    );
    // The date matters more than the word: "refundable" without one is what a
    // guest argues about at the desk.
    expect(screen.getByText(/Free cancellation until 25 May 2099/)).toBeInTheDocument();
  });

  it('collects the guest details the booking needs', () => {
    render(<BookingGuestForm stay={stay} />);

    expect(screen.getByLabelText('Full Name')).toBeRequired();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText('Special Requests (optional)')).not.toBeRequired();
    expect(screen.getByRole('button', { name: /pay & confirm booking/i })).toBeInTheDocument();
  });

  // Six fields rather than one line, shared with the voucher form. The second
  // line is the only optional one, and the country is filled in already.
  it('asks for the address in the fields an address actually has', () => {
    render(<BookingGuestForm stay={stay} />);

    for (const label of ['Address line 1', 'City', 'State', 'PIN code', 'Country']) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText('Address line 2 (optional)')).not.toBeRequired();
    expect(screen.getByLabelText('Country')).toHaveValue('India');
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
      // Which terms, but never the price for them — the server re-prices from
      // the property's own settings.
      rateType: 'NON_REFUNDABLE',
      checkIn: '2099-06-01',
      checkOut: '2099-06-04',
      rooms: '2',
      adults: '3',
      children: '1',
      childAges: '8',
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
