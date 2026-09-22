-- The reply summary becomes a thread: one entry per reply, with who wrote it
-- and when, never overwritten. A single field lost the previous reply every
-- time someone added to it, which is the opposite of what a handover needs.

CREATE TABLE "EnquiryNote" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorLabel" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnquiryNote_enquiryId_at_idx" ON "EnquiryNote"("enquiryId", "at");

ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_enquiryId_fkey"
  FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry across anything already written in the single field rather than
-- dropping it. Neither the author nor the time it was written was recorded —
-- the column held only the text — so the label says so instead of inventing a
-- name, and the timestamp is the migration's own.
INSERT INTO "EnquiryNote" ("id", "enquiryId", "body", "authorLabel", "at")
SELECT gen_random_uuid()::text, e."id", e."replyNote",
       'Unknown — written before notes recorded an author', NOW()
FROM "Enquiry" e
WHERE e."replyNote" IS NOT NULL AND btrim(e."replyNote") <> '';

ALTER TABLE "Enquiry" DROP COLUMN "replyNote";
