'use client';

import { hotelItem, pushEcommerceEvent } from '@/lib/analytics';
import Link from 'next/link';
import type { ReactNode } from 'react';

// Every "Book Now" / "Check Availability" CTA across the site sends guests
// into our own booking engine — centralizing the click here means the
// begin_checkout event and its shape stay consistent regardless of how each
// page styles or labels its own CTA (design/copy is entirely the caller's).
// This is the start of a checkout we own end to end, so begin_checkout is now
// comparable against purchase as well as view_item.
// `params.hotel` doubles as the destination: a CTA that knows its property
// goes straight to that property's search, and one that does not (the global
// nav) lands on /book to choose. `params.room` comes along in the query, so
// Book Now on a room arrives with that room chosen rather than dropping the
// guest at the top of a list they have already read. `item` is optional for the same reason; the
// hotel content is never imported here so it stays out of the client bundle
// on every page that renders the nav.
export function ReservationLink({
  ctaSource,
  params,
  item,
  className,
  children,
}: {
  ctaSource: string;
  params?: Record<string, string>;
  item?: { slug: string; name: string; variant?: string };
  className?: string;
  children: ReactNode;
}) {
  const hotelSlug = params?.hotel;
  const room = params?.room;
  const href = hotelSlug
    ? `/book/${hotelSlug}${room ? `?room=${encodeURIComponent(room)}` : ''}`
    : '/book';

  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        pushEcommerceEvent(
          'begin_checkout',
          {
            items: item
              ? [
                  hotelItem(
                    item.slug,
                    item.name,
                    item.variant ? { item_variant: item.variant } : {},
                  ),
                ]
              : [],
          },
          { cta_source: ctaSource, ...params },
        )
      }
    >
      {children}
    </Link>
  );
}
