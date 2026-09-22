import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import budget from '@/config/image-budget.json';
import sharp from 'sharp';

const PUBLIC_DIR = 'public';
const IMAGES_DIR = join(PUBLIC_DIR, 'images');

export interface FileInfo {
  bytes: number;
  width: number;
  height: number;
}

// Reading 900-odd headers on every render of the contact sheet would make it
// slow for no reason — the files only change on a deploy. Keyed by path and
// mtime so a locally replaced file is still picked up.
const infoCache = new Map<string, FileInfo>();

export function publicPathOf(contentPath: string): string {
  return join(PUBLIC_DIR, contentPath.replace(/^\//, ''));
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

export async function publicImagePaths(): Promise<string[]> {
  const files = await walk(IMAGES_DIR);
  return files.map((file) => `/${file.slice(PUBLIC_DIR.length + 1)}`).sort();
}

export async function fileInfo(contentPath: string): Promise<FileInfo | null> {
  const file = publicPathOf(contentPath);
  try {
    const { size, mtimeMs } = await stat(file);
    const cacheKey = `${file}:${mtimeMs}`;
    const cached = infoCache.get(cacheKey);
    if (cached) return cached;

    const meta = await sharp(file).metadata();
    const info = { bytes: size, width: meta.width ?? 0, height: meta.height ?? 0 };
    infoCache.set(cacheKey, info);
    return info;
  } catch {
    // A slot naming a file that is not there is a content bug, and the contact
    // sheet is exactly where it should be visible rather than thrown.
    return null;
  }
}

export async function fileInfos(contentPaths: string[]): Promise<Map<string, FileInfo>> {
  const unique = [...new Set(contentPaths)];
  const entries = await Promise.all(
    unique.map(async (path) => [path, await fileInfo(path)] as const),
  );
  return new Map(entries.flatMap(([path, info]) => (info ? [[path, info] as const] : [])));
}

export async function publicImageBytes(): Promise<number> {
  const files = await walk(IMAGES_DIR);
  const sizes = await Promise.all(files.map(async (file) => (await stat(file)).size));
  return sizes.reduce((total, size) => total + size, 0);
}

export const MAX_SINGLE_FILE_BYTES = budget.maxSingleFileMb * 1024 * 1024;
export const MAX_PUBLIC_BYTES = budget.maxPublicMb * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
