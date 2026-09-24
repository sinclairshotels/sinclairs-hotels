-- The ages this booking was priced with. Empty on every booking taken before
-- the picker asked, which reads correctly: nobody stated an age.
ALTER TABLE "Booking" ADD COLUMN "childAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
