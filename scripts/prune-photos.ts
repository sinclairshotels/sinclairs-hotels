import { rm } from 'node:fs/promises';
import { prisma } from '../lib/db';
import { publicPathOf } from '../lib/photo-files';
import { deletePhoto, photoStorageConfigured } from '../lib/photo-storage';
import { PHOTO_RETENTION_DAYS } from '../lib/photos';

// The half of /admin/photos that cannot happen at runtime. Vercel's filesystem
// is read-only and public/ is baked into the deployment, so a photo staff
// retired is only marked retired — the file itself leaves the repository here,
// in a commit a person makes and reviews.
//
// It also drops superseded uploads once they are past PHOTO_RETENTION_DAYS,
// which is what stops the PhotoAsset table becoming a second copy of public/.
async function main() {
  const cutoff = new Date(Date.now() - PHOTO_RETENTION_DAYS * 86_400_000);

  // The blob goes before the row. A row without its blob is a broken photo;
  // a blob without its row is a bill, and the next run cannot find it to
  // delete because nothing records it any more.
  const expired = await prisma.photoAsset.findMany({
    where: { supersededAt: { lt: cutoff } },
    select: { id: true, blobUrl: true },
  });

  let blobsDeleted = 0;
  for (const asset of expired) {
    if (!asset.blobUrl) continue;
    if (!photoStorageConfigured()) {
      console.error(`  cannot delete blob for ${asset.id}: BLOB_READ_WRITE_TOKEN is not set`);
      continue;
    }
    try {
      await deletePhoto(asset.blobUrl);
      blobsDeleted += 1;
    } catch (error) {
      console.error(`  could not delete blob for ${asset.id}: ${String(error)}`);
    }
  }

  const deletable = expired.filter((asset) => !asset.blobUrl || blobsDeleted > 0);
  const removedRows = await prisma.photoAsset.deleteMany({
    where: { id: { in: deletable.map((asset) => asset.id) } },
  });
  console.log(
    `superseded uploads deleted: ${removedRows.count} rows, ${blobsDeleted} blobs (older than ${PHOTO_RETENTION_DAYS} days)`,
  );

  const retired = await prisma.retiredPhoto.findMany();
  let removed = 0;
  for (const photo of retired) {
    try {
      await rm(publicPathOf(photo.contentPath), { force: true });
      removed += 1;
      console.log(`  removed ${photo.contentPath}`);
    } catch (error) {
      console.error(`  could not remove ${photo.contentPath}: ${String(error)}`);
    }
  }
  console.log(`retired files removed from public/: ${removed}`);
  if (removed > 0)
    console.log('\nCommit the deletions — the rows stay as the record of who retired them.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
