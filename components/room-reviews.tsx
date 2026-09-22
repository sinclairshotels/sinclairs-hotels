import { reviews } from '@/content/reviews';

// Two quotes from guests who stayed at this property, shown where a guest is
// choosing a room. Falls back to the group's own reviews for a property with
// none of its own — a real quote about another Sinclairs is worth more than an
// empty panel, and the attribution says which.
export function RoomReviews({ hotelName }: { hotelName: string }) {
  const own = reviews.filter((review) => review.propertyName === hotelName);
  const shown = (
    own.length >= 2 ? own : [...own, ...reviews.filter((r) => !own.includes(r))]
  ).slice(0, 2);
  if (shown.length === 0) return null;

  return (
    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {shown.map((review) => (
        <figure
          key={`${review.author}-${review.quote}`}
          className="rounded-lg border border-forest/10 bg-white p-5 shadow-sm"
        >
          <p className="text-xs text-gold-dark" aria-label={`${review.rating} out of 5`}>
            {'★'.repeat(review.rating)}
          </p>
          <blockquote className="mt-2 text-sm leading-relaxed text-ink/80">
            &ldquo;{review.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-3 text-xs text-ink/50">
            {review.author} · {review.propertyName}
            <br />
            <a
              href={review.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-forest"
            >
              {review.source}
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
