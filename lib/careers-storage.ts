import { BLOB_TOKEN_ENV, photoStorageConfigured } from '@/lib/photo-storage';
import { put } from '@vercel/blob';

// CVs and job descriptions go to Vercel Blob for the same reasons photos do:
// the deployment's filesystem is read-only, and a file column would put every
// applicant's CV in every database backup.
//
// Unlike a photo, a CV is **not** re-encoded — there is nothing safe to do to a
// PDF or a .docx that would make it safer, and rewriting one would corrupt it.
// So the defence is narrower and stricter: an allowlist of exactly four types,
// a hard size ceiling, and a generated filename. The original name is stored as
// text for the list to show and never used as a path.

export const MAX_CV_BYTES = 5 * 1024 * 1024;

// PDF and Word only, matched on both the declared type and the extension: a
// browser's type for .docx is inconsistent enough that one alone rejects real
// applicants, and the extension alone is trivially wrong.
const ACCEPTED: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  // Some clients send this for .doc; accepted with the same extensions.
  'application/octet-stream': ['.pdf', '.doc', '.docx'],
};

export const CV_ACCEPT_ATTRIBUTE = '.pdf,.doc,.docx';

export class CareersStorageUnconfigured extends Error {
  constructor() {
    super(`Uploads need ${BLOB_TOKEN_ENV}.`);
    this.name = 'CareersStorageUnconfigured';
  }
}

export function careersStorageConfigured(): boolean {
  return photoStorageConfigured();
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

export type DocumentCheck = { ok: true } | { ok: false; message: string };

export function checkDocument(file: {
  name: string;
  size: number;
  type: string;
}): DocumentCheck {
  if (file.size === 0) return { ok: false, message: 'That file is empty.' };
  if (file.size > MAX_CV_BYTES) {
    return { ok: false, message: 'Please keep the file under 5 MB.' };
  }

  const extensions = ACCEPTED[file.type];
  if (!extensions || !extensions.includes(extensionOf(file.name))) {
    return { ok: false, message: 'Please upload a PDF or Word document.' };
  }
  return { ok: true };
}

// The stored name is generated, never taken from the upload: a filename is
// attacker-controlled text, and letting one become part of a path is how a
// traversal or a content-type confusion starts. The applicant's own name is
// kept in the database column beside it, for the list to display.
export async function putDocument(
  kind: 'cv' | 'jd',
  bytes: Buffer,
  fileName: string,
  contentType: string,
): Promise<{ url: string; pathname: string }> {
  if (!careersStorageConfigured()) throw new CareersStorageUnconfigured();

  const extension = extensionOf(fileName) || '.pdf';
  const { url, pathname } = await put(`careers/${kind}${extension}`, bytes, {
    access: 'public',
    contentType,
    addRandomSuffix: true,
    cacheControlMaxAge: 31536000,
  });
  return { url, pathname };
}
