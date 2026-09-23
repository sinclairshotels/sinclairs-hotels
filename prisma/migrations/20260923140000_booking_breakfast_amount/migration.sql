-- What breakfast cost, stored on the booking the way the tax it was priced
-- with is. Nullable rather than defaulted to 0: a booking taken before this
-- column existed has no figure, and 0 would claim it had no breakfast when
-- its plan name says otherwise. The export prints the guest count and plan
-- for those, and rupees for everything after.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "breakfastAmount" DECIMAL(10,2);
