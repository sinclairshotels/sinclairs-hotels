import { BookingSearchForm } from '@/components/booking-search-form';
import { FunnelStep } from '@/components/funnel-step';
import { RoomReviews } from '@/components/room-reviews';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { directBookingPerk } from '@/content/site';
import { type RoomOffer, availability } from '@/lib/availability';
import {
  MAX_BOOKING_HORIZON_DAYS,
  MAX_NIGHTS,
  addDays,
  breakfastLine,
  dateKey,
  formatInr,
  formatStayDate,
  nightsBetween,
  parseDateOnly,
  todayInIndia,
} from '@/lib/booking';
import { rateTypeLabel } from '@/lib/cancellation';
import { prisma } from '@/lib/db';
import { hotelSlots } from '@/lib/photo-slots';
import { currentOverrides, roomContentWithPhotos, withPhotos } from '@/lib/photos';
import { formatRoomSize } from '@/lib/room-size';
import { pageMetadata } from '@/lib/seo';
import { staySchema } from '@/lib/validation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// Availability changes with every booking taken, so this can never be cached.
export const dynamic = 'force-dynamic';

// A room with nine left saying so is noise; three or fewer is the number a
// guest actually weighs against booking now.
const SCARCITY_THRESHOLD = 3;

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const hotel = getHotelBySlug((await params).slug);
  if (!hotel) return {};
  return pageMetadata({
    title: `Book ${hotel.name}`,
    description: `Check availability and rates at ${hotel.name}, ${hotel.location}.`,
    path: `/book/${hotel.slug}`,
    // A live availability result is not a page for Google to hold — the
    // hotel's own page is the indexable one.
    robots: { index: false, follow: true },
  });
}

type SearchParams = {
  checkIn?: string;
  checkOut?: string;
  rooms?: string;
  adults?: string;
  children?: string;
};

export default async function BookHotelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const contentHotel = getHotelBySlug(slug);
  if (!contentHotel) notFound();

  // Photos staff replaced have to reach this page too, or a property's hero
  // changes on /hotels/<slug> and not on the page where the room is sold.
  const overrides = await currentOverrides();
  const hotel = withPhotos(contentHotel, hotelSlots(contentHotel), overrides);

  const query = await searchParams;
  const parsed = staySchema.safeParse({ hotelSlug: slug, ...query });
  const today = todayInIndia();

  const checkIn = parsed.success ? parseDateOnly(parsed.data.checkIn) : null;
  const checkOut = parsed.success ? parseDateOnly(parsed.data.checkOut) : null;
  const rooms = parsed.success ? parsed.data.rooms : 1;
  const adults = parsed.success ? parsed.data.adults : 2;
  const children = parsed.success ? parsed.data.children : 0;

  const stayError = validateStay(checkIn, checkOut, today);
  const result =
    checkIn && checkOut && !stayError
      ? await availability(prisma, { hotelSlug: slug, checkIn, checkOut, rooms, adults, children })
      : null;
  const offers = result?.offers ?? [];
  const bookable = offers.filter((offer) => offer.roomsLeft >= rooms);

  // One card per room and meal plan, carrying both sets of cancellation terms.
  // Availability returns them as separate offers because they are separately
  // priced and separately bookable; showing them as separate cards would list
  // the same room twice and make the cheaper one look like a different room.
  const grouped = Array.from(
    bookable
      .reduce((acc, offer) => {
        const key = `${offer.roomTypeId}:${offer.ratePlanId}`;
        const existing = acc.get(key);
        if (existing) existing.alternatives.push(offer);
        else acc.set(key, { offer, alternatives: [offer] });
        return acc;
      }, new Map<string, { offer: RoomOffer; alternatives: RoomOffer[] }>())
      .values(),
  ).map((group) => ({
    ...group,
    // Cheapest first, so the headline "from" price is the one being shown.
    alternatives: [...group.alternatives].sort((a, b) => a.quote.total - b.quote.total),
  }));

  // "Nothing free on these dates" and "we don't sell this property online yet"
  // look identical from an empty result but need completely different copy.
  const ratesLoaded =
    offers.length > 0 ||
    (await prisma.ratePrice.count({ where: { hotelSlug: slug, date: { gte: today } } })) > 0;

  return (
    <>
      <FunnelStep step="room_view" hotel={hotel.slug} />
      <section className="relative h-[34vh] min-h-[260px] overflow-hidden">
        <div className="absolute inset-0 animate-hero-zoom">
          <Image
            src={hotel.heroImage}
            alt={hotel.name}
            fill
            priority
            sizes="100vw"
            quality={90}
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/95 via-forest-dark/50 to-forest-dark/15" />
        <div className="absolute inset-x-0 bottom-0 animate-fade-up px-6 pb-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-cream drop-shadow-md">
            {hotel.location}
          </p>
          <h1 className="mt-3 font-display text-3xl text-cream drop-shadow-md sm:text-4xl">
            {hotel.name}
          </h1>
        </div>
      </section>

      {/* relative + z-10: the hero above is positioned, so it paints over a
          statically-positioned sibling and slices the top off this card. */}
      <section className="relative z-10 px-6">
        <div className="mx-auto -mt-8 max-w-5xl rounded-xl bg-white p-5 shadow-2xl sm:p-6">
          <BookingSearchForm
            hotels={hotels}
            defaultHotel={slug}
            defaultCheckIn={checkIn ? dateKey(checkIn) : undefined}
            defaultCheckOut={checkOut ? dateKey(checkOut) : undefined}
            defaultRooms={rooms}
            defaultAdults={adults}
            defaultChildren={children}
            compact
          />
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-5xl">
          {checkIn && checkOut && !stayError && (
            <p className="text-sm text-ink/60">
              {formatStayDate(checkIn)} &ndash; {formatStayDate(checkOut)} &middot;{' '}
              {nightsBetween(checkIn, checkOut)}{' '}
              {nightsBetween(checkIn, checkOut) === 1 ? 'night' : 'nights'} &middot; {rooms}{' '}
              {rooms === 1 ? 'room' : 'rooms'}
            </p>
          )}

          {stayError && <Notice title="Check your dates">{stayError}</Notice>}

          {!stayError && !ratesLoaded && (
            <Notice title="Not yet bookable online">
              Direct booking isn&rsquo;t open for {hotel.name} yet. Send us your dates and our
              reservations team will confirm by return.
            </Notice>
          )}

          {!stayError && ratesLoaded && bookable.length === 0 && (
            <Notice title="No rooms available">
              We have nothing free for {rooms} {rooms === 1 ? 'room' : 'rooms'} across those nights.
              Try shorter dates or fewer rooms &mdash; or send us an enquiry and we will look for
              you.
            </Notice>
          )}

          {result?.nonRefundableOnly && grouped.length > 0 && (
            <p className="mt-6 rounded border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-ink/75">
              These dates are sold on non-refundable terms only
              {result.nonRefundableOnly.label ? ` (${result.nonRefundableOnly.label})` : ''}, so the
              refundable rate is not offered for this stay.
            </p>
          )}

          <div className="mt-8 space-y-6">
            {grouped.map(({ offer, alternatives }) => {
              const perNight = Math.round(offer.quote.roomTotal / offer.quote.nights / rooms);
              const hrefFor = (choice: typeof offer) =>
                `/book/${slug}/confirm?${new URLSearchParams({
                  roomType: choice.roomTypeId,
                  ratePlan: choice.ratePlanId,
                  rateType: choice.rateType,
                  checkIn: dateKey(checkIn as Date),
                  checkOut: dateKey(checkOut as Date),
                  rooms: String(rooms),
                  adults: String(adults),
                  children: String(children),
                })}`;

              return (
                <article
                  key={`${offer.roomTypeId}:${offer.ratePlanId}`}
                  className="grid grid-cols-1 overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-lg sm:grid-cols-[minmax(0,14rem)_1fr]"
                >
                  <div className="relative aspect-[4/3] sm:aspect-auto">
                    <Image
                      src={
                        roomContentWithPhotos(offer.content, hotel)?.images?.[0] ??
                        hotel.thumbnailImage
                      }
                      alt={offer.roomTypeName}
                      fill
                      sizes="(min-width: 640px) 14rem, 100vw"
                      className="object-cover"
                    />
                  </div>

                  <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-xl text-forest">{offer.roomTypeName}</h2>
                      <p className="text-xs uppercase tracking-wider text-gold-dark">
                        {offer.ratePlanName}
                        {formatRoomSize(offer.sizeSqFt) ? (
                          <span className="normal-case tracking-wide text-ink/50">
                            {' · '}
                            {formatRoomSize(offer.sizeSqFt)}
                          </span>
                        ) : null}
                      </p>
                      {offer.breakfastGuests > 0 && (
                        <p className="mt-0.5 text-xs text-ink/60">
                          {breakfastLine(offer.breakfastGuests)}
                        </p>
                      )}
                      {offer.quote.extrasTotal > 0 && (
                        <p className="mt-0.5 text-xs text-ink/60">
                          Includes{' '}
                          {[
                            offer.quote.extraAdults > 0 &&
                              `${offer.quote.extraAdults} extra adult${offer.quote.extraAdults === 1 ? '' : 's'}`,
                            offer.quote.extraChildren > 0 &&
                              `${offer.quote.extraChildren} extra child${offer.quote.extraChildren === 1 ? '' : 'ren'}`,
                          ]
                            .filter(Boolean)
                            .join(' and ')}{' '}
                          at {formatInr(offer.quote.extrasTotal)}
                        </p>
                      )}
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/70">
                        {offer.content?.description}
                      </p>
                      {/* Only worth saying when it is nearly true. A room with
                          nine left saying so is noise; three or fewer is the
                          number a guest actually weighs. */}
                      {offer.roomsLeft <= SCARCITY_THRESHOLD && (
                        <p className="mt-3 text-xs uppercase tracking-wider text-gold-dark">
                          {offer.roomsLeft} left at this price
                        </p>
                      )}
                    </div>

                    {/* Both sets of terms, priced, side by side — the choice
                        is only meaningful when the cost of it is visible next
                        to the date it buys. Where the dates are sold on
                        non-refundable terms only there is one card, and the
                        note above the list says why rather than leaving the
                        property looking like one that has no refundable rate. */}
                    <div className="shrink-0 space-y-3 sm:w-64">
                      <p className="text-xs uppercase tracking-wider text-ink/50">
                        From {formatInr(perNight)} per room / night
                      </p>
                      {alternatives.map((choice) => (
                        <div
                          key={choice.rateType}
                          className="rounded border border-ink/10 p-3 text-right"
                        >
                          <p className="text-xs font-medium uppercase tracking-wider text-forest">
                            {rateTypeLabel(choice.rateType)}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-ink/60">
                            {choice.rateType === 'REFUNDABLE' && choice.cancellationDeadline
                              ? `Free cancellation until ${formatStayDate(choice.cancellationDeadline)}`
                              : 'No refund if cancelled'}
                          </p>
                          <p className="mt-2 font-display text-xl text-forest">
                            {formatInr(choice.quote.total)}
                          </p>
                          <p className="text-[11px] text-ink/50">
                            total, including {formatInr(choice.quote.taxTotal)} GST
                          </p>
                          <Link
                            href={hrefFor(choice)}
                            className="mt-3 inline-block rounded bg-gold px-5 py-2 text-xs uppercase tracking-wider text-forest-dark transition hover:bg-gold-light"
                          >
                            Select
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <RoomReviews hotelName={hotel.name} />

          <p className="mt-8 text-center text-xs text-ink/60">
            {directBookingPerk.long} Each room is offered on both terms: the non-refundable rate is
            cheaper and keeps nothing back, the refundable rate costs more and can be cancelled in
            full up to the date shown.
          </p>

          <p className="mt-6 text-center text-sm text-ink/60">
            Prefer to talk it through?{' '}
            <Link
              href={`/contact?property=${slug}&type=HOTEL`}
              className="text-forest underline underline-offset-4 hover:text-gold-dark"
            >
              Send an enquiry
            </Link>{' '}
            and our reservations team will come back to you.
          </p>
        </div>
      </section>
    </>
  );
}

function validateStay(checkIn: Date | null, checkOut: Date | null, today: Date): string | null {
  if (!checkIn || !checkOut) return 'Please choose your check-in and check-out dates.';
  if (checkIn < today) return 'Check-in cannot be in the past.';
  if (checkOut <= checkIn) return 'Check-out must be at least one night after check-in.';
  if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS)
    return `Stays longer than ${MAX_NIGHTS} nights are arranged by our reservations team — please send an enquiry.`;
  if (checkIn > addDays(today, MAX_BOOKING_HORIZON_DAYS))
    return 'We are not taking bookings that far ahead yet.';
  return null;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-forest/20 bg-forest/5 p-8 text-center">
      <p className="font-display text-xl text-forest">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/70">{children}</p>
    </div>
  );
}
