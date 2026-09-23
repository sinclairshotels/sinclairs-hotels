-- The contact form asks more than it used to: where the guest is, how they want
-- answering, and for a wedding or a meeting how far the date can move and how
-- many rooms they need. All additive and all nullable, so rows imported from the
-- legacy site stay valid without being invented into.

-- Postgres will not add an enum value inside the same transaction that uses it,
-- but nothing here uses it, so this is safe in the migration's own transaction.
ALTER TYPE "EnquiryType" ADD VALUE IF NOT EXISTS 'GROUP';

CREATE TYPE "EnquiryReplyChannel" AS ENUM ('WHATSAPP', 'PHONE', 'EMAIL');

ALTER TABLE "Enquiry"
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "pinCode" TEXT,
  ADD COLUMN "replyChannel" "EnquiryReplyChannel" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN "flexibility" TEXT,
  ADD COLUMN "roomsNeeded" INTEGER;

-- Partial, because the 35,837 legacy rows have no reference and never will:
-- NULLs are distinct to Postgres anyway, but saying so keeps the index small.
CREATE UNIQUE INDEX "Enquiry_reference_key" ON "Enquiry" ("reference") WHERE "reference" IS NOT NULL;
