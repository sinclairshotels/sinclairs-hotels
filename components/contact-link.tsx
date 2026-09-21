'use client';

import { pushDataLayerEvent } from '@/lib/analytics';
import type { ReactNode } from 'react';

// A phone call is a real conversion path for a hotel — a guest who calls the
// property never touches the enquiry form, so without this those bookings look
// like traffic that did nothing. Wraps tel: links so every one reports the same
// way regardless of where it sits. Email is deliberately not a method here: no
// guest-facing surface publishes an address any more.
// Props stay camelCase; the dataLayer keys they map to are snake_case because
// that is GA4's vocabulary, and `cta_source` rather than `source` because GA4
// already has a built-in Source dimension meaning traffic origin.
export function ContactLink({
  method,
  href,
  ctaSource,
  hotel,
  className,
  children,
}: {
  method: 'phone';
  href: string;
  ctaSource: string;
  hotel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() =>
        pushDataLayerEvent('contact_click', {
          method,
          cta_source: ctaSource,
          ...(hotel ? { hotel } : {}),
        })
      }
    >
      {children}
    </a>
  );
}
