import { formatInr, formatStayDate } from '@/lib/booking';
import { rateTypeLabel } from '@/lib/cancellation';
import { formatRoomSize } from '@/lib/room-size';
import { roomSummary } from '@/lib/room-summary';
import type { BookingRateType } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';

export interface RoomChoice {
  rateType: BookingRateType;
  cancellationDeadline: Date | null;
  total: number;
  taxTotal: number;
  href: string;
}

// Compact on purpose: nine rooms at a property used to be nine full-width
// blocks with a paragraph each, so choosing between them meant scrolling and
// remembering. The card states the handful of things a guest actually compares
// — size, who it sleeps, the view, the bed, a few amenities — and keeps the
// description behind Details.
//
// <details> rather than React state: it expands without JavaScript, keeps this
// a server component, and is what a disclosure already is in HTML.
export function BookingRoomCard({
  name,
  planName,
  description,
  image,
  alt,
  sizeSqFt,
  baseOccupancy,
  view,
  bedType,
  amenities = [],
  breakfastLine,
  extrasLine,
  roomsLeft,
  perNight,
  choices,
}: {
  name: string;
  // Room Only or With Breakfast. Without it two cards for the same room read
  // as the same room at two prices for no stated reason.
  planName: string;
  description?: string;
  image: string;
  alt: string;
  sizeSqFt: number | null;
  baseOccupancy: number;
  view?: string;
  bedType?: string;
  amenities?: string[];
  breakfastLine?: string;
  extrasLine?: string;
  // Only worth saying when it is nearly true; the page decides that.
  roomsLeft?: number;
  perNight: number;
  choices: RoomChoice[];
}) {
  const bullets = [
    formatRoomSize(sizeSqFt),
    `Sleeps ${baseOccupancy}`,
    view,
    bedType,
    ...amenities.slice(0, 4),
  ].filter((bullet): bullet is string => Boolean(bullet));

  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-lg">
      <div className="flex gap-4 p-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-28">
          <Image src={image} alt={alt} fill sizes="7rem" className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-tight text-forest">{name}</h2>
          <p className="text-xs uppercase tracking-wider text-gold-dark">{planName}</p>
          {description && (
            <p className="mt-1 text-sm leading-snug text-ink/65">{roomSummary(description)}</p>
          )}

          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink/70">
            {bullets.map((bullet) => (
              <li key={bullet} className="before:mr-1.5 before:text-gold before:content-['•']">
                {bullet}
              </li>
            ))}
          </ul>

          {(breakfastLine || extrasLine) && (
            <p className="mt-1.5 text-xs text-ink/55">
              {[breakfastLine, extrasLine].filter(Boolean).join(' · ')}
            </p>
          )}

          {description && (
            <details className="group mt-2">
              <summary className="cursor-pointer list-none text-xs uppercase tracking-wider text-forest marker:hidden">
                Details <span className="group-open:hidden">&rarr;</span>
                <span className="hidden group-open:inline">&darr;</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{description}</p>
            </details>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-ink/5 px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-ink/50">
          From {formatInr(perNight)} per room / night
        </p>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {choices.map((choice) => (
            <div key={choice.rateType} className="rounded border border-ink/10 p-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-forest">
                {rateTypeLabel(choice.rateType)}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink/60">
                {choice.rateType === 'REFUNDABLE' && choice.cancellationDeadline
                  ? `Free until ${formatStayDate(choice.cancellationDeadline)}`
                  : 'No refund if cancelled'}
              </p>
              <p className="mt-1.5 font-display text-lg text-forest">{formatInr(choice.total)}</p>
              <p className="text-[11px] text-ink/50">incl. {formatInr(choice.taxTotal)} GST</p>
              <Link
                href={choice.href}
                className="mt-2 block rounded bg-gold py-1.5 text-center text-xs uppercase tracking-wider text-forest-dark transition hover:bg-gold-light"
              >
                Select
              </Link>
            </div>
          ))}
        </div>

        {roomsLeft !== undefined && (
          <p className="mt-2 text-xs uppercase tracking-wider text-gold-dark">
            {roomsLeft} left at this price
          </p>
        )}
      </div>
    </article>
  );
}
