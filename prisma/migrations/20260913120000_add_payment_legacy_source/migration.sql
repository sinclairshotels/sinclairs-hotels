-- Marks payments that were imported from the legacy MySQL rather than taken by
-- this app. Without it an imported CCAvenue-era transaction is indistinguishable
-- from a live i-Pay one, and the admin Payments page offers a Refund button that
-- ICICI can only reject.
ALTER TABLE "Payment" ADD COLUMN "legacySource" TEXT;

-- Backfill the rows already imported by scripts/migrate-legacy-data.ts.
-- migratePayment() is the only writer that leaves userIp null AND guestPhone
-- empty: app/(site)/ipay/actions.ts always stores clientIp(), which falls back
-- to 'unknown' and is never null, and ipaySchema requires a 7+ character phone.
-- (prisma/seed-dev.ts also omits userIp, hence the guestPhone half of this.)
UPDATE "Payment"
SET "legacySource" = 'cca_status'
WHERE "userIp" IS NULL AND "guestPhone" = '';
