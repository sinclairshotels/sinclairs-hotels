-- AlterTable
ALTER TABLE "HotelSettings" DROP COLUMN "ratePlanPricing",
DROP COLUMN "releaseWindowDays",
ADD COLUMN     "breakfastSupplement" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RatePlan" DROP COLUMN "supplementPerAdult",
DROP COLUMN "supplementPerChild";

-- DropEnum
DROP TYPE "RatePlanPricing";

-- CreateTable
CREATE TABLE "TaxSetting" (
    "id" TEXT NOT NULL,
    "threshold" DECIMAL(10,2) NOT NULL,
    "lowRate" DECIMAL(5,4) NOT NULL,
    "highRate" DECIMAL(5,4) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxSetting_effectiveFrom_idx" ON "TaxSetting"("effectiveFrom");

