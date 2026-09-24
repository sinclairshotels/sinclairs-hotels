-- What the voucher sold, and on what meal plan. Null on every voucher written
-- before the form asked, which prints as nothing rather than as a guess.
ALTER TABLE "Voucher" ADD COLUMN "roomCategory" TEXT;
ALTER TABLE "Voucher" ADD COLUMN "mealPlan" TEXT;
