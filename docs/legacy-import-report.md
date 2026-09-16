# Legacy import — what was brought across, and what was not

`scripts/migrate-legacy-data.ts` writes a `migration-report.json` next to the
dumps it reads (`~/Desktop/sinclairs-wp-backup/legacy-php-site/dumps/`). That
file is **outside this repo, overwritten on every run, and scheduled for deletion
with the dumps after cutover** — so this is the durable copy of what it said.

It is deliberately a summary. The raw report carries `skippedSamples`: real
guests' names, emails and phone numbers, plus the PHP object-injection payloads
some legacy enquiry rows contain. None of that belongs in git, which keeps it
permanently.

Regenerate the underlying file by re-running the import; it is safe to re-run
(every insert target has a real unique constraint and uses `skipDuplicates`).

## Rows skipped, and why

Every skip is a row the legacy database held that this app's database does not.
All of them are unparseable or unmappable source data, not import failures.

| Table | Rows in dump | Skipped | Reasons |
|---|---:|---:|---|
| Enquiry | 35,936 | **53** | 49 unmapped property `"null"`, 2 `"Premier Room"`, 2 `"123456"` |
| Voucher | 13,560 | **3** | 2 unparseable `check_in`/`check_out`, 1 unmapped hotel `"null"` |
| Newsletter | 26,468 | **0** | — |
| Payment (`cca_status`) | 5,290 | **40** | 37 unparseable `trans_date` `"null"`, 2 unmapped `order_status` `"null"`, 1 missing `order_id` |

"Unmapped property/hotel" means the legacy free-text value matched no slug in
`content/hotels` — `"123456"` and `"Premier Room"` are junk submitted to the old
form, not properties. The unparseable dates and statuses are literal `"null"`
strings in the source.

The import does **not** discard values it merely cannot parse cleanly: numeric
and date fragments that fail to parse are defaulted and the original text is kept
in a free-text note field. Only the rows above were dropped outright.

## Reconciling the counts

Dump total minus skips does not equal the row count in Postgres, because
`createMany({ skipDuplicates: true })` collapses rows sharing a unique key
(`legacyTicket`, `legacyId`, `email`, `orderId`), and `migrateNewsletter()`
additionally de-duplicates by lowercased email before inserting.

As measured against local dev on 2026-09-13:

| Table | In dump | Skipped | In Postgres | Difference |
|---|---:|---:|---:|---:|
| Enquiry | 35,936 | 53 | 35,837 | 46 |
| Voucher | 13,560 | 3 | 13,539 | 18 |
| Newsletter | 26,468 | 0 | 26,258 | 210 |
| Payment | 5,290 | 40 | 5,234 | 16 |

For Enquiry, Voucher and Payment the difference is exactly the `inserted` count
of the most recent run recorded in `migration-report.json` (46 / 18 / 16) — that
run was not applied to this local database, so **local dev is one catch-up import
behind the dumps**. Expect these to close when the final pre-cutover import runs.
Newsletter's 210 is that plus ~190 duplicate email addresses collapsed by the
de-duplication above.

## Attack payloads in imported free text

Some legacy enquiry rows contain PHP object-injection probes submitted to the old
form. They are stored as inert text and React escapes them on render, so nothing
executes. Keep it that way: do not add `dangerouslySetInnerHTML` or a raw HTML
export to any admin view that shows imported content. (`components/voucher-view.tsx`
uses it once, for code-owned static legal copy — never for record data.)
