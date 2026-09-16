# Sinclairs Hotels — Next.js

Marketing website for Sinclairs Hotels & Resorts (Burdwan, Darjeeling, Dooars,
Gangtok, Kalimpong, Ooty, Port Blair, Siliguri, Udaipur), rebuilt in Next.js +
TypeScript. Replaces the previous WordPress + Elementor site.

## Stack

- Next.js (App Router), TypeScript (strict), Tailwind CSS
- pnpm, Biome (lint + format)
- Prisma + PostgreSQL — enquiries, newsletter, vouchers, payments (Neon)
- Radix UI (Select, Popover) + react-day-picker for themed form controls —
  see `components/ui/`
- ICICI (PhiCommerce) payment gateway in Standard/redirect mode
- Resend for transactional email
- Vitest + React Testing Library, Playwright (e2e smoke)
- Deployed on Vercel

See **Design system** in `CLAUDE.md` before adding or restyling any page/component —
it documents the established hero, card, CTA, and form-control patterns so new work
stays consistent instead of drifting.

## Environments

Three environments, three databases. They differ only in configuration — dev and
production run the **same code from the same `main` branch**, so you cannot stage
unreleased code in dev.

| | URL | Database | Email goes to |
|---|---|---|---|
| Local | `localhost:3000` | local Postgres | console (no provider) |
| Dev | `dev.sinclairshotels.com`, `staff.dev.sinclairshotels.com` | Neon branch `dev` | redirected to one test inbox |
| Production | `sinclairs-hotels.vercel.app`, `staff.sinclairshotels.com` | Neon branch `main` | real recipients |

`www.sinclairshotels.com` is the eventual production host; until DNS cutover it
still serves the old WordPress site. See `GO_LIVE_CHECKLIST.md` → Cutover.

**Deploying updates one environment at a time:**

```bash
vercel deploy          # updates dev.sinclairshotels.com (preview)
vercel deploy --prod   # updates production
```

`--prod` does **not** also refresh dev. After changing an environment variable,
deploy both or one side keeps running the old value — Vercel snapshots env at
build time, so an env change alone changes nothing until a rebuild.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL and any secrets
pnpm prisma migrate dev
pnpm dev
```

Open http://localhost:3000. The admin tool is host-gated: locally, reach it at
`http://staff.localhost:3000/admin`.

## Project structure

```
app/                  routes (App Router)
components/           shared UI components
content/              typed site content (hotels, pages copy) — the "CMS"
lib/                  server-side helpers (db, validation, email, logging, SEO)
lib/legacy-redirects.ts   301 map from the old WordPress URL structure
prisma/               schema + migrations
public/images/        hotel photography (WebP only — see below)
scripts/              one-off legacy data import
```

## Images

`public/images/` is **WebP only**. Anything else is either dead weight or a
source file that belongs outside the repo — every deployment uploads this
directory in full, and Vercel retains each deployment, so a stray 27 MB JPEG is
27 MB × every build you ever ran.

To add photography, convert first:

```bash
# long edge 2400 for cards/galleries, 3840 for full-bleed heroes
cwebp -q 82 -m 6 -resize 2400 0 input.jpg -o output.webp
```

High-resolution originals (the 6048px Gangtok set) live outside the repo in
`~/Desktop/sinclairs-wp-backup/hires-originals/`. They are the only copies —
archive, never delete.

## Databases

Migrations are applied automatically: the build command is
`prisma migrate deploy && next build`, so deploying to an environment migrates
that environment's database. Never edit a Neon branch's schema by hand.

Normal loop:

```bash
# edit prisma/schema.prisma
pnpm prisma:migrate     # creates the migration against local Postgres
pnpm verify:ci          # full CI gate, including the migration
git commit && git push
vercel deploy && vercel deploy --prod
```

To refresh dev data from production, use Neon's **Reset from parent** on the
`dev` branch rather than recreating it — the connection string stays valid.

## Observability

`lib/log.ts` writes one line of JSON per server event, which Vercel indexes into
filterable fields (`vercel logs <url>`). It is the server-side record of the
funnel and survives ad blockers and closed tabs, so it is the tiebreaker when
analytics and the database disagree.

Guest data never reaches a log line: names, emails, phones, message bodies, IPs,
mail recipients and mail subjects are redacted by field name. Mail sends log a
`kind` (`voucher-guest`, `ipay-staff`, …) instead of the subject, because
subjects embed the guest's name.

Event reference: `GO_LIVE_CHECKLIST.md` → Server logs.

## Scripts

- `pnpm dev` — local dev server
- `pnpm build` / `pnpm start` — production build
- `pnpm lint` / `pnpm lint:fix` — Biome check / check + write
- `pnpm typecheck` — `next typegen && tsc --noEmit`
- `pnpm test` / `pnpm test:watch` — Vitest
- `pnpm test:e2e` — Playwright smoke suite
- `pnpm verify:ci` — the exact CI job, runnable locally. **Run before pushing.**
- `pnpm check:images` — enforces the WebP-only rule and the `public/` size budget
  (also runs inside `verify:ci`)
- `pnpm prune:deployments` — deletes unaliased Vercel deployments. Vercel retains
  every build, so storage grows forever without this; run it when the Deployments
  list passes ~10. Irreversible.
- `pnpm prisma studio` — inspect the database locally

## Editing content

Non-technical contributors updating copy, photography or page layout should read
`docs/CONTENT-EDITING.md` — it covers the two environments, the review flow, and
which paths require an owner's approval. A business-facing version written for
people unfamiliar with GitHub is published separately as the Site Handbook.

Content editors are deliberately **not** given Vercel or database accounts:
pushing to `main` deploys dev by itself, and going live is a reviewed merge. The
boundary is access, not convention.

See `PLAN.md` for the full migration/execution plan, `CLAUDE.md` for project
conventions, and `GO_LIVE_CHECKLIST.md` for what is still open before launch.
