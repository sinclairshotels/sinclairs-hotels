-- /ipay/result was addressed by orderId, which is YYMMDD plus ten hex
-- characters and travels in receipts and emails. Payment gets the same
-- unguessable token Booking and Voucher already have, so a transaction number
-- is no longer enough to open that transaction's page.
ALTER TABLE "Payment" ADD COLUMN "viewToken" TEXT;

-- Existing rows keep working: without a token their receipt page would 404,
-- and that includes the legacy-imported transactions staff still look up.
UPDATE "Payment"
SET "viewToken" = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE "viewToken" IS NULL;

CREATE UNIQUE INDEX "Payment_viewToken_key" ON "Payment"("viewToken");
