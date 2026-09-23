import { BookingRoomTable } from '@/components/booking-room-table';
import { BookingSearchForm } from '@/components/booking-search-form';
import { FunnelStep } from '@/components/funnel-step';
import { RoomReviews } from '@/components/room-reviews';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { directBookingPerk } from '@/content/site';
import { availability } from '@/lib/availability';
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
import { buildRoomTable } from '@/lib/room-table';
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

  // Room first, then plan, then rate — the arrangement a guest reads, rather
  // than the cross product availability returns. lib/room-table.ts owns it so
  // it can be tested without rendering a table.
  const table = buildRoomTable(bookable, result?.blocked ?? [], rooms);

  // "Nothing free on these dates" and "we don't sell this property online yet"
  // look identical from an empty result but need completely different copy.
  const ratesLoaded =
    offers.length > 0 ||
    (await prisma.ratePrice.count({ where: { hotelSlug: slug, date: { gte: today } } })) > 0;

  return (
    <>
      <FunnelStep step="room_view" hotel={hotel.slug} />
      {/* A slim band, not a hero. This is the results page: a 34vh
          photograph pushed the room table below the fold on every laptop, and
          a guest who has already chosen the property is here to compare rooms
          rather than to be sold the view again. The full hero stays on
          /book, where a property is still being chosen. */}
      <section className="bg-forest-dark">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-3 px-6 py-4">
          <h1 className="font-display text-xl text-cream sm:text-2xl">{hotel.name}</h1>
          <p className="text-xs uppercase tracking-[0.25em] text-cream/70">{hotel.location}</p>
        </div>
      </section>

      <section className="border-b border-forest/10 bg-cream px-6 py-3">
        <div className="mx-auto max-w-6xl">
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

      <section className="px-6 py-8">
        <div className="mx-auto max-w-6xl">
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

          {result?.nonRefundableOnly && table.rooms.length > 0 && (
            <p className="mt-6 rounded border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-ink/75">
              These dates are sold on non-refundable terms only
              {result.nonRefundableOnly.label ? ` (${result.nonRefundableOnly.label})` : ''}, so the
              refundable rate is not offered for this stay.
            </p>
          )}

          <BookingRoomTable
            rooms={table.rooms}
            unavailable={table.unavailable}
            planCodes={table.planCodes}
            stay={{
              slug,
              checkIn: dateKey(checkIn as Date),
              checkOut: dateKey(checkOut as Date),
              rooms,
              adults,
              children,
            }}
          />

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
