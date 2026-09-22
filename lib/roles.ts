import type { UserRole } from '@prisma/client';

// Pure authorization data and predicates, kept apart from lib/auth.ts because
// that module reaches Prisma and node:crypto — importing it from a client
// component would drag the database client into the browser bundle. Everything
// here is safe on either side.

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  // null means every property — the central team. A non-null list is a
  // restriction, which is why the check reads "restricted to" rather than
  // "allowed": a user with no restriction sees everything.
  restrictedToHotels: string[] | null;
  sessionId: string;
}

export type Capability =
  | 'rates:read'
  | 'rates:write'
  | 'bookings:read'
  | 'bookings:write'
  | 'setup:read'
  | 'setup:write'
  | 'reports:read'
  | 'payments:read'
  | 'payments:refund'
  | 'vouchers:read'
  | 'vouchers:write'
  | 'enquiries:read'
  | 'users:manage'
  | 'photos:manage'
  | 'audit:read';

const READ_ONLY: Capability[] = [
  'rates:read',
  'bookings:read',
  'setup:read',
  'reports:read',
  'payments:read',
  'vouchers:read',
  'enquiries:read',
];

// One table, read top to bottom, is the whole authorization model. Anything
// not listed is denied — a capability added later is off for every role until
// it is put here deliberately.
const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  ADMIN: [
    ...READ_ONLY,
    'rates:write',
    'bookings:write',
    'setup:write',
    'payments:refund',
    'vouchers:write',
    'users:manage',
    'photos:manage',
    'audit:read',
  ],
  // Sets what rooms sell for and reads how that performed. Deliberately cannot
  // touch a booking or move money.
  REVENUE: [...READ_ONLY, 'rates:write', 'setup:write', 'audit:read'],
  // Runs the desk: takes and changes bookings. No rate
  // editing, and refunds stay with an Admin.
  RESERVATIONS: [...READ_ONLY, 'bookings:write', 'vouchers:write'],
  // Same as Reservations but only for their own property, enforced separately
  // by the hotel scope — and no rate editing, which stays central.
  HOTEL: [
    'rates:read',
    'bookings:read',
    'bookings:write',
    'setup:read',
    'vouchers:read',
    'enquiries:read',
    'payments:read',
  ],
  VIEWER: READ_ONLY,
};

export function can(user: Pick<AuthedUser, 'role'>, capability: Capability): boolean {
  return ROLE_CAPABILITIES[user.role].includes(capability);
}

export function canAccessHotel(
  user: Pick<AuthedUser, 'restrictedToHotels'>,
  slug: string,
): boolean {
  return user.restrictedToHotels === null || user.restrictedToHotels.includes(slug);
}

// A Prisma filter fragment for "only the hotels this user may see". Spread into
// a where clause so a scoped user's list query cannot return another property's
// rows even if the page forgets to filter.
export function hotelScopeFilter(user: Pick<AuthedUser, 'restrictedToHotels'>): {
  hotelSlug?: { in: string[] };
} {
  return user.restrictedToHotels === null ? {} : { hotelSlug: { in: user.restrictedToHotels } };
}
