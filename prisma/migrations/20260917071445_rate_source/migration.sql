-- CreateEnum
CREATE TYPE "RateSource" AS ENUM ('MONTHLY', 'DAILY');

-- AlterTable
ALTER TABLE "RatePrice" ADD COLUMN     "source" "RateSource" NOT NULL DEFAULT 'MONTHLY';

-- AlterTable
ALTER TABLE "RoomInventory" ADD COLUMN     "source" "RateSource" NOT NULL DEFAULT 'MONTHLY';
