import type { BookingOffice, Hotel } from '@/content/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VoucherForm } from './voucher-form';

const fixtureHotel: Hotel = {
  slug: 'burdwan',
  name: 'Sinclairs Burdwan',
  location: 'Burdwan',
  state: 'West Bengal',
  tagline: 'A comfortable stay in the heart of Burdwan.',
  description: 'A full description of the property.',
  heroImage: '/images/hotels/burdwan/hero.webp',
  thumbnailImage: '/images/hotels/burdwan/thumb.webp',
  sceneryImage: '/images/scenery.webp',
  amenities: ['Wi-Fi', 'Restaurant'],
  rooms: [],
  dining: [],
  gallery: [],
  sightseeing: [],
};

const fixtureOffice: BookingOffice = {
  name: 'Sinclairs Hotels — Head Office',
  city: 'Kolkata',
  phone: '1800 120 267 000',
  email: 'reservations@sinclairshotels.com',
};

describe('VoucherForm', () => {
  it('renders the required booking, guest, and issuer fields', () => {
    render(<VoucherForm hotels={[fixtureHotel]} bookingOffices={[fixtureOffice]} />);

    expect(screen.getByText('Hotel')).toBeInTheDocument();
    expect(screen.getByText('Booking Office')).toBeInTheDocument();
    expect(screen.getByLabelText('No. of Rooms')).toBeInTheDocument();
    expect(screen.getByLabelText('Rate (₹)')).toBeInTheDocument();
    expect(screen.getByLabelText('Taxes / GST (₹)')).toBeInTheDocument();
    expect(screen.getByLabelText('Guest Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Guest Phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Guest Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Billing Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Your Phone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create & send voucher/i })).toBeInTheDocument();
  });

  it('renders the optional travel agent and deposit fields', () => {
    render(<VoucherForm hotels={[fixtureHotel]} bookingOffices={[fixtureOffice]} />);

    expect(screen.getByLabelText('Travel Agent Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Commission (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('TDS (%)')).toBeInTheDocument();
    expect(screen.getByLabelText('Deposit Amount (₹)')).toBeInTheDocument();
  });
});
