import type { Hotel } from '@/content/types';
import { formatInr } from '@/lib/booking';
import Image from 'next/image';
import Link from 'next/link';

// HotelCard's sibling for /book: same photography card, but it leads to the
// booking flow rather than the marketing page and carries an entry price. A
// property with nothing loaded is not a dead end — it sends the guest to the
// enquiry form, which is how those properties are sold today.
export function BookHotelCard({ hotel, fromPrice }: { hotel: Hotel; fromPrice?: number }) {
  const bookable = fromPrice !== undefined;

  return (
    <Link
      href={bookable ? `/book/${hotel.slug}` : `/contact?property=${hotel.slug}`}
      className="group relative block aspect-[4/3.4] overflow-hidden rounded-xl shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
    >
      <Image
        src={hotel.thumbnailImage}
        alt={hotel.name}
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="transform-gpu object-cover transition duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-black/75 via-35% to-transparent to-70%" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
        <h3 className="font-display text-lg leading-snug">{hotel.name}</h3>
        <p className="mt-0.5 text-xs text-cream/70">
          {hotel.location}, {hotel.state}
        </p>
        {bookable ? (
          <p className="mt-3 text-sm text-gold-light">
            <span className="text-cream/70">from </span>
            {formatInr(fromPrice)}
            <span className="text-cream/70"> per night</span>
          </p>
        ) : (
          <p className="mt-3 text-sm uppercase tracking-wider text-gold-light">Enquire</p>
        )}
      </div>
    </Link>
  );
}
