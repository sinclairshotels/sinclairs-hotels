# Execution Plan — WordPress → Next.js Rebuild

## Background

The current live site (sinclairshotels.com) runs WordPress + Elementor +
MotoPress Hotel Booking, self-hosted. During migration research a local Docker
copy of the production codebase (`sinclairs-wpcm`) was found to contain a
planted backdoor in `wp-content/cache/` — a fake `wp-config.php` that pulls and
executes remote PHP, plus a Perl webshell. It was quarantined locally
(`~/Desktop/sinclairs-wp-backup/QUARANTINE_backdoors/`), but **the live host
still needs credential rotation and a server-side scan** — that's outside what
this repo or Claude Code can do. This rebuild also removes WordPress as an
attack surface going forward.

Decisions already made (2026-09-01):
- Content is fully static in Next.js — no headless WordPress at runtime.
- DB: PostgreSQL + Prisma, for enquiry/lead submissions only.
- Hosting: Vercel.
- Scope: full site (Home, Hotels listing + per-property pages, Meetings,
  Weddings, Enquiry form, Contact), matching the current nav.
- Repo: `github.com/sinclairshotels/sinclairs-hotels` (public).

## Phases

### Phase 0 — Scaffold (foundation, do first, sequential)
- `create-next-app` with TypeScript (strict), App Router, Tailwind, pnpm
- Swap ESLint/Prettier for **Biome** (`biome.json`); wire `pnpm lint`
- Prisma init, `Enquiry` model, local Postgres via Docker Compose for dev
- Test tooling: Vitest + React Testing Library configured, Playwright
  installed with one smoke test as a template
- GitHub Actions CI: lint, unit tests, build on every push/PR
- Base layout: nav (with Hotels dropdown), footer, design tokens (colors,
  type scale) matching Sinclairs' brand (deep green + gold accent, serif
  display type — see current site screenshots)
- `content/types.ts`: `Hotel`, `HotelPage`, `NavItem` interfaces
- Deploy an empty shell to Vercel early, to de-risk hosting/env setup

### Phase 1 — Content extraction (can run in parallel once Phase 0 lands)
- Pull copy + structure from the WP export
  (`~/Desktop/sinclairs-wp-backup/WPCM`, `public_html` as fallback for older
  copy) for: Home, About, each of the 9 properties, Meetings & Events,
  Weddings, Contact
- Export/optimize images from `wp-content/uploads` into `public/images/`
  (re-encode/resize — do not ship the WP originals as-is)
- Write content into typed `content/hotels/*.ts` files

### Phase 2 — Pages (parallelizable across properties once content model is fixed)
- Home page (hero, featured properties, awards, Instagram-style gallery —
  simplified, no third-party embed dependency unless requested)
- Hotels listing page + dropdown nav + 9 individual property pages
  (rooms, dining, facilities, gallery, sightseeing — reuse one template
  component, not 9 bespoke pages)
- Meetings & Events, Weddings — content pages with enquiry CTA
- Contact page

### Phase 3 — Enquiry system
- Prisma `Enquiry` model (name, email, phone, property, dates, message,
  createdAt, status)
- Server action / API route: zod validation, rate limiting, honeypot or
  equivalent spam guard, Prisma insert
- Email notification on submission (transactional email provider — TBD, ask
  before adding a paid dependency)
- Confirmation UI state (success/error), no page reload required

### Phase 4 — Polish & launch readiness
- Accessibility pass (landmarks, alt text, focus states, color contrast)
- SEO: metadata API per page, sitemap.xml, robots.txt, OpenGraph images
- Performance: image optimization, Lighthouse pass, ISR where useful
- Security review: headers (CSP, HSTS via Vercel), dependency audit,
  form abuse protection
- Cross-browser/responsive check in Chrome via claude-in-chrome

## Scope boundary — Phase 1 vs Phase 2

Agreed 2026-09-10. **Phase 1 is everything the site cannot go live without:
what has already been built, plus the cutover set. Phase 2 is everything that
comes after launch.** (The numbered build phases 0–4 above are an older,
unrelated axis; don't confuse them.)

An earlier cut of this section split the phases by done vs remaining. That was
wrong: it put the entire cutover set in Phase 2, which would have meant
"Phase 1 complete" and "site still on WordPress" at the same time.

**Commercials and scope are settled on a call before further work starts** —
covering both the cutover set below and Phase 2.

### Phase 1 — done

- All 9 property pages, plus home, hotels listing, weddings, meetings & events,
  contact, media and enquiry pages
- Enquiry system end to end: zod validation, rate limiting, spam guard, Prisma
  insert, staff notification email, success/error states
- Voucher module: issue → guest email → office copy → guest-viewable
  `/v/[token]` page
- Internal ops dashboard on the `staff.*` host: enquiries, vouchers, payments
  (with refunds), newsletter, session auth
- ICICI i-Pay integration in Standard/redirect mode, including refunds, signed
  callback verification and the amount cross-check
- Historical data migration: 35,837 enquiries, 13,539 vouchers, 26,258
  newsletter subscribers, 5,234 legacy payments — verified idempotent
- GA4/GTM instrumentation with the full conversion funnel
- On-page SEO: per-page metadata, sitemap, robots, schema.org structured data
- Security hardening: CSP and the standard headers, rate limiting, timing-safe
  secret comparison, server-side validation everywhere, staff-host isolation
- Daily digest email (cron)
- Design system and shared component library
- Test suite (68 unit tests + Playwright e2e) and the CI pipeline

### Phase 1 — the cutover set (remaining, launch-blocking)

Finite, and mostly not code — credentials, DNS, one redirect map and a data
pull. Detail for every line lives in `GO_LIVE_CHECKLIST.md`.

- 301 redirect map from the old WordPress URLs, DNS switch to Vercel, sitemap
  resubmission in Search Console
- Resend domain verification, real from/staff addresses, test recipient
  overrides removed — without this no real guest or staff address receives
  anything
- Production environment variables in Vercel: GTM ID, `CRON_SECRET`, production
  database and admin secrets, and dropping the `SITE_BASE_URL` override
- ICICI: sandbox round-trip (which also settles the two open questions in their
  spec), then production credentials and one live test
- Legacy server credential rotation and clean-rebuild confirmation
- GA4 verified firing in production *before* cutover, so the before/after
  baseline exists
- Final catch-up data import, plus re-confirming the production row counts
- Per-hotel booking-office details from the legacy `voucher_hotels` table, so
  vouchers bill correctly
- The masked-card and unused-legacy-table decisions — they are security
  questions and they execute at decommission
- Triage of Preeti's feedback doc: which of those items are launch-blocking

### Phase 2 — after launch

- Legacy host decommission (only possible once cutover is verified)
- Voucher void/resend and print/PDF — unless the front desk needs them on day
  one, in which case they move into the cutover set
- Per-user staff accounts instead of the shared admin password
- Conversion dashboard (event collection is already done; somewhere to look at
  it is not launch-blocking)
- Offers page and pricing dashboard
- Web check-in
- Payment/voucher reconciliation (needs a `Voucher` → `Payment` link first)
- New content: careers, destination guides, F&B
- The "Sinclairs Yangang" property question — the 1,043 enquiries are imported
  and safe under either answer, so it changes nothing at launch
- STAAH integration — unscoped; it changes the site's commercial model and
  needs its own scoping before it can be estimated
- AI integration and further visual redesign — parked, refine rather than replace

## Post-launch roadmap ("Phase 2")

Naming note: the numbered phases above are the *build* phases (0–4, all
delivered). "Phase 1 / Phase 2" as used in stakeholder conversation means
launch / post-launch — this section is the latter. Status verified against the
repo on 2026-09-10.

### Already built (landed early, during the launch push)

- **Internal ops dashboard** — `/admin`, reachable only on the `staff.*` host
  (`proxy.ts` rewrites it to a 404 on the public host), session-cookie auth,
  sidebar nav. Sections: Enquiries (legacy imported records shown separately),
  Vouchers (list + create + guest-visible `/v/[token]` link), Payments (with
  refund dialog), Newsletter. Plus the daily digest cron email.
  *Remaining:* per-user staff accounts instead of one shared password (see
  `GO_LIVE_CHECKLIST.md` → Security), and whatever ops asks for after real use.
- **Conversion tracking (data collection only)** — the GA4 funnel fires
  end-to-end: `page_view`, `begin_checkout` (booking widget + reservation
  links), `generate_lead` (enquiry submit), `purchase` / `payment_failed`
  (i-Pay result). What does not exist is anywhere to *look* at it — see the
  open decision below.

### Partly done

- **Payment / voucher reconciliation** — `Payment` and `Refund` are modelled
  and populated only from ICICI's signed callback (`orderId`, `trackingId`/
  `bankRefNo`, `paymentMode`/`paymentInstId`). But `Voucher` has no `paymentId`
  or any FK to `Payment`, so nothing can currently say "this voucher was paid
  by that transaction." Needs: a schema link, ICICI's Transaction Status +
  Settlement Summary/Details calls (both still deferred in
  `GO_LIVE_CHECKLIST.md` → i-Pay), and a reconciliation view in `/admin`.
  *Updated 2026-09-16:* the booking engine's `Booking.paymentId` is exactly
  that link for direct bookings, and `Payment.reservationNo` carries the
  booking reference back the other way — so the gap is now specifically
  `Voucher`'s, not payments in general.
- **Legacy host decommission** — no work in this repo; blocked entirely on
  cutover (DNS + final catch-up import). The daily legacy sync script retires
  at the same moment.

### Not started

- **Offers page + pricing dashboard** — no route, no content file, no model.
  First feature that genuinely needs ISR rather than plain SSG (see CLAUDE.md's
  note about an admin-curated offers banner). If pricing is staff-editable this
  is two features: the marketing page, plus a Prisma model and admin CRUD.
- **Web check-in** — largest item on this list. New guest-facing flow, new
  model, identity-document handling (and the retention question that brings),
  a link from the voucher/confirmation email. Needs scoping before estimating —
  see the open decision below.
- **Careers / destination guides / F&B pages** — none exist; `content/` has
  awards, experiences, hotels, legal, reviews, site. These follow the
  established pattern (typed content file + page reusing `EditorialRow` and
  friends), so Careers and F&B are genuinely quick. Destination guides are the
  outlier: the cost is photography and copy, not code, and the WP uploads
  folder is gone from this machine (see CLAUDE.md → Source content), so new
  destination imagery has to come from an external backup or a fresh shoot.
  Add every new top-level route to `app/sitemap.ts`'s `staticPaths`.

### Needs scoping before it can be placed in a phase

- **STAAH integration** (raised 2026-09-10) — STAAH is a channel manager: rate
  and inventory distribution to OTAs, plus a booking engine. Nothing in this
  plan accounts for it, and it changes the premise the current site is built
  on: today the enquiry form is the only commercial path, and a guest cannot
  book online. Wiring STAAH in means live availability and rates, a booking
  flow, and a payment step that belongs to a real reservation rather than the
  standalone i-Pay page — that is a product decision, not a feature ticket, and
  it interacts with the i-Pay work already done. Scope it on its own before
  slotting it anywhere; do not treat it as a Phase 2 line item alongside a
  careers page.

  **Partly overtaken by events (2026-09-16).** A direct booking engine now
  exists — `/book`, with staff-managed rates and inventory on `/admin/rates`,
  and payment through the existing i-Pay gateway (see CLAUDE.md → Booking
  engine). It answers the "a guest cannot book online" half of the problem
  without STAAH, and it links `Payment` to a real reservation via
  `Booking.paymentId`. It does **not** answer the distribution half, and it
  introduces the one thing STAAH exists to prevent: this app and STAAH can sell
  the same room, because neither can see the other's inventory. The engine is
  therefore safe only while `RoomRate.totalRooms` is an allotment deliberately
  held back from STAAH.

  What still needs scoping is consequently narrower than it was: either a real
  two-way STAAH integration (its API becomes the source of truth and `RoomRate`
  retires), or an explicit decision that direct and STAAH inventory stay
  manually partitioned. That is still a commercial decision, not a ticket — but
  it is now a decision about *reconciling* two booking paths rather than about
  whether to have one at all.

  Also note: this was written while every "Book Now" CTA still pointed at
  STAAH. They point at `/book` as of 22 Sep 2026. The new
  engine is reachable at `/book` only, deliberately, so that a property with no
  allotment loaded is not a dead end. Repointing those CTAs is the switch that
  makes direct booking the default, and it should be thrown per-property, once
  real allotments exist.

### Parked, deliberately

- **AI integration** and **further visual redesign**. Position of record: refine
  the existing design system rather than replace it, and don't scope the
  redesign question now.

### Open decisions (blocking estimates)

1. **Conversion dashboard: GA4 exploration, or an in-app page?** The events
   already fire, so a GA4 exploration costs no code. An in-app page is more
   work but reads our own Postgres — `Enquiry`, `Payment` and `Voucher` are all
   indexed on `createdAt` + `hotelSlug`, so enquiries→payments by property and
   date is a straightforward query. Very different amounts of work.
2. **Web check-in scope** — does it write back into something the front desk
   actually uses, or is it a standalone form that emails them? And which
   identity documents, if any, do we store, for how long?

### Suggested order

Content pages (cheap, no dependencies) → offers/pricing → reconciliation →
conversion dashboard → web check-in. Decommission slots in whenever cutover
completes.

## Back office — decisions log

Decisions taken on the back-office build (`/admin`), recorded here because they
are answers from people rather than facts recoverable from the code, and a
chat thread is not somewhere they survive. Each one is settled unless a later
entry supersedes it.

**Phasing.** A0 (schema, staff accounts, roles) → A1 (Inventory & Rates) → A2
(dashboard, bookings, STAAH sync queue) → B (Setup, cancellation policies,
modify/cancel, manual bookings). One branch and one PR per phase.
**Phase C is dropped** — Guests (Module 6) and Reports (Module 7) are out of
scope, confirmed 17 Sep 2026. That removes the phase, not work from B.

**Operating model — superseded 22 Sep 2026: STAAH is out.** The website is now
the only channel it sells through, so `RoomInventory.roomsOnSale` is the room's
true sellable count rather than an allotment held back from anyone. The
`staah:read`/`staah:write` capabilities and the dead `reservationUrl` constant
were removed the same day; the A2 STAAH sync queue is dropped, not deferred.

What this costs: the double-sell risk is gone, and with it the manual mirroring
that depended on someone remembering. What it buys the other way is that there
is no second channel quietly taking bookings — so a property with no rates
loaded sells *nothing*, rather than falling back. Loading rates stops being a
sequencing preference and becomes launch-blocking.

*Previously (10–17 Sep 2026): the website sold its own allotment per hotel,
room type and night and STAAH sold the rest, with staff mirroring website
bookings into STAAH by hand. Kept here because the allotment-held-back wording
explains why the schema is shaped the way it is.*

**Production data.** There are no live bookings and no rate rows in
production (confirmed 17 Sep 2026), so **no backfill is needed** and the A0
migration's data-preservation path never fires in practice. It stays in the
migration because it cost nothing to write correctly and proves out on a
scratch database; it is simply not load-bearing.

**Holidays.** Staff enter the movable festivals themselves — Holi, Eid,
Dussehra, Diwali, Guru Nanak Jayanti — and `content/holidays.ts` seeds only
the fixed-date national holidays. Do not seed a guessed festival date: those
are exactly the nights a property prices its peak season around, and a wrong
column in shade invites a season to be loaded against it.

**GST — the slab, confirmed by finance 17 Sep 2026.** Per room, per night,
against that night's rate: **5% up to ₹7,500, 18% above**, effective
**22 Sep 2025**, and editable thereafter. Three details, all confirmed, all
worth a rupee or several:

- **₹7,500 is inclusive** — a room at exactly ₹7,500 is taxed at 5%.
- **Extra-adult and child charges count toward the ₹7,500 test.** On a ₹7,000
  room with a ₹1,000 extra adult, the night is tested at ₹8,000 and taxed at
  18%, not 5%.
- **The threshold is tested night by night, never on the booking total.** A
  stay priced ₹7,000 on weeknights and ₹9,000 at the weekend pays both rates
  inside one booking; a six-room-night stay at ₹6,000 pays 5% throughout,
  whatever it sums to.

A booking stores the tax it was priced with, so moving the slab — now or when
finance moves it again — only affects quotes made after the change and never
re-prices a guest who has already agreed to pay. The screen that edits it is
**Admin-only and writes an `AuditEvent`**: a typo there re-prices every future
quote, which makes it a different kind of control from a rate edit. This lands
in Phase B.

## Working agreement

- Commit early and often to `main` (or short-lived branches) on the public
  repo, small reviewable chunks — not one giant PR at the end.
- Each phase's pages get a real visual check (dev server + browser
  screenshot) before being marked done — not just "it compiles."
- Ask before adding any paid/third-party service (email provider, image CDN,
  analytics).
