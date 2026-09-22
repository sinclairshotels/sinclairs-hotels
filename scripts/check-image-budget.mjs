// Fails the build if public/ drifts back toward the state that put deployment
// storage at 20 GB against a 10 GB allowance: un-converted source images, or a
// public/ directory that has quietly grown.
//
// Every deployment uploads public/ in full and Vercel retains every deployment,
// so a single committed 27 MB JPEG is not 27 MB — it is 27 MB times every build
// made afterwards. That is not obvious while committing it, which is exactly why
// this is a check and not a convention.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PUBLIC_DIR = 'public';

// Raised deliberately, never drifted into. If a genuine need pushes public/ past
// this, move the images to a CDN rather than lifting the ceiling — the ceiling is
// the thing keeping deploy size bounded. The numbers live in config/ because the
// admin's photo replacement enforces the same two limits before it accepts an
// upload, and a build check that disagreed with the upload form would let staff
// load something the next build then rejects.
const budget = JSON.parse(readFileSync('config/image-budget.json', 'utf8'));
const MAX_PUBLIC_MB = budget.maxPublicMb;

// Anything a browser is served that is not one of these is a source file that
// should have been converted, or an asset that belongs outside the repo.
const ALLOWED = new Set(['.webp', '.svg', '.png', '.ico', '.txt', '.xml', '.json', '.webmanifest']);

// One 1x1 favicon-class PNG is fine; a directory of them is not.
const MAX_SINGLE_FILE_MB = budget.maxSingleFileMb;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(PUBLIC_DIR);
const problems = [];
let totalBytes = 0;

for (const file of files) {
  const { size } = statSync(file);
  totalBytes += size;

  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  const rel = relative(PUBLIC_DIR, file);

  if (!ALLOWED.has(ext)) {
    problems.push(`unconvertible asset: ${rel} (${ext || 'no extension'})`);
  }
  if (size > MAX_SINGLE_FILE_MB * 1024 * 1024) {
    problems.push(`oversized: ${rel} is ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
}

const totalMb = totalBytes / 1024 / 1024;
if (totalMb > MAX_PUBLIC_MB) {
  problems.push(`public/ is ${totalMb.toFixed(0)} MB, over the ${MAX_PUBLIC_MB} MB budget`);
}

if (problems.length > 0) {
  console.error('\nImage budget check failed:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`
Convert source images before committing them:
  cwebp -q 82 -m 6 -resize 2400 0 in.jpg -o out.webp     # cards, galleries
  cwebp -q 82 -m 6 -resize 3840 0 in.jpg -o out.webp     # full-bleed heroes

Keep high-resolution originals outside the repo, in
~/Desktop/sinclairs-wp-backup/hires-originals/ — archived, never deleted.
`);
  process.exit(1);
}

console.log(
  `Image budget OK — public/ is ${totalMb.toFixed(0)} MB / ${MAX_PUBLIC_MB} MB, ${files.length} files.`,
);
