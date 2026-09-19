import type { HotelDiningPhoto } from '@/lib/dining';
import Image from 'next/image';
import Link from 'next/link';

// One photo per property, each a door into that hotel's own dining section.
// There is no separate dining page to tell a story on: the venues, the hours
// and the menus all live on the hotel that serves them.
export function DiningShowcase({ entries }: { entries: HotelDiningPhoto[] }) {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(({ hotel, photo, venueNames }) => (
        <li key={hotel.slug}>
          <Link
            href={`/hotels/${hotel.slug}#dining`}
            className="group relative block aspect-[4/3] overflow-hidden rounded-lg shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="transform-gpu object-cover transition duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/90 via-forest-dark/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
              <p className="font-display text-lg leading-snug">{hotel.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-cream/75">{venueNames.join(' · ')}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
