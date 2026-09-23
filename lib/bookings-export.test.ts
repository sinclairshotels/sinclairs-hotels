import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { EXPORT_COLUMNS, type ExportBooking, exportFileName } from './bookings-export';

const booking = (overrides: Partial<ExportBooking> = {}): ExportBooking =>
  ({
    id: 'b1',
    reference: 'SNC-260923-ACDEF',
    viewToken: 't',
    abandonedEmailSentAt: null,
    hotelSlug: 'gangtok',
    roomTypeId: 'rt1',
    ratePlanId: 'rp1',
    roomName: 'Deluxe Room',
    planName: 'With Breakfast',
    breakfastGuests: 2,
    breakfastAmount: new Prisma.Decimal(1800),
    checkIn: new Date('2026-12-01T00:00:00.000Z'),
    checkOut: new Date('2026-12-03T00:00:00.000Z'),
    rooms: 1,
    adults: 2,
    children: 0,
    guestName: 'Test Guest',
    guestEmail: 'guest@example.invalid',
    guestPhone: '+91 98300 00000',
    billingAddress: '12 Camac Street\nFlat 3\nKolkata\nWest Bengal - 700017\nIndia',
    specialRequests: null,
    roomTotal: new Prisma.Decimal(11800),
    taxTotal: new Prisma.Decimal(590),
    total: new Prisma.Decimal(12390),
    rateType: 'REFUNDABLE',
    cancellationDeadline: new Date('2026-11-28T00:00:00.000Z'),
    cancelledAt: null,
    status: 'CONFIRMED',
    paymentId: 'p1',
    payment: { status: 'SUCCESS' },
    userIp: null,
    createdAt: new Date('2026-09-23T10:30:00.000Z'),
    ...overrides,
  }) as ExportBooking;

const row = (b: ExportBooking) =>
  Object.fromEntries(EXPORT_COLUMNS.map((column) => [column.header, column.value(b)]));

describe('the bookings sheet', () => {
  it('carries every column the report asks for, in order', () => {
    expect(EXPORT_COLUMNS.map((column) => column.header)).toEqual([
      'Reference',
      'Booked at',
      'Hotel',
      'Room',
      'Plan',
      'Rate type',
      'Check-in',
      'Check-out',
      'Nights',
      'Rooms',
      'Adults',
      'Children',
      'Guest name',
      'Phone',
      'Email',
      'City',
      'Room total',
      'Breakfast',
      'Transfer',
      'GST',
      'Total',
      'Payment',
      'Booking status',
      'Cancel by',
    ]);
  });

  it('counts nights, not calendar days', () => {
    expect(row(booking()).Nights).toBe(2);
  });

  it('writes money as numbers, so the sheet can add them up', () => {
    const values = row(booking());
    expect(values['Room total']).toBe(11800);
    expect(values.GST).toBe(590);
    expect(values.Total).toBe(12390);
  });

  it('gives breakfast in rupees where the booking stored it', () => {
    expect(row(booking()).Breakfast).toBe(1800);
  });

  // Bookings taken before breakfastAmount existed have no figure. Saying "2
  // guests · With Breakfast" is what is actually known; a 0 would claim the
  // guest had no breakfast when the plan name says otherwise.
  it('falls back to the guest count and plan on an older booking', () => {
    expect(row(booking({ breakfastAmount: null })).Breakfast).toBe('2 guests · With Breakfast');
  });

  it('says nothing about breakfast on a Room Only booking', () => {
    expect(row(booking({ breakfastAmount: null, breakfastGuests: 0 })).Breakfast).toBeNull();
  });

  it('reads zero for transfer until transfers exist', () => {
    expect(row(booking()).Transfer).toBe(0);
  });

  it('leaves the cancel-by date blank on a non-refundable booking', () => {
    expect(
      row(booking({ rateType: 'NON_REFUNDABLE', cancellationDeadline: null }))['Cancel by'],
    ).toBe('');
  });

  it('reads the city out of the address the form wrote', () => {
    expect(row(booking()).City).toBe('Kolkata');
  });
});

describe('exportFileName', () => {
  it('names the file after what is in it', () => {
    expect(exportFileName('2026-09-01', '2026-09-30', 'stay')).toBe(
      'sinclairs-bookings-stay-2026-09-01-to-2026-09-30.xlsx',
    );
  });
});
