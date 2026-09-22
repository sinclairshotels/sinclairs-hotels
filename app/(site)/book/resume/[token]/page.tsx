import { getHotelBySlug } from '@/content/hotels';
import { roomOffers } from '@/lib/availability';
import { dateKey, formatStayDate } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Finish Your Booking',
  description: 'Pick up the booking you started.',
  path: '/book/resume',
  robots: { index: false, follow: false },
});

// Where the recovery email lands. The old booking holds nothing — its hold let
// go an hour before the email went out — so this re-checks the room is still
// free before sending the guest back to the confirm page. Telling them it is
// waiting and then failing at payment would be worse than saying so here.
export default async function ResumeBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const booking = await prisma.booking.findUnique({
    where: { viewToken: token },
    select: {
      status: true,
      hotelSlug: true,
      roomTypeId: true,
      checkIn: true,
      checkOut: true,
      rooms: true,
      adults: true,
      children: true,
      viewToken: true,
    },
  });
  if (!booking) notFound();

  const hotel = getHotelBySlug(booking.hotelSlug);
  if (!hotel) notFound();

  // Paid in the meantime — or cancelled. Either way the guest wants the
  // booking itself, not a second attempt at it.
  if (booking.status !== 'PENDING_PAYMENT') {
    redirect(`/booking/${booking.viewToken}`);
  }

  const stay = {
    hotelSlug: booking.hotelSlug,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    rooms: booking.rooms,
    adults: booking.adults,
    children: booking.children,
  };

  const offers = await roomOffers(prisma, stay);
  const stillThere = offers.find(
    (offer) => offer.roomTypeId === booking.roomTypeId && offer.roomsLeft >= booking.rooms,
  );

  const search = new URLSearchParams({
    checkIn: dateKey(booking.checkIn),
    checkOut: dateKey(booking.checkOut),
    rooms: String(booking.rooms),
    adults: String(booking.adults),
    children: String(booking.children),
  });

  if (stillThere) {
    redirect(
      `/book/${booking.hotelSlug}/confirm?${search}&roomTypeId=${stillThere.roomTypeId}&ratePlanId=${stillThere.ratePlanId}`,
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">Your booking</p>
      <h1 className="mt-3 font-display text-3xl text-forest">That room has gone</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink/70">
        {hotel.name} no longer has {booking.rooms === 1 ? 'that room' : 'those rooms'} free for{' '}
        {formatStayDate(booking.checkIn)} – {formatStayDate(booking.checkOut)}. Nothing was charged.
        Other rooms may still be available for the same dates.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/book/${booking.hotelSlug}?${search}`}
          className="rounded bg-forest px-6 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark"
        >
          See what is available
        </Link>
        <Link
          href={`/contact?property=${booking.hotelSlug}&type=hotel`}
          className="rounded border border-forest px-6 py-3 text-sm uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream"
        >
          Send an enquiry
        </Link>
      </div>
    </section>
  );
}
