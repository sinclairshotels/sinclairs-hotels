import { BookingGuestForm } from '@/components/booking-guest-form';
import { getHotelBySlug } from '@/content/hotels';
import { roomOffer } from '@/lib/availability';
import {
  breakfastLine,
  dateKey,
  formatInr,
  formatStayDate,
  nightsBetween,
  parseDateOnly,
  todayInIndia,
} from '@/lib/booking';
import { formatChildAges, parseChildAges } from '@/lib/child-ages';
import { prisma } from '@/lib/db';
import { hotelSlots } from '@/lib/photo-slots';
import { currentOverrides, roomContentWithPhotos, withPhotos } from '@/lib/photos';
import { pageMetadata } from '@/lib/seo';
import { staySchema } from '@/lib/validation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Confirm Your Booking',
  description: 'Review your stay and complete your booking.',
  path: '/book',
  robots: { index: false, follow: false },
});

export default async function ConfirmBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    roomType?: string;
    ratePlan?: string;
    rateType?: string;
    checkIn?: string;
    checkOut?: string;
    rooms?: string;
    adults?: string;
    children?: string;
    childAges?: string;
  }>;
}) {
  const { slug } = await params;
  const contentHotel = getHotelBySlug(slug);
  if (!contentHotel) notFound();

  const overrides = await currentOverrides();
  const hotel = withPhotos(contentHotel, hotelSlots(contentHotel), overrides);

  const query = await searchParams;
  const parsed = staySchema.safeParse({ hotelSlug: slug, ...query });
  const checkIn = parsed.success ? parseDateOnly(parsed.data.checkIn) : null;
  const checkOut = parsed.success ? parseDateOnly(parsed.data.checkOut) : null;

  const searchHref = `/book/${slug}?${new URLSearchParams({
    ...(query.checkIn ? { checkIn: query.checkIn } : {}),
    ...(query.checkOut ? { checkOut: query.checkOut } : {}),
    ...(query.rooms ? { rooms: query.rooms } : {}),
    ...(query.adults ? { adults: query.adults } : {}),
    ...(query.children ? { children: query.children } : {}),
    ...(query.childAges ? { childAges: query.childAges } : {}),
  })}`;

  if (!parsed.success || !query.roomType || !checkIn || !checkOut || checkIn < todayInIndia()) {
    return <Expired hotelName={hotel.name} searchHref={searchHref} />;
  }

  const { rooms, adults, children } = parsed.data;
  const childAges = parseChildAges(parsed.data.childAges, children);

  // Priced again here rather than carried over in the URL: between the
  // availability page and this one the room can sell out or its rate can
  // change, and the guest must see the price they will actually be charged.
  const offer = await roomOffer(prisma, {
    hotelSlug: slug,
    roomTypeId: query.roomType,
    ...(query.ratePlan ? { ratePlanId: query.ratePlan } : {}),
    // Named rather than defaulted: a link that asks for refundable terms must
    // not quietly come back priced as non-refundable, or the guest pays the
    // cheaper price and believes they can cancel.
    rateType: query.rateType === 'REFUNDABLE' ? 'REFUNDABLE' : 'NON_REFUNDABLE',
    checkIn,
    checkOut,
    rooms,
    adults,
    children,
    childAges,
  });

  if (!offer || offer.roomsLeft < rooms) {
    return <Expired hotelName={hotel.name} searchHref={searchHref} />;
  }

  const nights = nightsBetween(checkIn, checkOut);

  return (
    <section className="bg-forest/5 px-6 py-12 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <Link
          href={searchHref}
          className="text-xs uppercase tracking-wider text-forest hover:text-gold-dark"
        >
          &larr; Back to availability
        </Link>
        <h1 className="mt-4 font-display text-3xl text-forest sm:text-4xl">Confirm Your Booking</h1>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="order-2 rounded-xl bg-white p-6 shadow-xl sm:p-8 lg:order-1">
            <h2 className="font-display text-xl text-forest">Guest Details</h2>
            <p className="mt-1 text-sm text-ink/60">
              The booking will be held in this name, and the confirmation sent to this address.
            </p>
            <div className="mt-6">
              <BookingGuestForm
                stay={{
                  hotelSlug: slug,
                  roomTypeId: offer.roomTypeId,
                  ratePlanId: offer.ratePlanId,
                  rateType: offer.rateType,
                  cancellationDeadline: offer.cancellationDeadline,
                  checkIn: dateKey(checkIn),
                  checkOut: dateKey(checkOut),
                  rooms,
                  adults,
                  children,
                  childAges: formatChildAges(childAges),
                }}
              />
            </div>
          </div>

          <aside className="order-1 self-start overflow-hidden rounded-xl bg-white shadow-xl lg:order-2">
            <div className="relative aspect-[4/3]">
              <Image
                src={
                  roomContentWithPhotos(offer.content, hotel)?.images?.[0] ?? hotel.thumbnailImage
                }
                alt={offer.roomTypeName}
                fill
                sizes="(min-width: 1024px) 22rem, 100vw"
                className="object-cover"
              />
            </div>

            <div className="p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-gold-dark">{hotel.location}</p>
              <p className="mt-1 font-display text-lg text-forest">{hotel.name}</p>
              <p className="mt-1 text-sm text-ink/70">{offer.roomTypeName}</p>
              <p className="text-xs uppercase tracking-wider text-gold-dark">
                {offer.ratePlanName}
                {offer.breakfastGuests > 0 && (
                  <span className="mt-0.5 block text-xs normal-case tracking-normal text-ink/60">
                    {breakfastLine(offer.breakfastGuests)}
                  </span>
                )}
              </p>

              <dl className="mt-5 space-y-2 border-t border-ink/10 pt-5 text-sm">
                <Row label="Check in" value={formatStayDate(checkIn)} />
                <Row label="Check out" value={formatStayDate(checkOut)} />
                <Row label="Stay" value={`${nights} ${nights === 1 ? 'night' : 'nights'}`} />
                <Row label="Rooms" value={String(rooms)} />
                <Row
                  label="Guests"
                  value={`${adults} ${adults === 1 ? 'adult' : 'adults'}${
                    children > 0 ? `, ${children} ${children === 1 ? 'child' : 'children'}` : ''
                  }`}
                />
              </dl>

              <dl className="mt-5 space-y-2 border-t border-ink/10 pt-5 text-sm">
                <Row label="Room charges" value={formatInr(offer.quote.roomTotal)} />
                <Row label="Taxes (GST)" value={formatInr(offer.quote.taxTotal)} />
              </dl>

              <div className="mt-5 flex items-baseline justify-between border-t border-ink/10 pt-5">
                <span className="text-xs uppercase tracking-wider text-ink/60">Total payable</span>
                <span className="font-display text-2xl text-forest">
                  {formatInr(offer.quote.total)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink/60">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function Expired({ hotelName, searchHref }: { hotelName: string; searchHref: string }) {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-md rounded-lg border border-forest/20 bg-forest/5 p-8 text-center">
        <p className="font-display text-xl text-forest">That room is no longer held</p>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Availability at {hotelName} has changed since you started. Search again and we&rsquo;ll
          show you what is free now.
        </p>
        <Link
          href={searchHref}
          className="mt-6 inline-block rounded bg-forest px-6 py-2.5 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark"
        >
          Search Again
        </Link>
      </div>
    </section>
  );
}
