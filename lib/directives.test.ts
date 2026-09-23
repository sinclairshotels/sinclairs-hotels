import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A directive that is not the first statement in the file is not a directive —
// it is an expression, and the file quietly becomes a server component, or a
// server action stops being one. TypeScript and Vitest both accept it happily;
// only `next build` complains, which is the slowest possible place to find out.
//
// This happened three times in one change, from an automated import insert
// that prefixed the file.
const ROOTS = ['app', 'components', 'lib'];
const DISPLACED = /^\(\s*['"]use (client|server)['"]\s*\)\s*;/m;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('use client and use server', () => {
  it('are the first statement of their file, not an expression after an import', () => {
    const offenders = ROOTS.flatMap(files).filter((path) =>
      DISPLACED.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('are quoted the way the bundler expects where they appear at all', () => {
    const wrong = ROOTS.flatMap(files).filter((path) => {
      const source = readFileSync(path, 'utf8');
      if (!/use (client|server)/.test(source)) return false;
      const first = source.split('\n').find((line) => line.trim().length > 0) ?? '';
      // Either the file opens with the directive, or it does not claim one at
      // the top at all — what must never happen is a directive further down.
      const declared = /^['"]use (client|server)['"];$/.test(first.trim());
      const later = source
        .split('\n')
        .slice(1)
        .some((line) => /^\s*['"]use (client|server)['"]\s*;?\s*$/.test(line));
      return later && !declared;
    });
    expect(wrong).toEqual([]);
  });
});
