import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Postgres aborts the loser of a Serializable conflict (SQLSTATE 40001), which
// Prisma surfaces as P2034. It is not an error in the usual sense — it means
// "your snapshot is stale, do it again" — so both the booking and the
// settlement paths need to recognise it rather than treat it as a crash.
export function isWriteConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
}

export const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;
