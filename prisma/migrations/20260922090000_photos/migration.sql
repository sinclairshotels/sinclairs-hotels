-- CreateTable
CREATE TABLE "PhotoAsset" (
    "id" TEXT NOT NULL,
    "contentPath" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/webp',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedLabel" TEXT NOT NULL,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "PhotoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetiredPhoto" (
    "id" TEXT NOT NULL,
    "contentPath" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredLabel" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,

    CONSTRAINT "RetiredPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoAsset_contentPath_supersededAt_idx" ON "PhotoAsset"("contentPath", "supersededAt");

-- CreateIndex
CREATE INDEX "PhotoAsset_supersededAt_idx" ON "PhotoAsset"("supersededAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetiredPhoto_contentPath_key" ON "RetiredPhoto"("contentPath");

