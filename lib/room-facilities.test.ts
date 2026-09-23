import { hotels } from '@/content/hotels';
import { describe, expect, it } from 'vitest';
import { ALL_ROOM_FACILITIES, deriveRoomFacilities, roomFacilities } from './room-facilities';

const labels = (room: Parameters<typeof deriveRoomFacilities>[0]) =>
  deriveRoomFacilities(room).map((facility) => facility.label);

describe('deriveRoomFacilities', () => {
  it('reads what the description states', () => {
    expect(
      labels({
        description:
          'An attached bath with hot and cold shower, a writing desk, electronic safe and tea/coffee set.',
      }),
    ).toEqual([
      'En-suite bathroom',
      'Hot & cold shower',
      'Tea & coffee',
      'Electronic safe',
      'Writing desk',
    ]);
  });

  it('leaves out what it does not state', () => {
    expect(labels({ description: 'A quiet room overlooking the sea.' })).toEqual([]);
  });

  it('keeps one entry per group, the most specific first', () => {
    expect(labels({ description: 'Two baths with bathtub and rain shower.' })).toEqual([
      'Rain shower',
      'Bathtub',
    ]);
    expect(labels({ description: 'A private balcony facing the valley.' })).toEqual([
      'Private balcony',
    ]);
  });

  it('prefers the property’s own wording for the bed', () => {
    expect(
      labels({ description: 'Features a king size bed.', bedType: 'King or twin beds' }),
    ).toEqual(['King or twin beds']);
    // Stated only in bedType, never in the prose.
    expect(labels({ description: 'A cosy room.', bedType: 'Two queen beds' })).toEqual([
      'Two queen beds',
    ]);
  });

  it('keeps a curated amenity the catalogue has no rule for', () => {
    expect(labels({ description: 'A romantic setting.', amenities: ['Mood lighting'] })).toEqual([
      'Mood lighting',
    ]);
  });
});

describe('roomFacilities', () => {
  const room = { description: 'An attached bath with a rain shower and a writing desk.' };

  it('uses the stored list once staff have made one', () => {
    expect(roomFacilities(room, ['wifi', 'tv']).map((f) => f.label)).toEqual([
      'Free Wi-Fi',
      'Television',
    ]);
  });

  it('falls back to the description when nothing is stored', () => {
    expect(roomFacilities(room, []).map((f) => f.label)).toEqual([
      'En-suite bathroom',
      'Rain shower',
      'Writing desk',
    ]);
  });

  it('drops a stored key the catalogue and the room no longer know', () => {
    expect(roomFacilities(room, ['wifi', 'jacuzzi']).map((f) => f.label)).toEqual(['Free Wi-Fi']);
  });

  it('keeps a stored curated amenity the room still carries', () => {
    const withExtra = { description: 'A romantic setting.', amenities: ['Mood lighting'] };
    expect(roomFacilities(withExtra, ['extra:mood-lighting']).map((f) => f.label)).toEqual([
      'Mood lighting',
    ]);
  });
});

describe('the catalogue', () => {
  it('has no duplicate keys', () => {
    const keys = ALL_ROOM_FACILITIES.map((facility) => facility.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('finds something for most rooms on the site', () => {
    const rooms = hotels.flatMap((hotel) => hotel.rooms);
    const described = rooms.filter((room) => deriveRoomFacilities(room).length > 0);
    expect(described.length).toBeGreaterThan(rooms.length * 0.8);
  });
});
