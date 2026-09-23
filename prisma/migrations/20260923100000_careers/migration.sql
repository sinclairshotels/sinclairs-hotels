-- Careers. Reverses the earlier "not doing" recorded in docs/CONTENT_BACKLOG.md.

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'CAREERS';

CREATE TABLE "JobPosition" (
  "id"              TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "hotelSlug"       TEXT,
  "department"      TEXT NOT NULL,
  "descriptionText" TEXT,
  "jdUrl"           TEXT,
  "jdFileName"      TEXT,
  "open"            BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobPosition_open_hotelSlug_idx" ON "JobPosition" ("open", "hotelSlug");

CREATE TABLE "JobApplication" (
  "id"            TEXT NOT NULL,
  -- Nullable so a general application has somewhere to go, and so deleting a
  -- position does not delete the people who applied to it.
  "positionId"    TEXT,
  "positionLabel" TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "phone"         TEXT NOT NULL,
  "city"          TEXT,
  "message"       TEXT,
  "cvUrl"         TEXT,
  "cvFileName"    TEXT,
  "cvSize"        INTEGER,
  "userIp"        TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobApplication_positionId_createdAt_idx" ON "JobApplication" ("positionId", "createdAt");
CREATE INDEX "JobApplication_createdAt_idx" ON "JobApplication" ("createdAt");

ALTER TABLE "JobApplication"
  ADD CONSTRAINT "JobApplication_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
