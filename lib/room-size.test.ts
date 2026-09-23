import { describe, expect, it } from 'vitest';
import { formatRoomSize, squareMetres } from './room-size';

describe('formatRoomSize', () => {
  it('shows metres first, then the feet the property measured', () => {
    expect(formatRoomSize(300)).toBe('28 m² · 300 sq ft');
  });

  it('groups the feet the Indian way once they reach four figures', () => {
    expect(formatRoomSize(1200)).toBe('111 m² · 1,200 sq ft');
  });

  // A room nobody has measured shows nothing at all — an empty "Size" label is
  // worse than no label, because it reads as a page that failed to load.
  it.each([null, undefined, 0, -1])('says nothing for %s', (value) => {
    expect(formatRoomSize(value)).toBeNull();
  });

  it('rounds to the nearest whole metre', () => {
    expect(squareMetres(223)).toBe(21);
    expect(squareMetres(890)).toBe(83);
  });
});
