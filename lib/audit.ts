import type { AuthedUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface AuditInput {
  user: Pick<AuthedUser, 'id' | 'name' | 'email'>;
  // Dotted and past-tense, matching the server log's event names so a line in
  // the log and a row here describe the same thing by the same name.
  action: string;
  entity: string;
  entityId?: string | null;
  hotelSlug?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

// Writes the staff-facing record of a change. Deliberately separate from
// lib/log.ts: that is an operational stream Vercel indexes and eventually
// rotates away, this is the durable answer to "who changed this rate", which
// has to survive as long as the booking it affected.
export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorUserId: input.user.id,
      // Stored alongside the foreign key so the log still reads correctly
      // after a user is deleted and the relation nulls out.
      actorLabel: `${input.user.name} <${input.user.email}>`,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      hotelSlug: input.hotelSlug ?? null,
      summary: input.summary ?? null,
      before: (input.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      after: (input.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      ip: input.ip ?? null,
    },
  });
}
