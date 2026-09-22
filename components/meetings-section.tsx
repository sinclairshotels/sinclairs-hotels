import { getAmenityIcon } from '@/components/amenity-icon';
import { GalleryLightbox } from '@/components/gallery-lightbox';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';
import type { Hotel } from '@/content/types';
import Link from 'next/link';

export function MeetingsSection({ hotel }: { hotel: Hotel }) {
  const meetings = hotel.meetings;
  const spaces = hotel.eventSpaces;
  if (!meetings || !spaces) return null;

  return (
    <section
      id="meetings"
      className="scroll-mt-32 border-y border-forest/10 bg-white py-10 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Meetings &amp; Events"
            title={`Meetings & Conferences at ${hotel.name}`}
            lede={meetings.intro}
          />
        </Reveal>

        <div className="mt-10 flex flex-wrap items-baseline gap-x-14 gap-y-6 border-y border-forest/10 py-8">
          <Stat
            value={String(spaces.venues.length)}
            label={spaces.venues.length === 1 ? 'Venue' : 'Venues'}
          />
          <Stat value={spaces.totalSqFt.toLocaleString('en-IN')} label="Sq Ft" />
          <Stat value={String(spaces.maxCapacity)} label="Max Guests" />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-2">
          <ul className="grid grid-cols-1 gap-x-8 gap-y-4 self-start sm:grid-cols-2">
            {meetings.highlights.map((highlight) => {
              const Icon = getAmenityIcon(highlight);
              return (
                <li key={highlight} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 stroke-current stroke-[1.6] text-gold" />
                  <span className="text-sm text-ink/80">{highlight}</span>
                </li>
              );
            })}
          </ul>

          <ul className="divide-y divide-forest/10 self-start text-sm">
            {spaces.venues.map((venue) => (
              <li key={venue.name} className="flex items-center justify-between gap-4 py-3">
                <span className="text-ink/80">
                  {venue.name}
                  {venue.kind === 'boardroom' && (
                    <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-forest">
                      Boardroom
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-ink/50">
                  {venue.areaSqFt.toLocaleString('en-IN')} sq ft · {venue.capacity} guests
                </span>
              </li>
            ))}
          </ul>
        </div>

        {meetings.gallery && meetings.gallery.length > 0 && (
          <div className="mt-10">
            <GalleryLightbox images={meetings.gallery} />
          </div>
        )}

        <Link
          href={`/contact?property=${hotel.slug}&type=meetings`}
          className="group mt-10 inline-flex w-fit items-center gap-2 border-b border-gold pb-1 text-sm uppercase tracking-wider text-forest transition hover:text-gold"
        >
          Request a Proposal
          <span aria-hidden="true" className="transition group-hover:translate-x-1">
            &rarr;
          </span>
        </Link>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-3xl text-forest">{value}</p>
      <p className="text-xs uppercase tracking-wider text-ink/50">{label}</p>
    </div>
  );
}
