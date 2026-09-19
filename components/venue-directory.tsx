import type { HotelVenues } from '@/lib/venues';
import Link from 'next/link';

// Every venue at every property in one place. A wedding planner comparing
// properties otherwise has to open nine hotel pages to find the one room that
// seats their guest list.
export function VenueDirectory({ groups }: { groups: HotelVenues[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {groups.map(({ hotel, venues }) => (
        <div
          key={hotel.slug}
          className="flex flex-col rounded-lg border border-forest/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
        >
          <p className="font-display text-lg text-forest">{hotel.name}</p>
          <p className="mt-0.5 text-xs uppercase tracking-wider text-ink/50">
            {hotel.location}, {hotel.state}
          </p>

          <ul className="mt-4 flex-1 divide-y divide-forest/10 text-sm">
            {venues.map((venue) => (
              <li key={venue.name} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="text-ink/80">
                  {venue.name}
                  {venue.kind === 'boardroom' && (
                    <span className="ml-2 text-[0.65rem] uppercase tracking-wider text-ink/40">
                      Boardroom
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-ink/50">
                  {venue.areaSqFt.toLocaleString('en-IN')} sq ft · {venue.capacity} guests
                </span>
              </li>
            ))}
          </ul>

          <Link
            href={`/hotels/${hotel.slug}#meetings`}
            className="mt-5 inline-flex w-fit items-center gap-2 border-b border-gold pb-1 text-xs uppercase tracking-wider text-forest transition hover:text-gold"
          >
            See the property
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      ))}
    </div>
  );
}
