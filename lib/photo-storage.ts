import { del, put } from '@vercel/blob';

// Replaced photos cannot be written back to public/ — that directory is baked
// into the deployment and Vercel's filesystem is read-only at runtime — so the
// bytes go to Vercel Blob and Postgres keeps only the mapping and the audit
// trail. They were in Postgres first, which worked but put megabytes of image
// data in every backup, through the connection pool on every read, and behind a
// serverless function that had to wake to serve a file the CDN could have.
//
// There is deliberately no fallback to the database when the token is missing:
// a second storage path is a second set of bugs, and a photo that silently
// lands somewhere other than where the site reads it is worse than an upload
// that refuses.
export const BLOB_TOKEN_ENV = 'BLOB_READ_WRITE_TOKEN';

export class PhotoStorageUnconfigured extends Error {
  constructor() {
    super(`Photo uploads need ${BLOB_TOKEN_ENV}. Choose from library still works without it.`);
    this.name = 'PhotoStorageUnconfigured';
  }
}

export function photoStorageConfigured(): boolean {
  return Boolean(process.env[BLOB_TOKEN_ENV]);
}

// The slot key is in the path so a blob can be traced back to the position it
// fills without reading Postgres, and `addRandomSuffix` keeps a re-upload to
// the same position from colliding with the copy still inside its retention
// window.
export async function putPhoto(
  slotKey: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ url: string; pathname: string }> {
  if (!photoStorageConfigured()) throw new PhotoStorageUnconfigured();

  const safeSlot = slotKey.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { url, pathname } = await put(`photos/${safeSlot}.webp`, bytes, {
    access: 'public',
    contentType,
    addRandomSuffix: true,
    // A new upload is a new URL, so the object never needs revalidating.
    cacheControlMaxAge: 31536000,
  });
  return { url, pathname };
}

export async function deletePhoto(url: string): Promise<void> {
  if (!photoStorageConfigured()) throw new PhotoStorageUnconfigured();
  await del(url);
}
