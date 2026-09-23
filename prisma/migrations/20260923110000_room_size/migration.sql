-- Room size, in square feet as the properties measure it. Nullable because ten
-- of the thirty-nine rooms have never been measured; scripts/sync-room-types.ts
-- fills in the ones the content files already knew, and leaves the rest for
-- staff to enter on /admin/rates/monthly.
ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "sizeSqFt" INTEGER;
