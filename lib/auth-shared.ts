// Authentication constants that the browser and the edge middleware need.
// They live apart from lib/auth.ts because that module reaches next/headers,
// Prisma and node:crypto — importing it from a client component or from
// middleware fails the build rather than degrading quietly.

export const SESSION_COOKIE = 'staff_session';

export const MIN_PASSWORD_LENGTH = 12;
