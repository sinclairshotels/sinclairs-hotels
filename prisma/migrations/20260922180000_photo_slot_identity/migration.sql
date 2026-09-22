-- A photo override belongs to a position, not to a file. Two positions can
-- render the same photo — a hotel's hero is also its listing card — and
-- replacing one of them must leave the other alone.

-- Any override written under the old rule applied to every position sharing the
-- file, which is the behaviour being removed. There is no correct way to guess
-- which position each was meant for, so they are retired rather than migrated:
-- superseded rows stop resolving but stay readable for PHOTO_RETENTION_DAYS.
UPDATE "PhotoAsset" SET "supersededAt" = NOW() WHERE "supersededAt" IS NULL;

CREATE INDEX "PhotoAsset_slotKey_supersededAt_idx" ON "PhotoAsset"("slotKey", "supersededAt");

-- One live override per position, enforced rather than assumed: the upload path
-- supersedes the previous row and inserts the new one in a transaction, and a
-- crash between the two would otherwise leave a position with two answers.
CREATE UNIQUE INDEX "PhotoAsset_slotKey_live_key" ON "PhotoAsset"("slotKey") WHERE "supersededAt" IS NULL;
