import { rm } from 'node:fs/promises';
import { prisma } from '../lib/db';
import { publicPathOf } from '../lib/photo-files';
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

  const expired = await prisma.photoAsset.deleteMany({
    where: { supersededAt: { lt: cutoff } },
  });
  console.log(
    `superseded uploads deleted: ${expired.count} (older than ${PHOTO_RETENTION_DAYS} days)`,
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
