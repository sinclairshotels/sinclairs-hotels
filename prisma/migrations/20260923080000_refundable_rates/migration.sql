-- Refundable rates. Reverses the all-non-refundable decision recorded in
-- PLAN.md, so every existing booking keeps the terms it was sold under:
-- the column defaults to NON_REFUNDABLE and no row is rewritten.

CREATE TYPE "BookingRateType" AS ENUM ('NON_REFUNDABLE', 'REFUNDABLE');

ALTER TABLE "Booking"
  ADD COLUMN "rateType" "BookingRateType" NOT NULL DEFAULT 'NON_REFUNDABLE',
  ADD COLUMN "cancellationDeadline" DATE,
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- Nullable together on purpose: both null means the property sells no
-- refundable rate, which is a different thing from selling one at 0% uplift.
ALTER TABLE "HotelSettings"
  ADD COLUMN "refundableUpliftPct" DECIMAL(5,2),
  ADD COLUMN "freeCancellationDays" INTEGER;
