-- Who counts as a child, per property. Defaults are the group's published
-- brackets, so every existing row starts where the printed policy already is.
ALTER TABLE "HotelSettings" ADD COLUMN "childFreeUnder" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "HotelSettings" ADD COLUMN "childMaxAge" INTEGER NOT NULL DEFAULT 12;
