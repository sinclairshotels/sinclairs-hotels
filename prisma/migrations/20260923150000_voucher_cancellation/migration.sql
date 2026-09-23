-- Cancelling a voucher marks it rather than deleting it: it was sent to a
-- guest and quoted to a property, and a row that vanishes cannot answer what
-- happened to it. The actor's label is stored alongside the reason so the
-- record still reads correctly after that staff account is deleted.
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "cancelledReason" TEXT;
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "cancelledByLabel" TEXT;
