import { foodRatingFor } from '@/content/reviews';

// Shown in a hotel's Dining section where a source publishes a score for the
// food itself. Absent otherwise — an empty space says less than a number
// nobody stands behind.
export function FoodRating({ hotelName }: { hotelName: string }) {
  const rating = foodRatingFor(hotelName);
  if (!rating) return null;

  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-cream/80">
      <span className="text-gold-light" aria-hidden="true">
        {'★'.repeat(Math.round(rating.rating))}
      </span>
      <span className="font-display text-lg text-cream">
        {rating.rating.toFixed(1)}
        <span className="text-cream/60"> / {rating.outOf}</span>
      </span>
      <span className="text-cream/60">
        for food
        {rating.reviewCount ? ` from ${rating.reviewCount.toLocaleString('en-IN')} reviews` : ''} on{' '}
        <a
          href={rating.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-gold-light"
        >
          {rating.source}
        </a>
      </span>
    </p>
  );
}
