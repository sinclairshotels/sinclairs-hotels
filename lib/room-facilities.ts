import type { RoomType } from '@/content/types';

// What is actually in the room, as a short list a guest can scan — the
// "In your room" block on the hotel page and the facility icons on the booking
// table both read this.
//
// The list is *derived from the room's own copy*, not written fresh: every
// description already says what the room has ("attached bath with hot and cold
// shower, king size bed, writing desk, electronic safe"), and a second
// hand-maintained list would drift from the prose within a month. Anything the
// copy does not say is simply absent — a room with no stated safe shows no
// safe, rather than one assumed from what the other rooms have.
//
// Staff can override the derived list per room from /admin/rates (Set-up),
// which is what `stored` is. An empty stored list means "nobody has touched
// this", not "this room has nothing": every room has at least a bed, so the
// two are not confusable in practice.

type ContentRoom = Pick<RoomType, 'description' | 'amenities' | 'bedType' | 'view'>;

export interface RoomFacility {
  key: string;
  label: string;
}

interface Rule {
  key: string;
  label: string;
  match: RegExp;
  // Only the first match in a group is kept, so a room with a rain shower does
  // not also claim a plain one, and "private balcony" does not become two
  // entries.
  group?: string;
}

// Order is display order: where you sleep, where you wash, then the room's
// comforts, then its fittings.
const RULES: Rule[] = [
  {
    key: 'king-bed',
    label: 'King-size bed',
    match: /king[- ]?(?:size )?bed|king bed/,
    group: 'bed',
  },
  { key: 'queen-bed', label: 'Queen bed', match: /queen[- ]?(?:size(?:d)? )?bed/, group: 'bed' },
  { key: 'twin-beds', label: 'Twin beds', match: /twin bed|two twin/, group: 'bed' },
  { key: 'double-bed', label: 'Double bed', match: /double bed|large bed/, group: 'bed' },
  { key: 'day-bed', label: 'Day bed', match: /day ?bed/ },
  {
    key: 'ensuite',
    label: 'En-suite bathroom',
    match: /ensuite|en-suite|attached bath|attached toilet|attached washroom|ensuite washroom/,
  },
  { key: 'rain-shower', label: 'Rain shower', match: /rain shower/, group: 'shower' },
  {
    key: 'hot-water',
    label: 'Hot & cold shower',
    match: /hot and cold shower|hot water|walk-in shower|shower/,
    group: 'shower',
  },
  { key: 'bathtub', label: 'Bathtub', match: /bath ?tub/ },
  { key: 'air-conditioning', label: 'Air conditioning', match: /air[- ]condition|split ac\b/ },
  { key: 'heater', label: 'Room heater', match: /room heater|\bheater\b/, group: 'warmth' },
  { key: 'fireplace', label: 'Fireplace', match: /fireplace/, group: 'warmth' },
  { key: 'tv', label: 'Television', match: /television|\btvs?\b|\blcd\b|\bled\b/ },
  { key: 'wifi', label: 'Free Wi-Fi', match: /wi-?fi|wireless internet/ },
  {
    key: 'tea-coffee',
    label: 'Tea & coffee',
    match: /tea ?\/ ?coffee|tea and coffee|coffee maker|kettle/,
  },
  { key: 'minibar', label: 'Minibar', match: /mini ?bar/, group: 'cold' },
  {
    key: 'fridge',
    label: 'Mini fridge',
    match: /mini ?fridge|refrigerator|\bfridge\b/,
    group: 'cold',
  },
  { key: 'safe', label: 'Electronic safe', match: /electronic safe|in-?room safe|\bsafe\b/ },
  { key: 'desk', label: 'Writing desk', match: /writing desk|work desk|study desk|\bdesk\b/ },
  {
    key: 'balcony',
    label: 'Private balcony',
    match: /private (?:standing )?balcony/,
    group: 'balcony',
  },
  { key: 'balcony-plain', label: 'Balcony', match: /balcony/, group: 'balcony' },
  { key: 'sit-out', label: 'Private sit-out', match: /sit-?out/ },
  {
    key: 'living-room',
    label: 'Separate living room',
    match: /separate living room|living room|seating lounge/,
  },
  { key: 'sofa', label: 'Sofa seating', match: /sofa/ },
  { key: 'dining-table', label: 'Dining table', match: /dining table|seater dining/ },
  { key: 'wardrobe', label: 'Wardrobe', match: /wardrobe/ },
  { key: 'phone', label: 'Direct dial phone', match: /direct dial|telephone/ },
  { key: 'room-service', label: 'In-room dining', match: /in-?room dining|room service/ },
];

const BY_KEY = new Map(RULES.map((rule) => [rule.key, rule]));

// Every facility a room could claim, for the checklist on Set-up.
export const ALL_ROOM_FACILITIES: RoomFacility[] = RULES.map(({ key, label }) => ({ key, label }));

// The checklist on Set-up: the catalogue, plus anything this room's own copy
// states that the catalogue has no rule for, so staff can keep Gangtok's mood
// lighting without it being a catalogue entry every other room must ignore.
export function roomFacilityOptions(room: ContentRoom | undefined): RoomFacility[] {
  if (!room) return ALL_ROOM_FACILITIES;
  const extra = deriveRoomFacilities(room).filter((facility) => !BY_KEY.has(facility.key));
  return [...ALL_ROOM_FACILITIES, ...extra];
}

export function facilityLabel(key: string): string | null {
  return BY_KEY.get(key)?.label ?? null;
}

// The room's own words, in one string: the description carries most of it, but
// `amenities` and `bedType` are where a few rooms state something the prose
// does not (Gangtok's Deluxe names its beds only in bedType).
function haystack(room: ContentRoom): string {
  return [room.description, room.bedType, ...(room.amenities ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function slug(label: string): string {
  return `extra:${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

// A curated amenity the catalogue has no rule for — Gangtok's mood lighting,
// Kalimpong's attic. Kept rather than dropped: somebody wrote it about that
// room, and a catalogue is a way to add icons, not a filter on the content.
function extras(room: ContentRoom, matched: string): RoomFacility[] {
  return (room.amenities ?? [])
    .filter((label) => !RULES.some((rule) => rule.match.test(label.toLowerCase())))
    .filter((label) => !matched.includes(label.toLowerCase()))
    .map((label) => ({ key: slug(label), label }));
}

export function deriveRoomFacilities(room: ContentRoom): RoomFacility[] {
  const text = haystack(room);
  const claimed = new Set<string>();
  const out: RoomFacility[] = [];

  for (const rule of RULES) {
    if (rule.group && claimed.has(rule.group)) continue;
    if (!rule.match.test(text)) continue;
    if (rule.group) claimed.add(rule.group);
    out.push({ key: rule.key, label: rule.label });
  }

  return withBedType(
    [...out, ...extras(room, out.map((f) => f.label.toLowerCase()).join(' '))],
    room,
  );
}

// "King or twin beds" is what the property published; "King-size bed" is what
// the catalogue would print. Where the content states a bed type, it wins —
// the catalogue's job here is the icon, not the wording.
function withBedType(facilities: RoomFacility[], room: ContentRoom): RoomFacility[] {
  if (!room.bedType) return facilities;
  const bedIndex = facilities.findIndex((facility) => BY_KEY.get(facility.key)?.group === 'bed');
  if (bedIndex === -1) return [{ key: 'bed', label: room.bedType }, ...facilities];
  return facilities.map((facility, i) =>
    i === bedIndex ? { key: facility.key, label: room.bedType as string } : facility,
  );
}

// What a page renders: staff's list where they have made one, the derived list
// otherwise. An unknown key keeps its own label where the room still carries it
// and is dropped otherwise — a key that left the catalogue should disappear,
// not print itself.
export function roomFacilities(
  room: ContentRoom | undefined,
  stored?: string[] | null,
): RoomFacility[] {
  if (!stored || stored.length === 0) return room ? deriveRoomFacilities(room) : [];

  const fromContent = new Map(
    (room ? deriveRoomFacilities(room) : []).map((facility) => [facility.key, facility]),
  );
  return stored
    .map((key) => {
      const rule = BY_KEY.get(key);
      if (rule) return { key: rule.key, label: rule.label };
      return fromContent.get(key) ?? null;
    })
    .filter((facility): facility is RoomFacility => facility !== null)
    .map((facility) => (room ? (withBedType([facility], room)[0] ?? facility) : facility));
}
