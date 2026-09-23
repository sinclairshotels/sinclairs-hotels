-- A Cancellations list, separate from the enquiry/booking one. Existing rows
-- default to GENERAL, so every address already configured keeps doing exactly
-- what it did.
CREATE TYPE "NotificationKind" AS ENUM ('GENERAL', 'CANCELLATION');

ALTER TABLE "NotificationEmail"
  ADD COLUMN "kind" "NotificationKind" NOT NULL DEFAULT 'GENERAL';

CREATE INDEX "NotificationEmail_kind_idx" ON "NotificationEmail" ("kind");
