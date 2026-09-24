import type { Hotel } from '@/content/types';
import { Prisma, type Voucher } from '@prisma/client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VoucherView } from './voucher-view';

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

const fixtureVoucher: Voucher = {
  id: 'test-id',
  voucherNo: 42,
  viewToken: 'token',
  hotelSlug: 'burdwan',
  guestName: 'Jane Doe',
  guestPhone: '+91 9876543210',
  guestEmail: 'jane@example.com',
  billingAddress: '123 Example Street, Kolkata',
  travelAgentName: null,
  travelAgentPan: null,
  travelAgentGstin: null,
  travelAgentState: null,
  commissionPct: null,
  tdsPct: null,
  rooms: 2,
  roomCategory: 'Premier Room',
  mealPlan: 'With Breakfast (CP)',
  checkIn: new Date('2026-01-10'),
  checkOut: new Date('2026-01-12'),
  rate: new Prisma.Decimal('4500'),
  taxes: new Prisma.Decimal('540'),
  depositAmount: 5000 as unknown as null,
  depositReceiptNo: null,
  depositReceiptDate: new Date('2026-10-01T00:00:00.000Z'),
  billingInstructions: 'Room and taxes to the travel agent; extras to the guest.',
  arrivalDetails: null,
  otherServices: null,
  specialInstructions: 'Handle with care, internal note',
  issuerName: 'Front Desk',
  issuerPhone: '+91 9123456789',
  bookingOffice: 'Sinclairs Hotels — Head Office',
  legacyId: null,
  cancelledAt: null,
  cancelledReason: null,
  cancelledByLabel: null,
  createdAt: new Date('2026-01-01'),
};

describe('VoucherView', () => {
  it('renders the guest-visible voucher details', () => {
    render(<VoucherView voucher={fixtureVoucher} hotel={fixtureHotel} />);

    expect(screen.getByText('Voucher #42')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Sinclairs Burdwan')).toBeInTheDocument();
    expect(screen.getByText('Front Desk')).toBeInTheDocument();
    expect(screen.getByText('Sinclairs Hotels — Head Office')).toBeInTheDocument();
  });

  it('never shows internal-only commission and unit notes to the guest', () => {
    render(<VoucherView voucher={fixtureVoucher} hotel={fixtureHotel} />);

    expect(screen.queryByText('Handle with care, internal note')).not.toBeInTheDocument();
    expect(screen.queryByText('Commission')).not.toBeInTheDocument();
    expect(screen.queryByText('TDS')).not.toBeInTheDocument();
  });

  // Reservations asked for this one on the printed voucher: it says who
  // settles what, which is the thing argued about at check-out.
  it('prints the billing instructions, the room category and the advance paid', () => {
    render(<VoucherView voucher={fixtureVoucher} hotel={fixtureHotel} />);

    expect(
      screen.getByText('Room and taxes to the travel agent; extras to the guest.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Room Category')).toBeInTheDocument();
    expect(screen.getByText('Premier Room')).toBeInTheDocument();
    expect(screen.getByText('Meal Plan')).toBeInTheDocument();
    expect(screen.getByText('Advance Paid')).toBeInTheDocument();
  });

  // A cancelled voucher must not read as a valid one. The notice comes before
  // the table, because a guest who reads the dates and stops has read a
  // document that no longer stands.
  it('says so, up front, when the voucher has been cancelled', () => {
    render(
      <VoucherView
        voucher={{
          ...fixtureVoucher,
          cancelledAt: new Date('2026-09-23T10:00:00.000Z'),
          cancelledReason: 'Guest rebooked for December',
          cancelledByLabel: 'Test Staff',
        }}
        hotel={fixtureHotel}
      />,
    );

    expect(screen.getByText('This voucher has been cancelled.')).toBeInTheDocument();
    expect(screen.getByText('Guest rebooked for December')).toBeInTheDocument();
  });

  it('says nothing about cancellation on a live voucher', () => {
    render(<VoucherView voucher={fixtureVoucher} hotel={fixtureHotel} />);
    expect(screen.queryByText(/has been cancelled/)).not.toBeInTheDocument();
  });
});
