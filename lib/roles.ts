import type { SectionLevel, UserRole } from '@prisma/client';

// Pure authorization data and predicates, kept apart from lib/auth.ts because
// that module reaches Prisma and node:crypto — importing it from a client
// component would drag the database client into the browser bundle. Everything
// here is safe on either side.

// One per sidebar item, which is the point: what an Admin ticks on the user
// form is what the person sees in the nav. Users and Tax are deliberately
// absent — they are Admin-only and cannot be granted.
export const SECTIONS = [
  'today',
  'bookings',
  'rates',
  'vouchers',
  'payments',
  'enquiries',
  'newsletter',
  'photos',
  'careers',
  'audit',
] as const;

export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  today: 'Today',
  bookings: 'Bookings',
  rates: 'Rates',
  vouchers: 'Vouchers',
  payments: 'Payments',
  enquiries: 'Enquiries',
  newsletter: 'Newsletter',
  photos: 'Photos',
  careers: 'Careers',
  audit: 'Audit',
};

// What EDIT actually lets someone do, where it is not obvious from the name.
// Shown on the form so an Admin is not guessing at the consequence of a tick.
export const SECTION_EDIT_NOTES: Partial<Record<Section, string>> = {
  payments: 'Edit can refund money through ICICI.',
  careers: 'Edit can publish a job to the public site and read applicants\u2019 CVs.',
  audit: 'The log is a record; Edit adds nothing over View.',
  today: 'A summary screen; Edit adds nothing over View.',
};

export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  // Read fresh on every request rather than copied into the session, so an
  // Admin changing someone's access takes effect on that person's next page
  // load without them signing out.
  grants: Partial<Record<Section, SectionLevel>>;
  // True means every property, including ones added after this account was
  // made. False means exactly `hotels`.
  allProperties: boolean;
  hotels: string[];
  sessionId: string;
}

// The vocabulary the pages and server actions check in. It stays capability
// -shaped rather than becoming (section, level) at every call site: there are
// twenty of them, they read well, and the mapping below is the only place the
// two models have to agree.
export type Capability =
  | 'today:read'
  | 'rates:read'
  | 'rates:write'
  | 'bookings:read'
  | 'bookings:write'
  | 'payments:read'
  | 'payments:refund'
  | 'vouchers:read'
  | 'vouchers:write'
  | 'enquiries:read'
  | 'newsletter:read'
  | 'photos:read'
  | 'photos:manage'
  | 'careers:read'
  | 'careers:write'
  | 'audit:read'
  // Admin-only, and therefore mapped to no section at all: these cannot be
  // granted to a User by ticking anything.
  | 'users:manage'
  | 'tax:manage';

const CAPABILITY_SECTION: Record<Capability, { section: Section; level: SectionLevel } | null> = {
  'today:read': { section: 'today', level: 'VIEW' },
  'rates:read': { section: 'rates', level: 'VIEW' },
  'rates:write': { section: 'rates', level: 'EDIT' },
  'bookings:read': { section: 'bookings', level: 'VIEW' },
  'bookings:write': { section: 'bookings', level: 'EDIT' },
  'payments:read': { section: 'payments', level: 'VIEW' },
  'payments:refund': { section: 'payments', level: 'EDIT' },
  'vouchers:read': { section: 'vouchers', level: 'VIEW' },
  'vouchers:write': { section: 'vouchers', level: 'EDIT' },
  'enquiries:read': { section: 'enquiries', level: 'VIEW' },
  'newsletter:read': { section: 'newsletter', level: 'VIEW' },
  'photos:read': { section: 'photos', level: 'VIEW' },
  'photos:manage': { section: 'photos', level: 'EDIT' },
  'careers:read': { section: 'careers', level: 'VIEW' },
  'careers:write': { section: 'careers', level: 'EDIT' },
  'audit:read': { section: 'audit', level: 'VIEW' },
  'users:manage': null,
  'tax:manage': null,
};

export function can(user: Pick<AuthedUser, 'role' | 'grants'>, capability: Capability): boolean {
  if (user.role === 'ADMIN') return true;

  const needed = CAPABILITY_SECTION[capability];
  // null is an Admin-only capability. A User reaching one is not a missing
  // tick, it is a thing that cannot be ticked.
  if (!needed) return false;

  const held = user.grants[needed.section];
  if (!held) return false;
  return needed.level === 'VIEW' ? true : held === 'EDIT';
}

export function canAccessHotel(
  user: Pick<AuthedUser, 'role' | 'allProperties' | 'hotels'>,
  slug: string,
): boolean {
  if (user.role === 'ADMIN' || user.allProperties) return true;
  return user.hotels.includes(slug);
}

// A Prisma filter fragment for "only the hotels this user may see". Spread into
// a where clause so a scoped user's list query cannot return another property's
// rows even if the page forgets to filter.
export function hotelScopeFilter(user: Pick<AuthedUser, 'role' | 'allProperties' | 'hotels'>): {
  hotelSlug?: { in: string[] };
} {
  if (user.role === 'ADMIN' || user.allProperties) return {};
  return { hotelSlug: { in: user.hotels } };
}
