# Rate card draft

Three sheets that fill the Set-up page (`/admin/rates/monthly`) for all nine
properties, and `scripts/load-rate-card.ts`, which reads them.

```bash
pnpm load:rates            # preview - reads nothing into the database
pnpm load:rates --write    # apply
```

**Nothing here is a source of truth.** Rates and allotment are staff data and
live in Postgres; these files exist only to fill an empty database once, so the
work starts from a sheet to correct rather than 468 empty boxes. After the first
load, the Set-up page is where rates change — re-running this would undo that,
so it refuses to overwrite anything already loaded unless asked.

## The three sheets

| File | Grain | Holds |
|---|---|---|
| `hotels.csv` | property | breakfast supplement |
| `rooms.csv` | room type | base Room Only rate, allotment, occupancy, extra-guest charges |
| `seasons.csv` | property × calendar month | the factor applied to every base rate |

`rate = round(baseRate × factor)` to the nearest ₹50, for each of the next
twelve months. Months are calendar months rather than dated ones so the sheet
does not go stale.

Only **Room Only (EP)** prices are written. With Breakfast is derived at pricing
time from the supplement (`lib/availability.ts`), and MAP/AP are not sellable
through the guest flow at all — rows for either would be data nothing reads.

## Where the numbers came from, and how far to trust them

Every rate is **DRAFT**, derived from public OTA listings observed on
**22 September 2026**. Three things to hold in mind before loading them:

- **They are OTA sell prices**, after commission and after whatever promotion
  ran that day. Setting direct rates *from* them inverts the "why book direct"
  promise the home page makes — direct should be at or below the OTA price, so
  these are a ceiling to work down from, not a rate card.
- **Some are per person, some are converted currency.** Kalimpong appeared as
  "₹1,800 per person"; Port Blair as "₹3,200 per person". Darjeeling, Siliguri
  and Udaipur were quoted in USD, EUR or ZAR.
- **One is internally inconsistent.** Gangtok showed "₹4,769 + ₹257 taxes";
  18% GST on ₹4,769 is ₹858, so that pair cannot both be right.

| Property | Public evidence | Lead-in room drafted at | Confidence |
|---|---|---|---|
| Port Blair | ₹7,000–₹15,000; $91–$169; "₹3,200 pp" | ₹7,000 | medium |
| Dooars | ₹4,743 low; May ₹5,123–6,019 | ₹5,100 | medium — the only per-month figure found |
| Gangtok | ₹4,769; $59–$86 | ₹4,750 | medium |
| Darjeeling | ~$52, from $44 | ₹4,600 | medium |
| Burdwan | ₹4,050; ₹4,900; $56 | ₹4,500 | medium |
| Ooty | avg ₹4,977, deals ₹3,237 | ₹4,300 | medium |
| Siliguri | avg $41, low $33; €76 incl tax | ₹3,600 | low |
| Kalimpong | Premier from $73 (≈₹6,400) vs "₹1,800 pp" (≈₹3,600) | ₹4,800 | low — sources disagree ~2× |
| Udaipur | $19–$36; $33; €28.97; $77 | ₹2,900 | **lowest — a 4.1× spread** |

Rooms above the lead-in are a ladder off it (next tier ×1.2, view rooms ×1.35,
suites ×1.6, cottages and villas ×1.85), because no source prices individual
room categories. Those ratios are a shape, not evidence.

**Extra-guest charges**: only Darjeeling has sourced figures — ₹2,200 extra bed,
₹2,000 per child. Everything else carries a flat ₹1,500 / ₹1,000 draft.

**Breakfast supplement**: no public source. ₹450 per person per night is a
placeholder.

## Allotment is deliberately blank

`roomsOnSale` ships as `?` on every row. Nothing outside the business can know
how many rooms a property will release to the website, and a guessed number is
how a property gets oversold — a real guest arriving to no room.

The loader prices those rooms and loads **no inventory** for them. They appear
on the Set-up page with their rates and are not sellable, which is the existing
"not yet bookable online" behaviour rather than a new state. Fill the column in
and re-run to put them on sale.

## Sources

- [Booking.com — Sinclairs Darjeeling](https://www.booking.com/hotel/in/sinclairs-darjeeling.html)
- [KAYAK — Sinclairs Darjeeling](https://www.kayak.com/Darjeeling-Hotels-Sinclairs-Darjeeling.102814.ksp)
- [MakeMyTrip — Sinclairs Gangtok rooms](https://www.makemytrip.com/hotels/rooms-in-sinclairs_gangtok-details-gangtok.html)
- [Adani One — Sinclairs Gangtok](https://www.adanione.com/india-hotels/sinclairs-gangtok-sungava-gangtok-3919341)
- [KAYAK — Sinclairs Bayview Port Blair](https://www.kayak.com/Port-Blair-Hotels-Sinclairs-Bayview-Port-Blair.351291.ksp)
- [Cleartrip — Sinclairs Bayview](https://www.cleartrip.com/hotels/details/sinclairs-bayview-47815)
- [KAYAK — Sinclairs Retreat Kalimpong](https://www.kayak.com/Kalimpong-Hotels-Sinclairs-Retreat-Kalimpong.2241853.ksp)
- [momondo — Sinclairs Retreat Dooars](https://www.momondo.com/hotels/chalsa/Sinclairs-Retreat-Dooars-Chalsa.mhd375387.ksp)
- [KAYAK — Sinclairs Retreat Dooars](https://www.kayak.com/Chalsa-Hotels-Sinclairs-Retreat-Dooars.375387.ksp)
- [momondo — Sinclairs Retreat Ooty](https://www.momondo.in/hotels/ooty/Sinclairs-Retreat-Ooty.mhd167596.ksp)
- [travelguru — Sinclairs Burdwan](https://www.travelguru.com/hotels/hotels-in-burdwan/sinclairs-tourist-resort-burdwan)
- [readytotrip — Sinclairs Burdwan](https://www.readytotrip.com/hotels/India/West%20Bengal/Barddham%C4%81n/sinclairs-tourist-resort-burdwan/)
- [Travelocity — Sinclairs Siliguri](https://www.travelocity.com/Siliguri-Hotels-Sinclairs-Siliguri.h2933525.Hotel-Information)
- [Destinia — Sinclairs Udaipur](https://destinia.com/en/hotels/asia/india/rajasthan/udaipur/sinclairs-udaipur/ho-5644379)
- [Trip.com — Sinclairs Udaipur](https://us.trip.com/hotels/udaipur-hotel-detail-122389370/sinclairs-udaipur/)

`sinclairshotels.com` and `makemytrip.com` are blocked by this environment's
egress proxy, so the official tariff pages could not be read directly — worth a
pass by someone who can open them.
