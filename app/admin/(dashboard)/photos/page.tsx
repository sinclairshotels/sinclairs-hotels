import { PhotoLibraryProvider } from '@/components/admin/photo-library';
import { PhotoSlotCard, type SlotView } from '@/components/admin/photo-slot';
import { formatDate } from '@/lib/admin-format';
import { can, getSession } from '@/lib/auth';
import {
  MAX_PUBLIC_BYTES,
  fileInfos,
  formatBytes,
  publicImageBytes,
  publicImagePaths,
} from '@/lib/photo-files';
import { type PhotoSlot, claimedPaths, photoPages } from '@/lib/photo-slots';
import { type PhotoOverride, currentOverrides, overrideUrl, retiredPaths } from '@/lib/photos';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const fileNameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export default async function PhotosPage() {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'photos:manage')) notFound();

  const pages = photoPages();
  const claimed = claimedPaths();

  const [overrides, retired, files, publicBytes, everyImage] = await Promise.all([
    currentOverrides(),
    retiredPaths(),
    fileInfos([...claimed]),
    publicImageBytes(),
    publicImagePaths(),
  ]);

  const view = (slot: PhotoSlot): SlotView => {
    const override = overrides.get(slot.contentPath);
    const file = files.get(slot.contentPath);
    const shown = override ?? file;

    return {
      key: slot.key,
      label: slot.label,
      contentPath: slot.contentPath,
      targetWidth: slot.targetWidth,
      src: override ? overrideUrl(override) : slot.contentPath,
      fileName: fileNameOf(slot.contentPath),
      width: shown?.width ?? 0,
      height: shown?.height ?? 0,
      size: shown ? formatBytes(shown.bytes) : '—',
      missing: !file && !override,
      ...(override ? { replaced: replacedBy(override) } : {}),
    };
  };

  const unusedPaths = everyImage.filter((path) => !claimed.has(path) && !retired.has(path));
  const unusedFiles = await fileInfos(unusedPaths);
  const unused: SlotView[] = unusedPaths.map((path) => {
    const file = unusedFiles.get(path);
    return {
      key: `unused:${path}`,
      label: path.replace('/images/', ''),
      contentPath: path,
      targetWidth: 0,
      src: path,
      fileName: fileNameOf(path),
      width: file?.width ?? 0,
      height: file?.height ?? 0,
      size: file ? formatBytes(file.bytes) : '—',
      missing: !file,
    };
  });

  const overrideBytes = [...overrides.values()].reduce((total, o) => total + o.bytes, 0);
  const usedBytes = publicBytes + overrideBytes;
  const slotCount = pages.reduce(
    (total, page) => total + page.sections.reduce((n, section) => n + section.slots.length, 0),
    0,
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Photos</p>
        <p className="mt-1 max-w-3xl text-sm text-ink/60">
          Every photo position on the site, page by page. Replacing one converts the upload to WebP
          at the size that position is served at, and the photo it replaced is kept for 30 days.
        </p>
        <p className="mt-2 text-xs text-ink/50">
          {slotCount} positions · {unused.length} unused files ·{' '}
          <span className={usedBytes > MAX_PUBLIC_BYTES * 0.9 ? 'text-red-700' : ''}>
            {formatBytes(usedBytes)} of {formatBytes(MAX_PUBLIC_BYTES)} used
          </span>
        </p>
      </div>

      <PhotoLibraryProvider>
        <div className="mt-6 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {pages.map((page, i) => (
            <details key={page.key} open={i === 0} className="rounded-lg border border-ink/10">
              <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium text-forest">
                {page.title}
                <span className="ml-2 font-normal text-ink/40">{page.href}</span>
              </summary>
              <div className="space-y-6 border-t border-ink/10 px-5 py-5">
                {page.sections.map((section) => (
                  <section key={section.key}>
                    <p className="text-xs uppercase tracking-wider text-ink/50">{section.title}</p>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {section.slots.map((slot) => (
                        <PhotoSlotCard key={slot.key} slot={view(slot)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </details>
          ))}

          <details className="rounded-lg border border-ink/10">
            <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium text-forest">
              Not used on any page
              <span className="ml-2 font-normal text-ink/40">{unused.length} files</span>
            </summary>
            <div className="border-t border-ink/10 px-5 py-5">
              <p className="text-xs text-ink/50">
                In the repository but rendered nowhere. Deleting one records the decision and hides
                it here; the file itself leaves on the next <code>pnpm photos:prune</code> commit.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {unused.map((slot) => (
                  <PhotoSlotCard key={slot.key} slot={slot} deletable replaceable={false} />
                ))}
              </div>
              {unused.length === 0 && (
                <p className="mt-4 text-sm text-ink/60">Every image in the repository is in use.</p>
              )}
            </div>
          </details>
        </div>
      </PhotoLibraryProvider>
    </div>
  );
}

function replacedBy(override: PhotoOverride) {
  return {
    uploadedLabel: override.uploadedLabel,
    uploadedAt: formatDate(override.uploadedAt),
    originalName: override.originalName,
    fromLibrary: override.sourcePath !== null,
  };
}
