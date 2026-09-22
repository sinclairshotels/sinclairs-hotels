-- AlterTable
ALTER TABLE "PhotoAsset" ADD COLUMN     "sourcePath" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

