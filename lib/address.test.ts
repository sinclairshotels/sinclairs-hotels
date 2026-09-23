import { describe, expect, it } from 'vitest';
import { addressFromInput, addressSchema, cityOf, formatAddress } from './address';

const parts = {
  line1: '12 Camac Street',
  line2: 'Flat 3',
  city: 'Kolkata',
  state: 'West Bengal',
  pin: '700017',
  country: 'India',
};

describe('formatAddress', () => {
  it('writes it the way an envelope is written', () => {
    expect(formatAddress(parts)).toBe(
      '12 Camac Street\nFlat 3\nKolkata\nWest Bengal - 700017\nIndia',
    );
  });

  it('drops the second line when there is none, rather than leaving a gap', () => {
    expect(formatAddress({ ...parts, line2: undefined })).toBe(
      '12 Camac Street\nKolkata\nWest Bengal - 700017\nIndia',
    );
  });
});

// The pair that has to agree: the form writes the address and the export reads
// the city back out of it. State and PIN sharing a line is what keeps the city
// third from the bottom either way.
describe('formatAddress and cityOf together', () => {
  it.each([
    ['with a second line', parts],
    ['without one', { ...parts, line2: undefined }],
    ['without one, and no state', { ...parts, line2: undefined, state: '' }],
  ])('finds the city back again %s', (_name, input) => {
    expect(cityOf(formatAddress(input))).toBe('Kolkata');
  });
});

describe('cityOf', () => {
  it('handles an address typed on one line with commas', () => {
    expect(cityOf('12 Camac Street, Flat 3, Kolkata, West Bengal - 700017, India')).toBe('Kolkata');
  });

  // Legacy rows are free text that never had this shape.
  it('says nothing rather than guessing from too few lines', () => {
    expect(cityOf('Kolkata')).toBe('');
    expect(cityOf('')).toBe('');
  });
});

describe('addressSchema', () => {
  const valid = {
    addressLine1: '12 Camac Street',
    addressLine2: '',
    city: 'Kolkata',
    state: 'West Bengal',
    pin: '700017',
    country: 'India',
  };

  it('accepts a complete Indian address', () => {
    expect(addressSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a foreign postcode, since the country is not fixed', () => {
    expect(
      addressSchema.safeParse({ ...valid, pin: 'SW1A 1AA', country: 'United Kingdom' }).success,
    ).toBe(true);
  });

  it.each([
    ['addressLine1', ''],
    ['city', ''],
    ['state', ''],
    ['pin', '!!'],
    ['country', ''],
  ])('refuses a missing or malformed %s', (field, value) => {
    expect(addressSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it('builds the stored line from a parsed form', () => {
    expect(addressFromInput(addressSchema.parse(valid))).toBe(
      '12 Camac Street\nKolkata\nWest Bengal - 700017\nIndia',
    );
  });
});
