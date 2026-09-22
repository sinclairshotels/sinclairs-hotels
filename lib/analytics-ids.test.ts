import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCAN_DIRS = ['app', 'components', 'lib', 'content'];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

// A measurement ID compiled into the bundle is one that cannot be switched off
// without a deploy, and dev, preview and production all report as production.
// Both IDs are environment variables (NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA4_ID)
// and GO_LIVE_CHECKLIST.md names both; this is what keeps that true.
describe('analytics identifiers', () => {
  it('never hard-codes a GA4 or GTM id in shipped code', () => {
    const found: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
          // Comments explain which container the account holds; only a literal
          // the code would send is a problem.
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
          const match = line.match(/\b(G-[A-Z0-9]{8,}|GTM-[A-Z0-9]{5,})\b/);
          if (match) found.push(`${match[1]}  (${file}:${index + 1})`);
        }
      }
    }

    expect(found).toEqual([]);
  });

  it('reads both ids from the environment', () => {
    expect(readFileSync('lib/analytics.ts', 'utf8')).toContain('process.env.NEXT_PUBLIC_GA4_ID');
    expect(readFileSync('app/layout.tsx', 'utf8')).toContain('process.env.NEXT_PUBLIC_GTM_ID');
  });

  it('is named in the go-live checklist, which is where they get set', () => {
    const checklist = readFileSync('GO_LIVE_CHECKLIST.md', 'utf8');
    expect(checklist).toContain('NEXT_PUBLIC_GTM_ID');
    expect(checklist).toContain('NEXT_PUBLIC_GA4_ID');
    expect(checklist).toContain('BLOB_READ_WRITE_TOKEN');
  });
});
