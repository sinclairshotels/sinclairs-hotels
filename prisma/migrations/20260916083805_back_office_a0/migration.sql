/*
  Warnings:

  - You are about to drop the `RateChange` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RoomRate` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RatePlanCode" AS ENUM ('EP', 'CP', 'MAP', 'AP');

-- CreateEnum
CREATE TYPE "RatePlanPricing" AS ENUM ('ABSOLUTE', 'SUPPLEMENT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REVENUE', 'RESERVATIONS', 'HOTEL', 'VIEWER');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "ratePlanId" TEXT,
ADD COLUMN     "roomTypeId" TEXT;

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "hotelSlug" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "baseOccupancy" INTEGER NOT NULL DEFAULT 2,
    "maxAdults" INTEGER NOT NULL DEFAULT 3,
    "maxChildren" INTEGER NOT NULL DEFAULT 2,
    "maxTotal" INTEGER NOT NULL DEFAULT 4,
    "extraAdultCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "extraChildCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" TEXT NOT NULL,
    "hotelSlug" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "code" "RatePlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "supplementPerAdult" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "supplementPerChild" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomInventory" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "hotelSlug" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "roomsOnSale" INTEGER NOT NULL,
    "stopSell" BOOLEAN NOT NULL DEFAULT false,
    "minStay" INTEGER,
    "closedToArrival" BOOLEAN NOT NULL DEFAULT false,
    "closedToDeparture" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePrice" (
    "id" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "hotelSlug" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelSettings" (
    "hotelSlug" TEXT NOT NULL,
    "releaseWindowDays" INTEGER NOT NULL DEFAULT 3,
    "ratePlanPricing" "RatePlanPricing" NOT NULL DEFAULT 'ABSOLUTE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelSettings_pkey" PRIMARY KEY ("hotelSlug")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "hotelSlug" TEXT,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "passwordHash" TEXT,
    "setupToken" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserHotel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hotelSlug" TEXT NOT NULL,

    CONSTRAINT "UserHotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "hotelSlug" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomType_hotelSlug_idx" ON "RoomType"("hotelSlug");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_hotelSlug_contentKey_key" ON "RoomType"("hotelSlug", "contentKey");

-- CreateIndex
CREATE INDEX "RatePlan_hotelSlug_idx" ON "RatePlan"("hotelSlug");

-- CreateIndex
CREATE UNIQUE INDEX "RatePlan_roomTypeId_code_key" ON "RatePlan"("roomTypeId", "code");

-- CreateIndex
CREATE INDEX "RoomInventory_hotelSlug_date_idx" ON "RoomInventory"("hotelSlug", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RoomInventory_roomTypeId_date_key" ON "RoomInventory"("roomTypeId", "date");

-- CreateIndex
CREATE INDEX "RatePrice_hotelSlug_date_idx" ON "RatePrice"("hotelSlug", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RatePrice_ratePlanId_date_key" ON "RatePrice"("ratePlanId", "date");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_hotelSlug_key" ON "Holiday"("date", "hotelSlug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_setupToken_key" ON "User"("setupToken");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "UserHotel_hotelSlug_idx" ON "UserHotel"("hotelSlug");

-- CreateIndex
CREATE UNIQUE INDEX "UserHotel_userId_hotelSlug_key" ON "UserHotel"("userId", "hotelSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_lastSeenAt_idx" ON "Session"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AuditEvent_at_idx" ON "AuditEvent"("at");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_entityId_idx" ON "AuditEvent"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_hotelSlug_at_idx" ON "AuditEvent"("hotelSlug", "at");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_at_idx" ON "AuditEvent"("actorUserId", "at");

-- CreateIndex
CREATE INDEX "Booking_roomTypeId_checkIn_idx" ON "Booking"("roomTypeId", "checkIn");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInventory" ADD CONSTRAINT "RoomInventory_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePrice" ADD CONSTRAINT "RatePrice_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHotel" ADD CONSTRAINT "UserHotel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data migration: carry RoomRate and RateChange into the new tables before
-- dropping them. Written to be correct whether those tables hold nothing (the
-- expected case before cutover) or real rows, so no assumption about the
-- production database is load-bearing here.
-- ---------------------------------------------------------------------------

-- Room types, from every (hotel, room name) pair that either a rate or a
-- booking already refers to. scripts/sync-room-types.ts adds the rest from the
-- content files afterwards; SQL cannot read those.
INSERT INTO "RoomType" (id, "hotelSlug", "contentKey", "name", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, pair."hotelSlug", pair."roomName", pair."roomName", 0, NOW(), NOW()
FROM (
  SELECT DISTINCT "hotelSlug", "roomName" FROM "RoomRate"
  UNION
  SELECT DISTINCT "hotelSlug", "roomName" FROM "Booking"
) AS pair;

-- Everything sold so far was room-only, so each room type starts with EP.
INSERT INTO "RatePlan" (id, "hotelSlug", "roomTypeId", "code", "name", "sortOrder")
SELECT gen_random_uuid()::text, rt."hotelSlug", rt.id, 'EP'::"RatePlanCode", 'Room Only', 0
FROM "RoomType" rt;

-- The inventory half of the old RoomRate row.
INSERT INTO "RoomInventory" (id, "roomTypeId", "hotelSlug", "date", "roomsOnSale", "stopSell", "updatedAt")
SELECT gen_random_uuid()::text, rt.id, rr."hotelSlug", rr."date", rr."totalRooms", rr."closed", NOW()
FROM "RoomRate" rr
JOIN "RoomType" rt ON rt."hotelSlug" = rr."hotelSlug" AND rt."contentKey" = rr."roomName";

-- ...and the price half, against the EP plan.
INSERT INTO "RatePrice" (id, "ratePlanId", "hotelSlug", "date", "amount", "updatedAt")
SELECT gen_random_uuid()::text, rp.id, rr."hotelSlug", rr."date", rr."rate", NOW()
FROM "RoomRate" rr
JOIN "RoomType" rt ON rt."hotelSlug" = rr."hotelSlug" AND rt."contentKey" = rr."roomName"
JOIN "RatePlan" rp ON rp."roomTypeId" = rt.id AND rp."code" = 'EP'::"RatePlanCode";

-- Point existing bookings at the room type they consumed. roomName stays as
-- the snapshot of what was actually sold.
UPDATE "Booking" b
SET "roomTypeId" = rt.id, "ratePlanId" = rp.id
FROM "RoomType" rt
JOIN "RatePlan" rp ON rp."roomTypeId" = rt.id AND rp."code" = 'EP'::"RatePlanCode"
WHERE rt."hotelSlug" = b."hotelSlug" AND rt."contentKey" = b."roomName";

-- The old rate-only change log becomes rows in the general audit log.
INSERT INTO "AuditEvent" (id, "at", "actorLabel", "action", "entity", "entityId", "hotelSlug", "summary", "before", "after", "ip")
SELECT
  gen_random_uuid()::text,
  rc."createdAt",
  rc."actor",
  'rates.updated',
  'RoomInventory',
  NULL,
  rc."hotelSlug",
  rc."roomName" || ': ' || rc."nightsWritten" || ' nights written, ' || rc."nightsChanged" || ' changed',
  rc."previous",
  jsonb_build_object(
    'rate', rc."rate",
    'roomsOnSale', rc."totalRooms",
    'stopSell', rc."closed",
    'firstNight', rc."firstNight",
    'lastNight', rc."lastNight",
    'weekdays', to_jsonb(rc."weekdays")
  ),
  rc."actorIp"
FROM "RateChange" rc;

-- DropTable
DROP TABLE "RateChange";

-- DropTable
DROP TABLE "RoomRate";
