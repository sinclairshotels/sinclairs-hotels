-- CreateTable
CREATE TABLE "RateChange" (
    "id" TEXT NOT NULL,
    "hotelSlug" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "firstNight" DATE NOT NULL,
    "lastNight" DATE NOT NULL,
    "weekdays" INTEGER[],
    "nightsWritten" INTEGER NOT NULL,
    "nightsChanged" INTEGER NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL,
    "previous" JSONB NOT NULL,
    "actor" TEXT NOT NULL,
    "actorIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateChange_hotelSlug_createdAt_idx" ON "RateChange"("hotelSlug", "createdAt");

-- CreateIndex
CREATE INDEX "RateChange_createdAt_idx" ON "RateChange"("createdAt");
