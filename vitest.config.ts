import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vitest doesn't load .env.local the way Next's own dev/build process does —
// without this, DATABASE_URL/ADMIN_SESSION_SECRET/etc. are unset here even
// though they're set for `pnpm dev`, so any test that hits the real local
// Postgres (per this project's testing rules) or signs an admin session
// would silently fail. CI supplies these as real env vars instead (only
// DATABASE_URL, per .github/workflows/ci.yml), so skip this under CI (which
// sets process.env.CI itself) rather than mask a test's real env dependency —
// `pnpm test:ci-local` runs with CI=true precisely to catch that locally.
if (!process.env.CI) {
  try {
    process.loadEnvFile('.env.local');
  } catch {}
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // The database-backed suites share one Postgres, and some of what they
    // assert on is global by nature: coverageWarnings reports every
    // under-loaded room type across every property, so a sibling file loading
    // or clearing nights concurrently changes its answer. Partitioning by date
    // cannot isolate that, and rate plan activation is a single row per plan
    // with no date dimension at all. Run files one at a time instead.
    fileParallelism: false,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'e2e'],
  },
  resolve: {
    alias: {
      '@': __dirname,
    },
  },
});
