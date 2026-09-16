# Editing the site

For anyone updating words, photographs or page layouts. Assumes no coding
experience. The business-facing version of this document, written for people who
have never heard of GitHub, is the Site Handbook — ask Subham for the link.

Technical readers should also see `CLAUDE.md` (conventions) and `README.md`
(environments, deploys, databases).

---

## The two environments

| | Site | Database | Email |
|---|---|---|---|
| **Dev** | `dev.sinclairshotels.com`, `staff.dev.sinclairshotels.com` | Neon branch `dev` | all redirected to one test inbox |
| **Live** | `www.sinclairshotels.com`, `staff.sinclairshotels.com` | Neon branch `prod` | real guests |

Dev is a full copy: same code, same pages, same staff tool. Nothing it does
reaches a guest. Break it freely.

---

## How a change reaches the live site

```
you edit  →  push to `main`  →  dev.sinclairshotels.com updates automatically
          →  pull request `main` → `prod`
          →  Subham or Nikhil approves
          →  merge  →  www.sinclairshotels.com updates, database migrates, release tagged
```

You never run a deploy command. Pushing to `main` is enough to see your work on
dev; going live is a reviewed merge.

**Why the approval step exists.** It is not about trust or competence. It means
no single person can put something in front of a guest unreviewed, and every live
change has a record of who approved it. It also means a broken build physically
cannot reach production — CI has to pass before the merge is allowed.

---

## The loop

Say these to Claude Code in plain English. You never need to know which file
anything lives in.

1. **Describe the change.** "On the Gangtok page, rewrite the Premier Suite
   description — mention the Kanchenjunga view and that it sleeps three."
2. **`run the checks`** — catches broken links, missing photographs, pages that
   no longer build. Don't skip this.
3. **`save this and put it on dev`** — then open `dev.sinclairshotels.com` and
   look at it yourself, on a phone as well as a laptop.
4. **`this looks right, raise it for approval`** — opens a pull request for an
   owner to review.

To undo: **"put the Ooty page back to how it was yesterday."** Every version is
kept; reverting is routine.

---

## What you can change

Anything about **what a guest reads or sees**:

- `content/hotels/*.ts` — one file per property: rooms, dining, amenities, event
  spaces, galleries, nearby attractions
- `content/site.ts`, `content/experiences.ts`, `content/awards.ts`,
  `content/reviews.ts` — shared copy, contact details, press, awards
- `public/images/` — photography
- `components/`, `app/(site)/` — page layout and design

Get one of these wrong and it is visible on the page and quick to revert. That
is why they are yours.

## What you cannot change

Anything about **what the site does**. These paths require an owner's review
before they can merge — enforced by `.github/CODEOWNERS` plus branch protection
on `prod`, not by convention:

- `lib/` — database, email, payments, validation, logging
- `prisma/` — the database schema
- `app/api/`, `app/admin/` — the payment callback, cron jobs, staff tool
- `app/(site)/*/actions.ts` — anything that writes to the database or sends mail
- `next.config.ts`, `package.json`, `.github/` — build and security configuration

These fail **invisibly**. A page that looks perfect can silently stop sending
vouchers to guests, or accept a payment that never settles. Nobody notices until
a guest is affected.

**Nobody but Subham and Nikhil has database access at all** — not read, not
write. Content editors are not given Neon or Vercel accounts, so this is not a
rule to remember, it is an access boundary.

---

## Photographs

`public/images/` is **WebP only**, enforced by `pnpm check:images` in CI. Ask
Claude to add a photograph and it converts and sizes it for you. Never resize
anything by hand, and never commit a `.jpg` or `.png`.

Why it is enforced: every deployment uploads `public/` in full and Vercel retains
every deployment, so one stray 27 MB photograph is 27 MB multiplied by every
build made afterwards. That is how deployment storage reached 20 GB against a
10 GB allowance.

High-resolution originals live outside the repo in
`~/Desktop/sinclairs-wp-backup/hires-originals/`. They are the only copies —
archive, never delete.

---

## When something goes wrong

**A page looks wrong after going live** — "put it back to how it was". Every
production release is tagged (`v2026.09.13`), so a known-good state is exact
rather than guesswork.

**The checks failed** — that is the system working. Ask Claude to explain it in
plain English and fix it. If it cannot, send the message to Subham.

**You feel uneasy** — ask before acting. You can always ask *"what would change
if I did this?"* and it will explain without doing anything.

---

## The rule

If a change is about **what a guest reads or sees**, it is yours. If it is about
**what the site does** — taking money, sending email, storing a booking — it is
not. When you cannot tell, ask.
