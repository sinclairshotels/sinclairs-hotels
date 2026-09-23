import { describe, expect, it } from 'vitest';
import { enquirySchema, newsletterSchema, voucherSchema } from './validation';

const validInput = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+91 9876543210',
  property: 'burdwan',
  message: 'Looking for a room for two nights in December.',
};

describe('enquirySchema', () => {
  it('accepts a valid enquiry', () => {
    const result = enquirySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects a missing name', () => {
    const result = enquirySchema.safeParse({ ...validInput, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = enquirySchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid phone number', () => {
    const result = enquirySchema.safeParse({ ...validInput, phone: 'call me maybe' });
    expect(result.success).toBe(false);
  });

  it('rejects a message that is too short', () => {
    const result = enquirySchema.safeParse({ ...validInput, message: 'hi' });
    expect(result.success).toBe(false);
  });

  it('rejects submissions with a filled honeypot field', () => {
    const result = enquirySchema.safeParse({ ...validInput, company: 'Acme Corp' });
    expect(result.success).toBe(false);
  });

  it('accepts an empty honeypot field', () => {
    const result = enquirySchema.safeParse({ ...validInput, company: '' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty guests field, as submitted by a blank optional number input', () => {
    const result = enquirySchema.safeParse({ ...validInput, guests: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid guests count', () => {
    const result = enquirySchema.safeParse({ ...validInput, guests: '2' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guests).toBe(2);
    }
  });
});

const validVoucherInput = {
  hotelSlug: 'siliguri',
  guestName: 'Jane Doe',
  guestPhone: '+91 9876543210',
  guestEmail: 'jane@example.com',
  addressLine1: '123 Example Street',
  addressLine2: '',
  city: 'Kolkata',
  state: 'West Bengal',
  pin: '700017',
  country: 'India',
  rooms: '2',
  checkIn: '2026-01-10',
  checkOut: '2026-01-12',
  rate: '4500',
  taxes: '540',
  issuerName: 'Front Desk',
  issuerPhone: '+91 9123456789',
  bookingOffice: 'Sinclairs Hotels — Head Office',
};

describe('voucherSchema', () => {
  it('accepts a valid voucher with only required fields', () => {
    const result = voucherSchema.safeParse(validVoucherInput);
    expect(result.success).toBe(true);
  });

  it('accepts optional travel agent fields left blank', () => {
    const result = voucherSchema.safeParse({ ...validVoucherInput, travelAgentName: '' });
    expect(result.success).toBe(true);
  });

  it('coerces numeric fields from form-data strings', () => {
    const result = voucherSchema.safeParse(validVoucherInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rooms).toBe(2);
      expect(result.data.rate).toBe(4500);
      expect(result.data.taxes).toBe(540);
    }
  });

  it('rejects a missing hotel selection', () => {
    const result = voucherSchema.safeParse({ ...validVoucherInput, hotelSlug: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid guest email', () => {
    const result = voucherSchema.safeParse({ ...validVoucherInput, guestEmail: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a commission percentage above 100', () => {
    const result = voucherSchema.safeParse({ ...validVoucherInput, commissionPct: '150' });
    expect(result.success).toBe(false);
  });

  it('accepts an empty deposit amount, as submitted by a blank optional input', () => {
    const result = voucherSchema.safeParse({ ...validVoucherInput, depositAmount: '' });
    expect(result.success).toBe(true);
  });
});

describe('newsletterSchema', () => {
  it('accepts a valid email', () => {
    const result = newsletterSchema.safeParse({ email: 'jane@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = newsletterSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects submissions with a filled honeypot field', () => {
    const result = newsletterSchema.safeParse({ email: 'jane@example.com', company: 'Acme Corp' });
    expect(result.success).toBe(false);
  });

  it('accepts an empty honeypot field', () => {
    const result = newsletterSchema.safeParse({ email: 'jane@example.com', company: '' });
    expect(result.success).toBe(true);
  });
});
