# Sinclairs Hotels — Next.js Rebuild

Guidance for Claude Code (and any contributor) working in this repo.

## What this project is

A ground-up rebuild of the Sinclairs Hotels & Resorts marketing site
(currently WordPress + Elementor + MotoPress Hotel Booking, at `sinclairshotels.com`)
as a standalone Next.js application. Content and images are sourced once from the
WordPress export and become static/code-owned content in this repo — **this app has
no runtime dependency on WordPress**. See `PLAN.md` for the full execution plan and
current phase.

## Stack

- **Next.js (App Router) + TypeScript**, strict mode on (see `tsconfig.json` —
  `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` all on)
- **pnpm** as the package manager — never `npm`/`yarn`. Commit `pnpm-lock.yaml`.
- **Biome** for linting + formatting (replaces ESLint + Prettier). One tool,
  one config (`biome.json`), fast, no plugin sprawl.
- **Tailwind CSS** for styling
- **Prisma + PostgreSQL** for the one piece of real state: enquiry / contact form submissions
- **Vitest + React Testing Library** for unit/component tests; **Playwright**
  for a small e2e smoke suite (nav, hotel page render, enquiry form submit).
  See "Testing" below.
- Deployed on **Vercel**; Postgres hosted separately (Neon/Supabase — see `PLAN.md`)
- Pages are statically generated (SSG) with **ISR** where content may change without a redeploy (e.g. an admin-curated "offers" banner, if added later). Everything else is plain SSG.

## Ground rules

- **Simplicity over cleverness.** This app is content + a few forms. Resist adding
  state managers, GraphQL layers, CMS integrations, or abstractions "for later."
  A hotel is a typed object in `content/hotels/*.ts`, not a database table, unless a
  concrete requirement says otherwise.
- **No comments explaining what code does.** Only comment non-obvious *why*.
- **All content lives in code** (`content/`), typed via a shared `Hotel`, `Page`, etc.
  interface in `content/types.ts`. Editing a hotel's copy means editing a `.ts` file
  and opening a PR — there is no admin CMS in this phase.
- **Images**: `public/images/` is **WebP only** — no JPEG, PNG (one favicon
  exception) or anything else. This is a hard rule, not tidiness: every Vercel
  deployment uploads `public/` in full and Vercel *retains every deployment*, so
  one 27 MB JPEG is 27 MB multiplied by every build ever made. That is how
  deployment storage reached 20 GB against a 10 GB allowance in eleven days.
  Convert before committing:
  `cwebp -q 82 -m 6 -resize 2400 0 in.jpg -o out.webp` (use `3840` for
  full-bleed heroes — the widest Next ever serves; anything larger is bytes no
  browser will ever request).
  Most properties' photos came through the WP-era pipeline at 1600px wide /
  quality 65 — fine for cards and thumbnails, but that is the real resolution
  ceiling, and stretching one across a full-bleed hero (`sizes="100vw"`) forces
  the browser to upscale, which reads as soft on large screens. Only Gangtok
  (and Darjeeling's room shots) have true high-res originals; the 6048px Gangtok
  set now lives at `~/Desktop/sinclairs-wp-backup/hires-originals/` and is
  **archived, never deleted** — those are the only copies. Check actual pixel
  dimensions with `sips -g pixelWidth` before assuming a "foggy" hero is a code
  bug rather than a source-asset limit.
  Every full-bleed hero `<Image>` (`journey-hero.tsx`, `hero-carousel.tsx`,
  `closing-cta.tsx`, and the two direct hero images on `/hotels` and
  `/meetings-events`) sets `quality={90}` (declared in `next.config.ts`'s
  `images.qualities`) so Next's own re-encode at serve time doesn't compound the
  source's existing compression loss — it can't add resolution that was never
  captured, only avoid making it worse. A `fill` image's *direct* parent div must
  have a `position` class (`relative`/`absolute`) — Next warns in the server log
  (`"has fill and parent element with invalid position"`) but doesn't fail the
  build, so this is easy to miss; it did creep into
  `journey-hero.tsx`/`hero-carousel.tsx` once already.
- **Forms write to Postgres via Prisma**, validated server-side (zod) before insert.
  Never trust client input. Rate-limit the enquiry endpoint.
- **Security**: this rebuild exists partly *because* the WordPress install was found
  compromised (a webshell backdoor was discovered and quarantined during migration
  research — see `PLAN.md` → Background). Treat all form input, all env vars, and all
  dependencies with real scrutiny. No secrets in the repo, ever — use `.env.local`
  (gitignored) and Vercel env vars in production. `next.config.ts` sets a real
  `Content-Security-Policy` plus the standard hardening headers (HSTS, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy) on every route — CSP is
  scoped to what the site actually uses (`'unsafe-inline'` for style because Radix/
  react-day-picker position via inline `style` attributes, `'unsafe-inline'` for script
  because the App Router streams RSC hydration via its own inline `<script>` tags, and
  `frame-src` limited to the Google Maps embed on hotel pages). If you add a new
  external embed, script, or fetch target, it needs an explicit CSP allowance or it'll
  be silently blocked — check the browser console for `Refused to ...` before assuming
  something else is broken. `lib/rate-limit.ts`'s `clientIp()` helper is the only
  correct way to key the enquiry endpoint's rate limiter — it prefers Vercel's
  platform-set `x-real-ip` and takes just the first hop of `x-forwarded-for`; keying on
  the raw header is a rate-limit bypass, since a client can vary it on every request.

## Design system

The site follows a "5-star heritage hotel" visual language (Taj/Lemon Tree/Oberoi
tier), established across the homepage, `/hotels`, hotel detail pages, `/weddings`,
and `/meetings-events`. New pages/components should match it, not reinvent it.

**Tokens** (`app/globals.css`, exposed as Tailwind utilities): `forest` (#16352a),
`forest-dark` (#0d2119), `gold` (#bd9455), `gold-light` (#dcc08a), `cream` (#faf7f1,
the body background), `ink` (#1c1c1a). `font-display` (Playfair Display) for all
headings, `font-sans`/Inter for body text. Two shared keyframe utilities:
`animate-hero-zoom` (slow 16s Ken Burns zoom on hero images) and `animate-fade-up`
(entrance fade for hero text).

**Hero pattern** (homepage, `/hotels`, `/weddings`, `/meetings-events`, hotel detail):
full-bleed image wrapped in `animate-hero-zoom`, a `bg-gradient-to-t from-forest-dark/95
via-forest-dark/50 to-forest-dark/15` overlay for contrast, eyebrow line in
`text-cream drop-shadow-md` (never `text-gold-light` on a photo — gold-on-gold-toned
images is illegible), and heading/CTA in an `animate-fade-up` block anchored to the
bottom. Do **not** add a second gradient layer to fade the hero into the page
background — a `from-cream` fade band stacked on top of the dark overlay produces a
muddy double-blend wherever anything (a floating stat card, etc.) overlaps it. The
homepage's single-image hero works because nothing overlaps its fade zone; on every
other page just end the hero on the dark overlay.

**Floating stat/booking card**: a white `rounded-xl shadow-2xl` card overlapping the
hero's bottom edge via negative margin (`-mt-8` to `-mt-10`), showing 3–4 computed
stats (room types, dining venues, event spaces — pull these from `content/hotels`
data, never hardcode a count). Leave a full section of plain background between this
card and the next tinted section (see `pt-16` on the Weddings editorial section) —
butting a tinted section directly against the card reads as a layout bug.

**Closing CTA band**: every page ends the same way — a ~36vh image band
(`animate-hero-zoom` + `bg-forest-dark/75` overlay), centered heading + one-line copy
+ a gold `Enquire Now` button linking to `/enquiry` (with `?property=slug` on hotel
pages). Don't embed `<EnquiryForm>` inline on marketing pages (Weddings, Meetings) —
redirect to `/enquiry` instead, consistent with every other closing CTA.

**Cards**: `HotelCard` (tall photography card, name/location/stats overlaid on the
image via gradient — kept compact, aspect `4/3.4`, not `4/5`, so several fit on
screen without zooming out), `VenueTable` (compact horizontal card: thumbnail + top-3
venues + link to the property), `EditorialRow` (`components/editorial-row.tsx` —
alternating image/text block, reused wherever a real photo needs a proper caption
treatment: Weddings, homepage's Cuisine section). All interactive cards get
`shadow-sm transition hover:shadow-lg` (or `-xl`/`-2xl` + a hover lift
`hover:-translate-y-1`) — never a bare `border` with no shadow.

**Form controls — do not use native `<select>` or `<input type="date">`.** Those
open OS-controlled popups that can't be restyled and look out of place next to
everything else. Use `components/ui/select.tsx` and `components/ui/date-picker.tsx`
(Radix Select / Popover + react-day-picker, fully themed) instead — see
`components/booking-widget.tsx` and `components/enquiry-form.tsx` for the pattern
(controlled state + a hidden `<input>` so the value still posts via native FormData
for the server action). The date picker drives its own month/year via controlled
`Select`s — never re-enable react-day-picker's built-in `captionLayout="dropdown"`
alongside custom `classNames`, it renders the month/year twice (once as its own
select, once as a plain-text caption).

**Scroll reveal**: `components/reveal.tsx` — a lightweight IntersectionObserver
fade-up, used sparingly on homepage section intros. Skip it on anything that sits
right below the fold (e.g. the stats strip right under the hero) — it reads as
broken/half-loaded rather than animated when there's no scroll distance to trigger it.

**Icons**: no icon library — small hand-drawn inline SVGs, one file per concern
(`components/service-icons.tsx` for wedding services, `components/amenity-icon.tsx`
with a keyword-matching `getAmenityIcon(label)` for the varied real amenity strings
across all 9 properties). Follow that pattern for new icon needs rather than adding
`lucide-react` or similar.

## Environments and deploying

Three environments, split by git branch as well as by Vercel deployment target.
`main` builds Preview and serves the `dev.*` hosts; `prod` builds Production.
Merging `main` into `prod` is therefore the release step. The two drifted apart
once already — `prod` sat thirteen files behind `main`, including a migration the
production database had long since applied — so reconcile them rather than letting
`prod` lag behind what is actually running.

| | Host | Database | Email |
|---|---|---|---|
| Local | `localhost:3000`, `staff.localhost:3000` | local Postgres | logged, not sent |
| Dev | `dev.sinclairshotels.com`, `staff.dev.sinclairshotels.com` | Neon branch `dev` | redirected to one inbox |
| Production | `sinclairs-hotels.vercel.app`, `staff.sinclairshotels.com` | Neon branch `prod` | real recipients |

**Which Neon branch an environment actually uses.** `DATABASE_URL` is stored as a
Vercel *sensitive* variable, which is write-only — it cannot be read back by
anyone, through the CLI, the API or the dashboard. So there is no way to open an
environment and confirm where it points; the mapping is recorded here instead.
Neon project `patient-mouse-60163337` (`sinclairs-hotels-db`, Singapore), under the
Neon org `Vercel: Sinclairs Hotels and Resorts`:

| Vercel environment | Git branch | Neon branch | Endpoint |
|---|---|---|---|
| Preview | `main` | `dev` | `ep-twilight-waterfall-az90lhuy` |
| Production | `prod` | `prod` (default) | `ep-purple-sea-azekup9t` |

The endpoint prefix is the only part of the connection string visible in the Neon
console without revealing the password, so it is the thing to check a claim
against. Note that `dev` is *reset from* `prod` rather than seeded: it holds a full
copy of real guest data, which makes `staff.dev.sinclairshotels.com` exactly as
sensitive as production despite the name.

```bash
vercel deploy          # dev only
vercel deploy --prod   # production only
```

**`--prod` does not also update dev**, and a Vercel env change does nothing until
the environment is rebuilt — env is snapshotted at build time. Change a variable,
and you must deploy *both* sides or one keeps running the old value. This has
already caused a dev test to write to the production database, because dev was
still running a build from before `DATABASE_URL` was split.

`DATABASE_URL` is scoped **per environment** and must stay that way: exactly two
rows, one Preview, one Production (`vercel env ls | grep DATABASE_URL`). The Neon
integration originally set a single value covering both, which silently pointed
dev at production data; if the integration re-syncs it may recreate that. Check
before cutover.

Migrations apply themselves — the build command is
`prisma migrate deploy && next build`, so deploying an environment migrates its
database. Never hand-edit a Neon branch's schema. To refresh dev data, use Neon's
**Reset from parent** rather than recreating the branch.

## Server logging

`lib/log.ts` emits one line of JSON per server event; Vercel indexes the fields,
so `vercel logs <url>` is filterable rather than greppable. This is the
server-side record of the funnel in `docs/analytics-events.md`, and unlike the
client events it survives ad blockers and a guest closing the tab — when GA4 and
Postgres disagree, this is the tiebreaker.

Use `log.info/warn/error(event, fields)` with a dotted event name
(`enquiry.created`, `ipay.settled`, `refund.rejected`). No bare `console.*` in
`app/` or `lib/` — the logger is the only place those appear.

**Guest data must never reach a log line.** `lib/log.ts` redacts by field name:
`name`, `email`, `phone`, `message`, `subject`, IPs and mail recipients all
become `[redacted]`. `subject` is on that list because mail subjects embed the
guest's name ("… — gangtok (Jane Doe)") — that leak was shipped once and found by
reading real log output, not by a test. `sendMail` takes a `kind`
(`voucher-guest`, `ipay-staff`, …) and logs that instead; it is also more useful
than a subject, being constant per template and therefore groupable.

## Legacy URL redirects

`lib/legacy-redirects.ts` holds the 301 map from the WordPress URL structure,
wired through `next.config.ts`'s `redirects()`. 187 live legacy URLs, verified
against a production build.

The inventory came from **crawling the live site**, not its sitemap —
`sinclairshotels.com/sitemap.xml` is stale third-party output missing every
`/gangtok*` URL, all of `/palace-udaipur*`, and the whole `/reservations.php?ht=`
set. It is committed as `lib/legacy-redirects.fixture.json` and the test asserts
every URL in it still lands on a real route, so renaming a route fails CI instead
of quietly producing 404s. If you rename or remove a route, expect that test to
fail — fix the map, don't weaken the test.

Uses `statusCode: 301` rather than `permanent: true` (which emits 308): both are
honoured by Google, but 301 is unambiguous to every other crawler and downgrades
a stray POST to `/reservations.php` into a GET.

## Deployments and storage

Vercel **retains every deployment**, each holding a full copy of `public/`, and
Hobby has no retention policy. Deployment storage is therefore
`deploy size x number of deploys ever made` — it only ever grows. It reached
20.79 GB against a 10 GB allowance in eleven days, from 84 retained builds.

Three things keep it bounded, and all three matter:

1. **`pnpm check:images`** runs inside `pnpm verify:ci`, before the build. It
   fails if `public/` contains anything but WebP/SVG/PNG/ico/text, if any single
   file exceeds 4 MB, or if `public/` exceeds a 170 MB budget. If a real need
   pushes past the budget, move images to a CDN rather than raising the ceiling —
   the ceiling is the mechanism.
2. **`.vercelignore`** keeps tests, docs, e2e and one-off scripts out of the
   upload entirely.
3. **`pnpm prune:deployments`** (`vercel remove --safe --yes`) deletes every
   deployment that is not currently serving an alias, keeping the live production
   and `dev.*` builds. Run it when the Deployments list grows past ~10. It is
   irreversible, so it deletes rollback targets — that is the trade being made
   deliberately, not a side effect.

Rollback still works: the retained aliased deployments can be promoted from the
Vercel dashboard, and anything older is rebuildable from git, which is the real
rollback story. Storage is not a place to keep history.

## SEO

- **The production domain is not live yet.** `sinclairshotels.com` still serves the
  old WordPress site — this rebuild is currently only reachable at
  `sinclairs-hotels.vercel.app`. No on-page SEO work here moves Google rankings for
  the real domain until it's actually cut over. That cutover (DNS change, 301
  redirects from the old WP URL structure to the new one so existing search equity
  transfers, and resubmitting the sitemap in Google Search Console) is a deliberate
  manual step the domain owner is holding until the site is fully built out
  end-to-end — don't treat a live `sinclairshotels.com` pointing here as a bug to fix.
- Every page's metadata should go through `pageMetadata()` in `lib/seo.ts` rather
  than a hand-rolled `Metadata` object — it fills in canonical URL, Open Graph, and
  Twitter Card consistently. `app/layout.tsx`'s root `metadata` covers the homepage
  (it has no metadata export of its own) and sets the site-wide OG/Twitter defaults.
- `app/sitemap.ts` / `app/robots.ts` (Next's native `MetadataRoute` file convention,
  no extra dependency) list every static page and hotel slug — add new top-level
  routes to `sitemap.ts`'s `staticPaths` array.
- **`robots.txt` is decided per request from the `Host` header**, not from an env
  var, because one deployment answers on several hostnames at once
  (`sinclairs-hotels.vercel.app`, `dev.*`, `staff.dev.*`, every preview URL).
  Only the canonical host is ever crawlable; everything else returns
  `Disallow: /`. So it opens by itself when DNS points `www.sinclairshotels.com`
  here, and the dev subdomain never becomes a crawlable duplicate of the live
  site. `/admin`, `/api`, `/ipay` and `/v` are disallowed even on the canonical
  host. Before this was host-based, the pre-cutover deployment was serving
  `Allow: /` while its canonicals pointed at WordPress URLs that 404 — and Google
  discards a canonical resolving to a 404 and indexes the crawled URL instead.
- `components/json-ld.tsx`'s `JsonLd` component renders schema.org structured data as
  a plain `<script>` child (not `dangerouslySetInnerHTML` — script/style are the only
  elements React lets you pass raw text children to). Root layout renders an
  `Organization` block; each hotel page renders `Hotel` + `BreadcrumbList`. Only ever
  pass it static, developer-authored data (content files, `siteConfig`) — never
  request input.
- Hotel page meta descriptions use `tagline + location`, not the full multi-paragraph
  `description` field — the latter is well past Google's ~160-character display
  limit and just gets truncated anyway.

## Testing

- Every content template component (hotel page, room card, nav dropdown) gets
  a Vitest + RTL render test — it renders with representative data, no crash,
  key content/links present.
- The enquiry form gets thorough coverage: valid submit, server-side
  validation rejects bad input (zod), spam-guard blocks bot submissions, DB
  row is created correctly (test against a real local Postgres, not a mock —
  Prisma's own type safety is not a substitute for testing the actual query).
- Playwright smoke suite covers the golden paths: home → hotel page → enquiry
  form submit end-to-end, nav dropdown works, 404s don't happen on any nav link.
- Run tests locally before every push: `pnpm test` (Vitest) and
  `pnpm test:e2e` (Playwright). CI (GitHub Actions, `.github/workflows/ci.yml`) runs
  `pnpm prisma migrate deploy`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`,
  in that order, on every PR and push to `main` — with only `DATABASE_URL` set (a real
  Postgres service container), nothing else. Plain local `pnpm test` is not the same
  check: `vitest.config.ts` loads `.env.local` locally (for `ADMIN_SESSION_SECRET`, etc.)
  which CI doesn't have, so a test that reads one of those vars without setting it itself
  can pass locally and fail in CI. Run `pnpm verify:ci` before pushing — it mirrors the
  CI job exactly (env included) so that class of bug shows up locally, not after the push.

## Commands

- `pnpm dev` — local dev server (http://localhost:3000)
- `pnpm build` / `pnpm start` — production build / serve
- `pnpm lint` / `pnpm lint:fix` — Biome check / check + write
- `pnpm typecheck` — `next typegen && tsc --noEmit`. The `next typegen` step is load-bearing,
  not decoration: Next's ambient route types (`LayoutProps`, `PageProps`) only exist once
  generated into `.next/types/`, normally by `next build`/`next dev`. CI runs typecheck
  before build on a fresh checkout with no `.next` dir, so plain `tsc --noEmit` failed
  with `Cannot find name 'LayoutProps'` on every CI run once `app/layout.tsx` started
  using it — worked locally only because a leftover `.next` from an earlier build
  masked it.
- `pnpm test` / `pnpm test:watch` — Vitest
- `pnpm test:ci-local` — Vitest with `CI=true`, which makes `vitest.config.ts` skip loading
  `.env.local` — the same env shape the real CI job runs with (`DATABASE_URL` only)
- `pnpm test:e2e` — Playwright smoke suite
- `pnpm prisma:generate` / `pnpm prisma:migrate` — Prisma client / migrations (dev)
- `pnpm prisma:migrate:deploy` — `prisma migrate deploy`, the non-interactive form CI uses
- `pnpm verify:ci` — `prisma migrate deploy && lint && typecheck && test:ci-local && build`,
  i.e. the exact CI job (`.github/workflows/ci.yml`), runnable locally against the same
  local Postgres `pnpm dev` already uses

Run `pnpm typecheck && pnpm lint:fix && pnpm test` after any content or component
change, before considering it done — this is the standard verification loop used
throughout this project's history, not optional polish. Before pushing (and before
any deploy), run `pnpm verify:ci` — it catches the class of bug that only shows up
in CI's leaner environment, which the quicker loop above cannot.

Deployed via `vercel deploy` (add `--prod` for production) from
the `sinclairs-hotels` Vercel team (Pro), project `sinclairs-hotels` — live at
https://sinclairs-hotels.vercel.app.

**The GitHub repo (`sinclairshotels/sinclairs-hotels`) is now connected**, so a push to
`main` triggers a Preview deployment on its own — and because the build command is
`prisma migrate deploy && next build`, **a push migrates the dev database whether
or not you then run `vercel deploy`**. Confirmed 2026-09-13: pushing `379a288`
produced a Preview build that applied a migration one minute before the manual
`vercel deploy` ran, which then reported "No pending migrations to apply".

Production is *not* auto-deployed — `sinclairshotels.com`, `www`,
`staff.sinclairshotels.com` and `sinclairs-hotels.vercel.app` only move when you
run `vercel deploy --prod`. So the two halves can drift: after a push, dev is
already on the new code and prod is not. `vercel alias ls` shows which deployment
each domain points at, and is the quickest way to tell them apart.

## Source content

Reference material lives outside this repo, on the local machine only (never commit
it): `~/Desktop/sinclairs-wp-backup/`. As of 2026-09-10 that path holds exactly two
things:

- `legacy-php-site/` — the old PHP booking/voucher/newsletter site, plus
  `legacy-php-site/dumps/`: the four MySQL dumps the historical import reads
  (`enquiry.sql`, `voucher_detail.sql`, `newsletter_signup.sql`, `cca_status.sql`)
  and `migration-report.json`. `scripts/migrate-legacy-data.ts` reads this
  directory directly, so it is a live dependency of the pre-cutover catch-up
  import — not just archive material.
- `prod-db-backup-pre-migration/` — JSON snapshots of the handful of real
  production rows that existed before the import, used to reconcile counts.

**What is gone from this machine**: the WordPress export itself (`WPCM`,
`public_html`, `wp-content/uploads`), the WP DB dump, the `QUARANTINE_backdoors/`
folder, and `sync-legacy-data.sh` (the daily legacy-MySQL sync — it will have to be
rewritten if the catch-up import needs it). Anything not already imported into
`public/images/` is therefore unrecoverable locally: for most properties the WebP
files in `public/images/hotels/` (1600px, see the Images note above) are the only
surviving copies, with no higher-resolution original to fall back to. If better
source photos are needed they have to come from an external backup (the
photographer, an old server, cloud storage) — ask before assuming they're
retrievable.
