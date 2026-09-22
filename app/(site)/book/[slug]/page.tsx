import { BookingSearchForm } from '@/components/booking-search-form';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { roomOffers } from '@/lib/availability';
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
  todayUtc,
} from '@/lib/booking';
import { prisma } from '@/lib/db';
import { pageMetadata } from '@/lib/seo';
import { staySchema } from '@/lib/validation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// Availability changes with every booking taken, so this can never be cached.
export const dynamic = 'force-dynamic';

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
  const hotel = getHotelBySlug(slug);
  if (!hotel) notFound();

  const query = await searchParams;
  const parsed = staySchema.safeParse({ hotelSlug: slug, ...query });
  const today = todayUtc();

  const checkIn = parsed.success ? parseDateOnly(parsed.data.checkIn) : null;
  const checkOut = parsed.success ? parseDateOnly(parsed.data.checkOut) : null;
  const rooms = parsed.success ? parsed.data.rooms : 1;
  const adults = parsed.success ? parsed.data.adults : 2;
  const children = parsed.success ? parsed.data.children : 0;

  const stayError = validateStay(checkIn, checkOut, today);
  const offers =
    checkIn && checkOut && !stayError
      ? await roomOffers(prisma, { hotelSlug: slug, checkIn, checkOut, rooms, adults, children })
      : [];
  const bookable = offers.filter((offer) => offer.roomsLeft >= rooms);

  // "Nothing free on these dates" and "we don't sell this property online yet"
  // look identical from an empty result but need completely different copy.
  const ratesLoaded =
    offers.length > 0 ||
    (await prisma.ratePrice.count({ where: { hotelSlug: slug, date: { gte: today } } })) > 0;

  return (
    <>
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

          <div className="mt-8 space-y-6">
            {bookable.map((offer) => {
              const perNight = Math.round(offer.quote.roomTotal / offer.quote.nights / rooms);
              const confirmHref = `/book/${slug}/confirm?${new URLSearchParams({
                roomType: offer.roomTypeId,
                ratePlan: offer.ratePlanId,
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
                      src={offer.content?.images?.[0] ?? hotel.thumbnailImage}
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
                      {offer.roomsLeft <= 3 && (
                        <p className="mt-3 text-xs uppercase tracking-wider text-gold-dark">
                          Only {offer.roomsLeft} left
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs uppercase tracking-wider text-ink/50">From</p>
                      <p className="font-display text-2xl text-forest">{formatInr(perNight)}</p>
                      <p className="text-xs text-ink/50">per room / night</p>
                      <p className="mt-2 text-sm text-ink/70">
                        {formatInr(offer.quote.total)} total
                      </p>
                      <p className="text-xs text-ink/50">incl. taxes</p>
                      <Link
                        href={confirmHref}
                        className="mt-4 inline-block rounded bg-gold px-6 py-2.5 text-xs uppercase tracking-wider text-forest-dark transition hover:bg-gold-light"
                      >
                        Select
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs text-ink/60">
            All rates are non-refundable. A booking cannot be cancelled or refunded once payment
            clears.
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
