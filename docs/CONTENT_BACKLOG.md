# Content backlog

Corrections and content requests raised by the team, reviewed by Nikhil.

Check this list before editing anything under `content/` or `public/`, and tick
items off in the same PR that resolves them. An item stays unticked until the
change is on `main` — a half-applied correction is worse than an open one,
because nobody re-raises what looks done.

## A. Content and layout corrections

### Sinclairs Retreat Dooars

- [x] Overview: 5 event spaces
- [x] Rooms: two queen beds
- [x] Meetings: 5 venues, adding The Lilac (720 sq ft, 35 guests) and The Pavilion (1,800 sq ft, 120 guests)

### Sinclairs Palace Retreat Udaipur

- [x] Overview: remove Bar
- [x] Weddings: capacity 500 guests
- [x] Meetings: 3 venues — Rajmahal (7,000 sq ft, 500 guests), Rajmahal Annexe (2,000 sq ft, 125 guests), Haveli (600 sq ft, 40 guests)

### Sinclairs Darjeeling

- [x] Dining: add Kanchenjunga Restaurant and Mount View Café
- [x] Amenities: remove Barbeques
- [ ] Real copy and photography for Kanchenjunga Restaurant and Mount View Café — both were added with placeholder descriptions; Kanchenjunga Restaurant has no photo of its own and falls back to the hero image

### Sinclairs Retreat Kalimpong

- [x] Juniper is the boardroom

### Sinclairs Gangtok

- [x] 2 event spaces — The Cherry Hall (3,700 sq ft, 200 guests) and the Jasmine Boardroom (510 sq ft, 25 guests). The old Cherry Hall "Lower"/"Upper" split is gone; a boardroom counts as an event space, it is only labelled as one.

### Every page

- [x] Hotel page headers are misaligned — fix in the shared component
- [x] Fonts are inconsistent — one type scale applied everywhere
- [x] Page titles repeat — fix the title template
- [x] Gallery headlines sit too close to the photos (e.g. "Panoramic view of Mount Kanchenjunga")
- [x] Emphasise "why book direct" on the home page
- [x] Weddings page: show all venues across all hotels together
- [x] Dining: replace the scrolling strip with one F&B photo per hotel (no storytelling page — it links to that hotel's dining section)
- [x] "Explore <location>" tabs: check placement on every hotel (e.g. Lloyd Botanical Garden on Darjeeling)

## B. Contact (decision, applied site-wide)

- [x] No per-property email addresses anywhere on the site. Every contact point is the enquiry form. Remove existing property emails from hotel pages and the footer.
- [x] No per-property phone numbers either. The toll-free line and WhatsApp are the only two numbers the site publishes — see `contactNumbers` in `content/site.ts`. `ContactInfo` no longer carries a `phone` field at all, so one cannot drift back onto a page; the per-property numbers remain in git history if they are ever needed for a staff screen.

## Not doing

Recorded so nobody re-raises them:

- ~~Careers page~~ — **reversed 23 Sep 2026, and built.** `/careers`, linked
  from the footer only, lists open positions grouped by property and takes an
  application with a CV against any of them or none. Staff add and open or
  close positions at `/admin/careers`, which is its own section in the User
  checklist, and every change writes an `AuditEvent`. Applications are listed
  per position with the CV to download. HR is told through a new **Careers**
  row on the Notification emails panel — with no fallback, so an unset list
  means nobody is emailed rather than somebody's CV landing in a guessed inbox.
  The application is saved and visible in the admin either way.
- Newsletter
- Offers page
- Destination guides
- "Font too big"
- AI integration
- Redesign
- F&B storytelling
- Photo changes for Burdwan, Port Blair and Ooty

## Open

- [ ] **A scenery photograph for Siliguri.** Every property now has a
      `sceneryImage` for the home page hero carousel — a view of the landscape
      it sits in. Siliguri is the only one without a real candidate: the
      repository holds a stadium and the Salugara Monastery gate, and the
      monastery is standing in. Note that the four `hotels/siliguri/gallery/ADS_*`
      files in git history are **not Siliguri** — they show a hill town and the
      white Ooty property, so they are mislabelled and must not be used here.
- [ ] **A better scenery photograph for Burdwan.** Bishnupur is standing in. It
      is a landmark rather than a view, which is the best the plains-town set
      offers; the alternatives are a duck close-up, a street and a yellow
      building.

- [ ] **Food ratings for the hotel Dining sections.** `content/reviews.ts` has
      `foodRatings`, and the Dining section shows an entry where one exists —
      it is empty because no source in this repository publishes a score for
      the food, as opposed to the stay. Each entry needs the property name, the
      score, the scale, the source and its URL, and the review count where the
      source gives one. Deliberately **not** derived from the overall rating: a
      stay scored 5 for its view is not a restaurant scored 5.

- [ ] Dates for the guest reviews in `content/reviews.ts`. The Tripadvisor import
      did not carry them, so the quotes on the room list credit their source and
      say nothing about when — an undated quote is honest, a guessed date is not.
      Supplying real dates means adding the field back to `Review` and to
      `components/room-reviews.tsx` together.

- [ ] **Source links for eleven of the twelve press mentions.** `/media` now
      only styles an item as a link where `content/site.ts`'s `pressMentions`
      entry carries a `url` — before, every card lifted under the cursor and
      then went nowhere, which is why they looked like they linked to the wrong
      page. One (Curly Tales) has a URL; the other eleven need the article's
      own address, or the clipping scanned as the Telegraph pieces were. Until
      then they render as plain cards, correctly.

- [ ] **Room sizes for the ten rooms nobody has measured.** Burdwan's three,
      Dooars' Wooden Cottage and all six at Port Blair have no figure, so their
      tiles show no size and `/admin/rates/monthly` lists them by name under the
      table. The other twenty-nine came from the old site's copy and are seeded
      into `RoomType.sizeSqFt`; staff can correct any of them there. Square feet
      only — the m² shown beside it is worked out from that one number.

## Website feedback, round 2 (23 Sep 2026)

Sections A–C were done in one PR; D is recorded in `PLAN.md`'s decisions log.

### A. Site-wide

- [ ] Hotel pages: more space between the tagline and the booking bar, all nine.
- [ ] Reviews: a hotel page and a booking page show only that hotel's reviews.
      No cross-hotel quotes anywhere; a hotel with none shows none.
- [ ] Room tiles and booking rows show that property's check-in and check-out
      times.
- [ ] "In your room" per room type — bed, bathroom, TV, Wi-Fi, tea/coffee,
      safe, minibar, AC/heater, work desk, balcony where true — as icons with
      labels, sourced from each room's existing description, unknowns left out
      rather than guessed. Editable on Set-up.
- [ ] Explore: every hotel, a list of places with name, one-line description,
      distance in km from the hotel, drive time, and a photo where one exists.
      Content order kept. No photo means no image slot. Flag any place whose
      coordinates are missing.
- [ ] Merge "Dining" and "Food and Dining" into one Dining section per hotel.
- [x] "Timings" → "Opening hours" everywhere. Done in PR #20, with
      `content/opening-hours.test.ts` holding the one format.
- [ ] Pluralise by count: "1 dining venue", "1 event space".
- [x] Press and Media: layout and links. Done in PR #20 — eleven of the twelve
      mentions have no source URL and now render as plain cards rather than
      dead links; those URLs are still wanted (see the entry above).
- [x] Careers in the footer. Done in PR #19.

### B. Booking journey

- [ ] Book Now on a room opens the booking page with that room pre-selected
      and visible in the summary.
- [x] Date handoff: the property page and the booking page open on the same
      dates. Done in PR #20, with the midnight-IST test.
- [ ] "Not yet bookable online" is a dead end. Name the room types with no
      rates loaded for those dates, and offer an Enquire button.

### C. Per hotel

- [ ] **Burdwan** — replace the overview copy; remove "finest accommodation",
      "pulsating environment for relaxation" and "fun-filled destination for
      business executives" wherever they appear; remove yoga from amenities;
      opening hours for Palm Terrace and O3 Bar (blank until the team supply
      them); Explore photos and distances.
- [ ] **Dooars** — Burra Sahib Suite and Wooden Cottage descriptions to two
      sentences, fittings moved into "In your room"; remove the café from
      Dining, there is none.
- [ ] **Kalimpong** — tagline "Mountain views. A slower pace."; Explore
      distances.
- [ ] **Bayview (Port Blair)** — room sizes for every room type; dining opening
      hours; Explore distances; tagline "Stay by the sea. Explore the
      Andamans."; Premier Family Room's "attached three-fixture toilet" becomes
      "En-suite bath".
- [ ] **Udaipur** — tagline "Palatial stays and memorable celebrations in
      Haldighati."; amenity lists out of room descriptions and into "In your
      room"; Explore distances; "1 dining venue".
- [ ] **Darjeeling** — tagline "Mountain mornings. Darjeeling at your
      doorstep."; gallery intro loses "the pool", there is none; Explore photos
      and distances; "1 event space".
- [ ] **Siliguri** — Explore photos; "1 dining venue".

### D. Decision — room descriptions across every hotel

Room descriptions shorten to two sentences and their fittings move into "In
your room", at every property rather than only Dooars, so every room reads the
same way. Recorded in `PLAN.md`. The rewrite itself is guest-facing copy for
all thirty-nine rooms and is **not** in the A–C pull request.
