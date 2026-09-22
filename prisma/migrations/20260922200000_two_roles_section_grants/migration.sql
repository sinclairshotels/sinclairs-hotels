-- Five roles become two. ADMIN is everything; everyone else becomes a USER
-- holding exactly the sections their old role could reach, so nobody gains or
-- loses access in the move.

CREATE TYPE "SectionLevel" AS ENUM ('VIEW', 'EDIT');

CREATE TABLE "UserSectionGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "level" "SectionLevel" NOT NULL,

    CONSTRAINT "UserSectionGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSectionGrant_userId_section_key" ON "UserSectionGrant"("userId", "section");
CREATE INDEX "UserSectionGrant_userId_idx" ON "UserSectionGrant"("userId");

ALTER TABLE "UserSectionGrant" ADD CONSTRAINT "UserSectionGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "allProperties" BOOLEAN NOT NULL DEFAULT false;

-- "No rows in UserHotel" used to mean every property. That meaning is now a
-- column, so it survives the rows being edited or lost.
UPDATE "User" u
   SET "allProperties" = true
 WHERE NOT EXISTS (SELECT 1 FROM "UserHotel" h WHERE h."userId" = u."id");

-- The old matrix, transcribed. Read against lib/roles.ts as it stood before
-- this migration: READ_ONLY covered today, bookings, rates, vouchers, payments,
-- enquiries and newsletter for every role; the writes and audit differed.
INSERT INTO "UserSectionGrant" ("id", "userId", "section", "level")
SELECT
  gen_random_uuid()::text,
  u."id",
  s."section",
  CASE
    WHEN u."role" = 'REVENUE'      AND s."section" = 'rates'    THEN 'EDIT'
    WHEN u."role" = 'RESERVATIONS' AND s."section" IN ('bookings', 'vouchers') THEN 'EDIT'
    WHEN u."role" = 'HOTEL'        AND s."section" = 'bookings' THEN 'EDIT'
    ELSE 'VIEW'
  END::"SectionLevel"
FROM "User" u
CROSS JOIN (VALUES
  ('today'), ('bookings'), ('rates'), ('vouchers'),
  ('payments'), ('enquiries'), ('newsletter')
) AS s("section")
WHERE u."role" <> 'ADMIN';

-- Only Revenue could read the audit log; nobody but an Admin could manage
-- photos, so no photo grant is created for anyone.
INSERT INTO "UserSectionGrant" ("id", "userId", "section", "level")
SELECT gen_random_uuid()::text, u."id", 'audit', 'VIEW'::"SectionLevel"
FROM "User" u
WHERE u."role" = 'REVENUE';

CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new"
  USING (CASE WHEN "role" = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END)::"UserRole_new";
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
