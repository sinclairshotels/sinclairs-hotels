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
  it('groups the fields under Guest, Stay, Amounts and Notes', () => {
    render(<VoucherForm hotels={[fixtureHotel]} bookingOffices={[fixtureOffice]} />);

    for (const section of ['Guest', 'Stay', 'Amounts', 'Notes']) {
      expect(screen.getByRole('group', { name: section })).toBeInTheDocument();
    }
  });

  it('asks for everything a voucher cannot be issued without', () => {
    render(<VoucherForm hotels={[fixtureHotel]} bookingOffices={[fixtureOffice]} />);

    expect(screen.getByText('Hotel')).toBeInTheDocument();
    expect(screen.getByText('Booking office')).toBeInTheDocument();
    for (const label of ['Rooms', 'Rate ₹', 'Taxes / GST ₹', 'Name', 'Phone', 'Email']) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText('Issued by')).toBeRequired();
    expect(screen.getByLabelText('Issuer phone')).toBeRequired();
    expect(screen.getByRole('button', { name: /create & send voucher/i })).toBeInTheDocument();
  });

  // The same six fields the booking form asks for, so the two write the same
  // shape into the one address column they share.
  it('takes the address in fields rather than as a block of text', () => {
    render(<VoucherForm hotels={[fixtureHotel]} bookingOffices={[fixtureOffice]} />);

    for (const label of ['Address line 1', 'City', 'State', 'PIN code', 'Country']) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText('Address line 2 (optional)')).not.toBeRequired();
  });

  it('keeps the optional agent and deposit fields', () => {
    render(<VoucherForm hotels={[fixtureHotel]} bookingOffices={[fixtureOffice]} />);

    expect(screen.getByLabelText('Agent name')).not.toBeRequired();
    expect(screen.getByLabelText('Commission %')).not.toBeRequired();
    expect(screen.getByLabelText('TDS %')).not.toBeRequired();
    expect(screen.getByLabelText('Advance paid ₹')).not.toBeRequired();
    expect(screen.getByLabelText('Room category')).not.toBeRequired();
  });
});
