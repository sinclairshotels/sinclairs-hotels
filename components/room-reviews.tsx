import { reviews } from '@/content/reviews';

// Two quotes from guests who stayed at *this* property, and nobody else's.
//
// It used to pad a property with fewer than two of its own by borrowing other
// hotels' quotes, on the reasoning that a real quote about another Sinclairs
// beat an empty panel. It does not: a guest reading about Bayview is being
// shown somebody's praise of Darjeeling, under a heading about Bayview, while
// deciding whether to book Bayview. The attribution line named the other
// property, which makes it honest but no less misleading at a glance. A
// property with no quotes now shows none.
export function RoomReviews({ hotelName }: { hotelName: string }) {
  const shown = reviews.filter((review) => review.propertyName === hotelName).slice(0, 2);
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
