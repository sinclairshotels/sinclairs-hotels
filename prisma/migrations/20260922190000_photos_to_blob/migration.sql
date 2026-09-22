-- Photo bytes move out of Postgres into Vercel Blob. Postgres keeps the
-- mapping (which position renders which photo) and the audit trail; the image
-- itself is served from the CDN rather than through a serverless function that
-- had to wake up to read a BYTEA column.

ALTER TABLE "PhotoAsset" ADD COLUMN "blobUrl" TEXT;
ALTER TABLE "PhotoAsset" ADD COLUMN "blobPath" TEXT;

-- Any row still holding bytes was written before blob storage existed and has
-- nowhere to be served from once the column goes. Superseding rather than
-- deleting keeps it readable in the audit trail for its retention window; the
-- position falls back to the photo in the repository, which is what it showed
-- before the replacement.
UPDATE "PhotoAsset" SET "supersededAt" = NOW() WHERE "data" IS NOT NULL AND "supersededAt" IS NULL;

ALTER TABLE "PhotoAsset" DROP COLUMN "data";
