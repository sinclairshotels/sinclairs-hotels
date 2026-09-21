# Go-Live Checklist

Everything below is a real, currently-open gap between "the app works in dev,
pointed at my own inbox" and "this is safe/correct to put in front of real
guests on sinclairshotels.com." Nothing here is a nice-to-have — each item is
either a security requirement, a data-loss risk, or something that will
silently misbehave (send no email, misroute traffic) if skipped. Check items
off as they're actually done, not just started.

**This file is the Phase 1 cutover set** — the launch-blocking remainder, on
top of everything already built. Phase 2 (post-launch work) and the full split
live in `PLAN.md` → "Scope boundary". A handful of lines below belong to Phase 2
and are marked *(Phase 2)* inline — voucher void/resend and print/PDF, per-user
staff accounts, the Yangang question, and decommissioning the old host (which
can only happen after cutover). Commercials and scope are agreed on a call
before this work starts.

**Last verified against the repo: 2026-09-10.** Ticked items were confirmed in
code/data at that point, not just assumed.

## Preeti's feedback doc

- [ ] **Get the doc and agree which items are in scope for launch.** Named as a
      Phase 1 bucket ("items, not all") but the document isn't in this repo and
      has never been reviewed here, so it is the one launch requirement that
      can't be measured against the code or estimated. Everything else on this
      list is either done or has a known shape; this doesn't. Resolve it early —
      it can only grow Phase 1.

## Email

- [x] **Verify `sinclairshotels.com` in Resend** — verified, with the
      `resend._domainkey` DKIM record live in DNS. Before this, mail sent from
      `onboarding@resend.dev`, which can only deliver to the Resend account's
      own verified address — see `lib/mail.ts`.
- [x] `MAIL_FROM_ADDRESS` set in production to
      `Sinclairs Hotels <no-reply@sinclairshotels.com>`.
- [x] `STAFF_NOTIFY_EMAIL` set in production to `reservations@sinclairshotels.com`,
      which is also the code's own default. It had briefly been pinned to a
      personal address while environment variables were rebuilt during the move
      to the company Vercel team — an override is easy to introduce and silent,
      since the correct value is a fallback rather than a required setting.
- [x] `VOUCHER_OFFICE_EMAIL` set in production to `kolkata@sinclairshotels.com`.
- [x] `OWNER_BCC_EMAIL` set in production to `shlarchive@sinclairshotels.com`.
      The business asked for a permanent archive copy of all correspondence, so
      this stays set rather than being cleared at launch.
- [x] `MAIL_RECIPIENT_OVERRIDE` unset in production — it is Preview-only, where
      it redirects every outbound mail to a single inbox.
- [ ] **Set `DIGEST_TO_EMAIL` in production.** It has no fallback: the cron at
      `30 1 * * *` (07:00 IST) reads it, finds nothing, logs `digest.skipped`
      and returns HTTP 500. The daily enquiry digest therefore never sends, and
      Vercel records a failed cron every morning — noise that trains people to
      ignore a red cron, so a real failure later goes unnoticed. Left unset
      deliberately pre-launch so business inboxes receive no automated mail
      before the site is live. Legacy sent to `raviplanet@gmail.com` with
      `admin@sinclairshotels.com` Bcc; confirm the real distribution list with
      the business, then set `DIGEST_TO_EMAIL` and optionally `DIGEST_BCC_EMAIL`
      — and redeploy production afterwards, because env is snapshotted at build
      time and the variable alone changes nothing.

## i-Pay (ICICI Payment Gateway, Standard mode)

CCAvenue (the legacy gateway) has been retired from the codebase — ICICI is
now the only payment gateway, in Standard/redirect mode (card data is
captured on ICICI's own domain, never on this app, keeping it at PCI-DSS
SAQ-A rather than SAQ-D).

- [x] **UAT credentials obtained** — real test-merchant `ICICI_MERCHANT_ID`,
      `ICICI_AGGREGATOR_ID` and `ICICI_HMAC_KEY` from ICICI's onboarding kit
      (Sept 2026) are in `.env.local` with `ICICI_ENV=uat`. Sandbox only —
      never promote these to production.
- [x] **Real round-trip tested against ICICI UAT** (2026-09-12, and previously
      on 2026-09-08). Order `26091240EF2DECF3`, ₹1, card: initiateSale accepted,
      guest redirected, signed callback verified by `verifyHashV1`, amount echo
      matched, row moved `INITIATED → SUCCESS` (`response_code 0000`,
      `payment_mode Card`), both confirmation emails sent, `purchase` fired once
      with the right ecommerce payload, and a page refresh did **not** duplicate
      it. Refund of the same order also succeeded end to end.
- [x] **Hash version settled empirically**: v1 is correct for `initiateSale` —
      a wrong hash is rejected outright, and this redirected.
- [x] **`paymentID` vs `txnAuthID` settled**: ICICI populated *both*
      `trackingId` and `bankRefNo` on the real response, so the defensive
      "accept either" handling in `lib/icici.ts` stays.
- [ ] Get the **production** merchant credentials (separate from the UAT set
      above) and add them to Vercel env, not `.env.local`.
- [ ] **Resolve the field-naming ambiguity in ICICI's own spec** — Chapter 6
      (Authorize) calls the auth reference `paymentID`, Chapter 7
      (Authorization Redirect) calls the same-looking value `txnAuthID` in
      its sample response. `lib/icici.ts` accepts both defensively, but this
      needs confirming against a real UAT response before launch.
- [ ] Confirm which hash version applies to `initiateSale` — the doc's intro
      calls it "a json request" but never explicitly says "Hash Calculation
      v2" for it (only Get Card Bin / UserCancel / Get Service Charges do).
      Implemented as v1 per the doc's own default rule (Note 2); verify this
      is right against a real sandbox response before trusting it with a
      live transaction.
- [x] Refund/Void — implemented (`callRefund` in `lib/icici.ts`, admin refund
      dialog with source-account display). **Untested against the real
      gateway**; covered by the UAT round-trip item above.
- [ ] Still out of scope, deferred until actually needed: Transaction Status,
      Settlement Summary/Details reconciliation, Generate QR, Get Card Bin,
      Get Service Charges, UserCancel. None of these block a guest completing
      a payment or staff issuing a refund.

## Voucher module

Verified end to end on 2026-09-10 (local): staff login → issue → guest email +
office copy → guest view page. It works; what's open below is scope, not bugs.

- [x] **Issue flow works end to end.** `createVoucher` writes the row, emails
      the guest, sends an office copy (Bcc'd to the booking office and
      `reservations@sinclairshotels.com`), and the guest can open `/v/[token]`.
      Covered by `e2e/voucher.spec.ts` (login → issue → guest view) plus unit
      tests for the form, the view and the action.
- [ ] *(Phase 2)* **Issue-only — there is no edit, void/cancel or resend.** A wrong voucher
      can only be corrected by issuing a second one, and a guest who loses the
      email can't be sent it again. Decide: acceptable at launch, or do void +
      resend go in first?
- [ ] *(Phase 2)* **No print/PDF output** — the guest gets an HTML email and a web page;
      the legacy tool printed. Confirm the properties and front desks accept
      that before cutover.
- [ ] `reservations@sinclairshotels.com` is hardcoded as the office-copy
      fallback recipient (`app/admin/(dashboard)/vouchers/actions.ts`). Confirm
      that mailbox exists and is monitored, or change it.
- [ ] Per-hotel booking-office details are still incomplete — see Data below.
      Only "Sinclairs Hotels — Head Office" is selectable in the voucher form.
- [x] **Voucher numbering fixed.** The legacy import wrote `voucherNo`
      explicitly, which does not advance Postgres's sequence, so the counter sat
      near zero while imported rows occupy 21455-35001 — the first voucher
      issued came out as #3. Both databases corrected with `setval` to 35001 on
      2026-09-12 (next voucher is #35002), and `scripts/migrate-legacy-data.ts`
      now advances the sequence itself so a re-import cannot reintroduce it.
      Fixed, but **not self-verifying** — see the sequence check in `## Data`.

## Analytics

Full specification, funnels and GA4 config in `docs/analytics-events.md`.

- [x] **Nine events implemented in code**: `view_item`, `form_start`,
      `generate_lead`, `begin_checkout`, `add_payment_info`, `purchase`,
      `payment_failed`, `contact_click`, `sign_up` — plus automatic `page_view`.
      Four funnels, each with a calculable drop-off.
- [x] CSP widened for Google Ads, doubleclick, the GA4 regional hosts and
      tagassistant.google.com — without those the Ads tags and GTM Preview are
      silently blocked on this site.
- [ ] **Blocker: GTM edit access.** The available Google account has read-only
      access to container `GTM-NDXBWC`; Edit + Publish at container level is
      needed before any tag work can start.
- [x] **Worked around, not resolved.** Verified against production 2026-09-12
      that the container forwards *none* of the nine events — a hotel page fires
      `view_item`, `contact_click` and `form_start` and the only GA4 hit on the
      wire is `en=page_view`. `lib/analytics.ts` now also sends all nine to
      `G-7Y4FZLC5MW` directly via `gtag.js`, which needs no container access.
      Set `NEXT_PUBLIC_GA4_ID` to switch it on. **Unset it the moment the
      workspace below is published, or every event is counted twice.**
      See docs/analytics-events.md § Transport.
- [ ] Set `NEXT_PUBLIC_GTM_ID=GTM-NDXBWC` in Vercel env (production). Also
      switches on every "All Pages" legacy tag (Meta pixel, Ads remarketing) for
      this site — a deliberate decision, not a side effect.
- [ ] Build the `next-site-cutover` workspace: 12 variables, 9 triggers, 9 GA4
      tags, 4 Ads conversion tags (copies of the legacy tags with the trigger
      swapped, since the conversion IDs live in those tags).
- [ ] GA4 admin: register 9 custom dimensions, mark the 5 key events, confirm
      enhanced measurement history-change tracking is on. Do this *before*
      verifying — unregistered parameters look like broken tags.
- [ ] Verify in GTM Preview + GA4 DebugView against the Vercel deploy, then
      publish the workspace (publishing touches the container serving the live
      WordPress site — needs sign-off).
- [ ] **Every legacy conversion breaks at cutover.** All of them fire on
      WordPress URLs (`/thank-you/?form=…`, `pay-success`) or Elementor click
      classes (`bebtn_*`) that don't exist here. Rebuilding them against the
      events above is what keeps Google Ads reporting conversions at all.
- [ ] Tell whoever runs Google Ads (TechSol / Web-Connect are both active in the
      container) before cutover, so spend isn't optimising against zero
      conversions.
- [ ] **Do all of the above before DNS cutover**, so there's a genuine
      before/after baseline rather than a gap at the switch.

## Server logs (Vercel)

`lib/log.ts` writes one line of JSON per server event, which Vercel indexes into
filterable fields — search these in the project's Logs tab (or `vercel logs`).
This is the server-side record of the funnel, independent of GA4: it survives ad
blockers, a guest closing the tab, and the GTM container blocker above, so when
GA4 and the database disagree this is the tiebreaker.

| Event | Fires when | Client counterpart |
|---|---|---|
| `enquiry.created` | lead committed to Postgres | `generate_lead` |
| `enquiry.invalid` / `enquiry.spam_blocked` / `enquiry.rate_limited` | submission rejected | *(none — rejected leads fire nothing)* |
| `newsletter.subscribed` / `newsletter.duplicate` / `newsletter.spam_blocked` | subscribe outcome | `sign_up` |
| `ipay.initiated` | Payment row created, before the gateway call | `add_payment_info` |
| `ipay.settled` | ICICI's signed callback verified and applied | `purchase` / `payment_failed` |
| `ipay.callback.replayed` | duplicate callback ignored | *(explains a duplicate purchase)* |
| `ipay.callback.rejected` | bad signature, unknown order, missing id | *(security signal)* |
| `ipay.callback.amount_mismatch` | gateway amount ≠ order amount | *(tamper/replay signal)* |
| `ipay.gateway_unreachable` / `ipay.gateway_rejected` | initiateSale failed | *(none — guest never reaches ICICI)* |
| `mail.sent` / `mail.send_failed` / `mail.skipped_no_provider` | staff/guest notification | — |

Guest data never reaches a log line: `lib/log.ts` redacts `name`, `email`,
`phone`, `message`, IPs and mail recipients by key name, so an accidental
`log.info('x', { email })` prints `[redacted]` rather than the address. Log ids
and slugs, and join to Postgres when the personal detail is actually needed.

- [ ] After cutover, spot-check `enquiry.created` count against the `Enquiry`
      table and against GA4's `generate_lead` for the same day. Three sources
      agreeing is the only real proof the funnel is wired end to end.

## Production environment (Vercel)

Every variable the code actually reads, and its go-live state. Anything unset
in production either breaks (`DATABASE_URL`, `ADMIN_*`) or silently does
nothing (`NEXT_PUBLIC_GTM_ID`, `RESEND_API_KEY`).

- [ ] `DATABASE_URL` — production Postgres (Neon/Supabase), not the local Docker one.
- [ ] `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` — fresh production values, not
      the local dev ones.
- [ ] `CRON_SECRET` — see Security below.
- [ ] `RESEND_API_KEY`, `MAIL_FROM_ADDRESS`, `STAFF_NOTIFY_EMAIL`,
      `DIGEST_TO_EMAIL`, `DIGEST_BCC_EMAIL` — see Email above.
- [ ] `MAIL_RECIPIENT_OVERRIDE`, `OWNER_BCC_EMAIL` — must be **absent** in
      production, not set to something harmless.
- [ ] `ICICI_MERCHANT_ID`, `ICICI_AGGREGATOR_ID`, `ICICI_HMAC_KEY`,
      `ICICI_ENV=prod` — production merchant credentials, never the UAT set.
- [ ] `NEXT_PUBLIC_GTM_ID` — see Analytics above. One env var, and the only
      way to get a before/after baseline; do it before cutover, not after.
- [ ] `NEXT_PUBLIC_GA4_ID` — `G-7Y4FZLC5MW`. The direct-to-GA4 workaround for
      the container blocker above. Mutually exclusive with published GTM tags
      for the same events.
- [ ] `SITE_BASE_URL` — currently overrides the base URL for absolute links in
      emails/vouchers because `sinclairshotels.com` still serves WordPress
      (`lib/site-url.ts`). **Remove the override at cutover**, once
      `siteConfig.url` is genuinely this app.

## Data

- [x] **Historical data migration — done (2026-09-08): four legacy tables from
      three MySQL databases.** Re-verified locally 2026-09-10: 35,837
      enquiries, 13,539 vouchers, 26,258 newsletter subscribers, and 5,234
      legacy payments (`cca_status`, the old CCAvenue/HDFC gateway log, added
      in a second pass). Re-running inserts 0 rows. Skips are small and
      reasoned in `dumps/migration-report.json` — 53 enquiries, 3 vouchers, 40
      payments, all unmapped-property or unparseable-date. That file is outside
      the repo and overwritten every run, so the durable summary now lives in
      `docs/legacy-import-report.md`; keep it as the record once the dumps go.
- [ ] Confirm those counts in **production**. The figures above were checked
      against local dev; the production import ran on 2026-09-08 and hasn't
      been re-counted since.
- [ ] **Final catch-up import immediately before cutover** — the legacy site is
      still live and still collecting enquiries/vouchers/signups every day. The
      import is insert-only, so it picks up new rows but not edits to rows
      already imported.
- [ ] Real per-hotel booking-office data (GSTIN, address, phone, email) — the
      legacy `voucher_hotels` table has this and was never pulled.
      `content/site.ts` lists the head office only, so vouchers show incomplete
      billing details.
- [ ] **Decide what happens to the masked-card table** (`sinclairsltd_hdfcmpgs`)
      — never imported, and not among the four dumps we hold. Recommendation:
      import nothing. Masked PAN + expiry is cardholder-adjacent data with no
      operational use in the new app — ICICI Standard mode means card data
      never touches us — and importing it would pull a PCI question into a
      system that currently has none. Whichever way we go, it needs to be
      explicitly destroyed with the legacy box, not just left behind on it.
- [ ] **Decide on the unused legacy tables** — `voucher_users`, `voucher_admin`
      and `admin_pass` (the old staff logins, superseded by `ADMIN_PASSWORD`)
      are referenced by the legacy PHP but were never imported. Default: don't
      import. Treat those password hashes as compromised — that box had a
      webshell — and confirm nobody reuses those credentials elsewhere.
- [ ] *(Phase 2)* Decide what "Sinclairs Yangang" is (1,043 enquiries + 58 vouchers,
      confirmed in the local DB) — imported verbatim rather than folded into
      `gangtok`, pending a call on whether it's a separate property.
- [ ] **The newsletter list has no opt-out state, and the app has no unsubscribe
      flow.** All 26,258 imported subscribers have `unsubscribedAt = NULL`, going
      back to 2014-06-04. That is faithful to the source, not an import bug: the
      legacy `newsletter_signup.date_unsubscribe` column is `NULL` on 16,434 rows
      and MySQL's zero-date `0000-00-00 00:00:00` on the other 10,034 — **zero
      real unsubscribes in twelve years**. The reason is in
      `legacy-php-site/newsletter_unsubscribe.php`: its only database write is
      **commented out**, so the old unsubscribe page told people they were
      unsubscribed and never recorded it.
      Nothing mails this list today — the only newsletter email
      (`newsletter-notification`) goes to staff, and nothing in `app/` or `lib/`
      ever writes `unsubscribedAt` — so this is latent, not live. It becomes real
      the first time anyone sends a campaign: some unknown share of those 26,258
      addresses asked to be removed and were silently kept, and there is still no
      way for a recipient to opt out.
      **Decided 2026-09-13: no unsubscribe route is being built.** That is fine
      while nothing sends to the list. It stops being fine the moment a campaign
      goes out — every bulk sender (and India's DPDP consent rules) requires a
      working opt-out — so treat an unsubscribe route plus re-permissioning the
      list as prerequisites of the first send, not as work owed now.
- [ ] **Verify the voucher sequence in production before cutover, and again
      after the catch-up import.** The 2026-09-12 fix was a one-time manual
      `setval`; `scripts/migrate-legacy-data.ts`'s `syncVoucherSequence()` only
      re-runs as the last step of a full import, and **nothing else asserts the
      invariant**. The local dev database currently violates it — its sequence
      sits at 509 against imported vouchers numbered 21455-35001, so the next
      voucher issued locally would be #510 (the test suite creates and deletes
      vouchers, consuming the sequence from a low base; `pnpm seed:dev` resets it
      to 35001). Production was fixed separately and should be fine, but "should
      be" is the problem. One query settles it:

      ```sql
      SELECT (SELECT last_value FROM "Voucher_voucherNo_seq") AS seq,
             (SELECT max("voucherNo") FROM "Voucher") AS max_voucher;
      -- seq must be >= max_voucher
      ```
- [ ] *(cosmetic, public URLs)* 11 imported vouchers have `checkOut` **before**
      `checkIn` (e.g. #22026 Kalimpong, 2020-12-30 → 2020-01-01), and 23 have
      `rate = 0`. Bad data in the legacy free-text date fields, not a parsing
      bug. Nothing crashes — `lib/voucher-view.ts` prints both dates and never
      computes nights — but each is reachable at its own `/v/<token>` URL and
      reads as broken. Either correct the 11 by hand or accept them as historical.

Note: legacy free text carries attack payloads — `migration-report.json` shows
enquiry rows containing PHP object-injection probes submitted to the old form.
They're stored as inert text and React escapes them on render, so nothing
executes today. Keep it that way: don't add `dangerouslySetInnerHTML` or a raw
HTML export to any admin view that shows imported content.

## Security

- [ ] **Legacy GoDaddy server**: a webshell/backdoor was found and quarantined
      locally during migration research but **the live host itself was never
      remediated** — credentials need rotating and the box needs a real scan.
      This is independent of the Next.js rebuild and can't be done from here.
- [ ] *(not launch-blocking)* Generate and set a real `CRON_SECRET` in Vercel
      env. The route fails closed — with no secret set it returns 401 to
      everyone, including Vercel's own cron — so the only consequence of
      skipping it is that the daily digest email never sends. No security hole.
- [ ] The legacy sync script (`sync-legacy-data.sh`) is **no longer on disk** as
      of 2026-09-10 — only the dumps it produced remain, under
      `~/Desktop/sinclairs-wp-backup/legacy-php-site/dumps/`. If the pre-cutover
      catch-up import needs it, it has to be rewritten; when it is, it holds the
      legacy MySQL root password in plaintext and SSHes into a compromised box,
      so delete it (and the dumps) once the import is confirmed complete rather
      than leaving either lying around post-cutover.
- [ ] *(Phase 2)* Admin auth is currently a single shared `ADMIN_PASSWORD` —
      fine to launch with, but revisit for real per-user accounts once more
      than a couple of people use `/admin`.

## Unresolved legacy tables — decide before cutover

Checking the legacy databases directly (rather than the four tables the import
script happens to read) turned up two that were never migrated. The import's own
header records that `cca_status` was "missed in the first migration pass and
added later", so a second omission is plausible rather than unlikely.

- [ ] **`ipay_entries` — 6,651 rows**, in `sinclairsltd_hdfcmpgs`. More rows than
      the entire Payment table we did import. Most likely the attempt/initiation
      log to `cca_status`'s response record — the same relationship the new
      `Payment` table has with its `INITIATED` rows that never settle — which
      would make it wanted only for the abandonment metrics in
      `docs/analytics-events.md`, not for money actually taken. Still unconfirmed:
      it needs the table's date range and whether its order IDs are the same
      orders as `cca_status`'s.

      **Do not reason from the gateway names here — three brands attach to one
      payment flow.** The table is called `cca_status` and its columns are
      verbatim CCAvenue response fields (`tracking_id`, `bank_ref_no`,
      `failure_message`, `billing_name`), it lives in a database named
      `sinclairsltd_hdfcmpgs` (HDFC MPGS), and the daily ops report
      (`utility/sinclairs-booking-cron.php`) prints its `order_id` under the
      heading **"iPay Order No."**. So `ipay_entries` being "the i-Pay table" is
      no evidence that it is a different gateway from the one we imported.

      **`cca_status` is not dead history.** Its dump runs to `2026-09-12
      11:42:02` — it is the actively written payment record, and the daily
      report reads it (filtered to `order_status = 'Success'`) as *the* record of
      money taken. The worry that we imported a retired gateway's history and
      skipped the live one's is therefore not supported: we imported the live one.
- [ ] **`hdfc_itsbook` — 13,404 rows**, in `sinclairsltd_official`. Close in size
      to `voucher_detail` (13,560), which could mean it is the booking records
      vouchers were issued against — already represented — or a parallel ledger
      vouchers only partly cover.

Also unmigrated, deliberately, but worth a decision before the old host is
decommissioned: `pr_cv` (215 job applications — real applicants' personal data),
`sin_pressclip` (303 press clippings, possibly better than the hand-curated
`/media` list), and the old staff login tables, which are the record of who had
access if per-user accounts are ever built.

To inspect:

```
ssh -p 5822 root@<legacy-host> 'for t in sinclairsltd_hdfcmpgs.ipay_entries sinclairsltd_official.hdfc_itsbook; do db=${t%%.*}; tb=${t##*.}; echo "=== $t ==="; mysql -N -e "SHOW COLUMNS FROM $db.$tb;"; mysql -e "SELECT * FROM $db.$tb ORDER BY 1 DESC LIMIT 1\G"; done'
```

Three likely outcomes: duplicates under different gateway names (nothing to do);
genuinely missing payment history (extend `scripts/migrate-legacy-data.ts`, same
idempotent pattern); or attempt logs rather than settled records (import only if
the abandonment metrics are wanted). The local evidence points at the third for
`ipay_entries`.

- [ ] **Rotate the legacy MySQL credentials, and keep them out of any backup we
      retain.** `legacy-php-site/utility/sinclairs-booking-cron.php` carries a
      live `sinclairsltd_root` username and password in plaintext, for both
      `sinclairsltd_official` and `sinclairsltd_hdfcmpgs` — the databases holding
      every enquiry, every guest name and email, and the payment records. The
      same file also hardcodes a personal Gmail address as the daily report's
      recipient. Those credentials are still valid on the legacy host, and this
      rebuild exists partly because that host was found compromised. Rotate them
      (or decommission the databases) at cutover, and scrub the file before this
      backup is archived anywhere but the local disk.

## Cutover

- [x] **301 redirects from the old WordPress URL structure to the new one.**
      Built in `lib/legacy-redirects.ts`, wired via `next.config.ts`'s
      `redirects()`. All 187 live legacy URLs verified against a production
      build: 185 redirect to a page that returns 200, and `/` and `/media`
      already exist at the same path.

      The inventory came from **crawling the live site**, not its sitemap —
      `sinclairshotels.com/sitemap.xml` is stale third-party output that misses
      every `/gangtok*` URL, all of `/palace-udaipur*`, and the whole
      `/reservations.php?ht=…` set. It is committed as
      `lib/legacy-redirects.fixture.json`, and the test asserts every URL in it
      lands on a real route, so a future route rename fails CI instead of
      silently creating 404s.

      Shape of the map: `/<property>` and `/<property>-<anything>` collapse onto
      `/hotels/<slug>` (rooms, dining, conference, gallery and packages are all
      sections of one page now); the old booking engine's
      `?ht=<CODE>` query is decoded back to the property so
      `/reservations.php?ht=GAN&rm=GDR` keeps its property instead of dumping
      everyone on `/hotels`; per-property factsheet PDFs go to the property they
      described. `portblair` → `port-blair` and `palace-udaipur` → `udaipur` are
      the two prefixes that differ from the slug.

      Legacy query params ride through to the destination
      (`/hotels/gangtok?ht=GAN`), which is harmless — the canonical tag on the
      destination is the clean URL either way, verified.
- [ ] DNS: point `sinclairshotels.com` at Vercel once everything above is done.
      The canonical host is **`https://www.sinclairshotels.com`** — that is what
      `siteConfig.url` emits in every canonical, OG URL and sitemap entry, and
      what the legacy site already 301s `http://` apex and `http://www` to.
- [x] **Apex → `www` is already configured in Vercel** (`sinclairshotels.com`
      → `www.sinclairshotels.com`, 308, verified 2026-09-12), along with
      `staff.`, `dev.` and `staff.dev.`. The apex currently answering `200`
      without redirecting is the *old* stack's behaviour and disappears when DNS
      moves — nothing to do here.
- [x] **`staff.sinclairshotels.com` DNS — done.** Verified 2026-09-13: it CNAMEs
      to `cname.vercel-dns.com` and serves the staff sign-in; the Payments page was
      checked through it. Note the asymmetry this creates — the staff tool is live
      on the production domain **while the apex and `www` still resolve to the
      legacy box (68.178.172.70)**. That is intended (it is how staff reach the
      tool pre-cutover) but it means the admin is publicly reachable on a
      production hostname today, behind nothing but the shared `ADMIN_PASSWORD`.
      `robots.txt` disallows `/admin` on every host.
- [ ] **Remove `SITE_BASE_URL` from Vercel production**, so absolute links in
      emails and vouchers point at the real domain rather than the Vercel one
      (`lib/site-url.ts`). This no longer affects `robots.txt`: that is decided
      per request from the `Host` header (`app/robots.ts`), so it opens by
      itself the moment DNS points `www.sinclairshotels.com` here, and stays
      `Disallow: /` on `dev.`, `staff.`, the `.vercel.app` URL and every preview
      — which would otherwise have become crawlable duplicates of the live site
      at cutover.
- [ ] Resubmit `sitemap.xml` in Google Search Console after cutover, and keep
      the old property in Search Console long enough to watch the 301s being
      picked up (Coverage → "Page with redirect" should climb as 404s fall).
- [ ] **No privacy policy, terms or cookie notice exists on the new site.** The
      old one had `/privacy-policy`, `/policy` and `/tnc`; all three currently
      301 to the homepage, which is a stopgap, not a mapping. The site collects
      names, emails and phone numbers through the enquiry form and processes
      card payments through ICICI, so these pages need to exist before cutover —
      redirecting a legal page to home is both an SEO soft-404 and the wrong
      answer to a guest looking for it.
- [x] **GitHub repo connected — done.** Confirmed 2026-09-13: pushing `379a288`
      produced a Preview build cloned straight from the commit. Consequence worth
      remembering: the build command is
      `prisma migrate deploy && tsx scripts/sync-room-types.ts && next build`, so
      **a push to `main` migrates the dev database on its own**. Production still
      only moves on `vercel deploy --prod`, so the two drift after every push.
- [ ] *(Phase 2)* Decommission the GoDaddy hosting once DNS has fully cut over and the
      final catch-up import (above) is confirmed complete.
