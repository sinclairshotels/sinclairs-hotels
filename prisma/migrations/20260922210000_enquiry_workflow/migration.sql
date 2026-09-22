-- Enquiries become work someone owns and closes, rather than a list that only
-- grows, and notification addresses move out of the content files so they can
-- be changed without a deploy.

CREATE TYPE "EnquiryCloseReason" AS ENUM ('BOOKED', 'DECLINED', 'NO_RESPONSE', 'SPAM');

ALTER TABLE "Enquiry" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "Enquiry" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "Enquiry" ADD COLUMN "closeReason" "EnquiryCloseReason";
ALTER TABLE "Enquiry" ADD COLUMN "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "Enquiry" ADD COLUMN "statusChangedLabel" TEXT;
ALTER TABLE "Enquiry" ADD COLUMN "replyNote" TEXT;

CREATE INDEX "Enquiry_assignedToUserId_idx" ON "Enquiry"("assignedToUserId");
CREATE INDEX "Enquiry_status_createdAt_idx" ON "Enquiry"("status", "createdAt");

ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NotificationEmail" (
    "id" TEXT NOT NULL,
    "hotelSlug" TEXT,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationEmail_hotelSlug_idx" ON "NotificationEmail"("hotelSlug");

-- Two partial indexes rather than one @@unique, because Postgres treats NULLs
-- as distinct: a plain unique on (hotelSlug, address) would happily accept the
-- same central address twice.
CREATE UNIQUE INDEX "NotificationEmail_hotel_address_key"
  ON "NotificationEmail"("hotelSlug", "address") WHERE "hotelSlug" IS NOT NULL;
CREATE UNIQUE INDEX "NotificationEmail_central_address_key"
  ON "NotificationEmail"("address") WHERE "hotelSlug" IS NULL;
