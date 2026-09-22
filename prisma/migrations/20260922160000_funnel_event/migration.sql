-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "hotelSlug" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FunnelEvent_step_at_idx" ON "FunnelEvent"("step", "at");

-- CreateIndex
CREATE INDEX "FunnelEvent_hotelSlug_at_idx" ON "FunnelEvent"("hotelSlug", "at");

