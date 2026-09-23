-- What is in the room, as lib/room-facilities.ts catalogue keys. Empty is the
-- real default: the site derives the list from the room's own copy until staff
-- edit it, so an empty array means "not edited" rather than "nothing in it".
ALTER TABLE "RoomType" ADD COLUMN "facilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
