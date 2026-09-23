-- To / CC / BCC per admin page, replacing one flat list of addresses.
--
-- Split across two migrations on purpose: Postgres refuses to use an enum value
-- inside the same transaction that added it, so the values land here and the
-- rows that use them are copied in the migration after this one.

CREATE TYPE "NotificationField" AS ENUM ('TO', 'CC', 'BCC');

ALTER TABLE "NotificationEmail"
  ADD COLUMN IF NOT EXISTS "field" "NotificationField" NOT NULL DEFAULT 'TO';

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'BOOKING';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'VOUCHER';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'ENQUIRY';
