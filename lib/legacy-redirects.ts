import type { Redirect } from 'next/dist/lib/load-custom-routes';

// 301s from the WordPress site's URL structure to this one, so the search
// equity on ~190 indexed URLs transfers at DNS cutover instead of turning into
// 404s. The inventory behind this map was recovered by crawling the live site
// on 2026-09-12 — its published sitemap.xml is stale and misses real pages
// (every /gangtok* URL, /palace-udaipur*, the whole /reservations.php set), so
// the crawl, not the sitemap, is the source of truth. It is committed as
// lib/legacy-redirects.fixture.json and the test asserts every live URL in it
// lands on a real route.
//
// 301 rather than Next's `permanent: true` (which emits 308): both are honoured
// by Google, but 301 is what every other crawler, analytics tool and legacy
// client understands unambiguously, and it downgrades a stray POST to
// /reservations.php into a GET instead of replaying it at a page that has no
// POST handler.
const STATUS_MOVED_PERMANENTLY = 301;

// Legacy path prefix → current hotel slug. Identical for most properties; the
// two that differ are the reason this is a map and not a string operation.
export const LEGACY_PROPERTY_PATHS: Record<string, string> = {
  burdwan: 'burdwan',
  darjeeling: 'darjeeling',
  dooars: 'dooars',
  gangtok: 'gangtok',
  kalimpong: 'kalimpong',
  ooty: 'ooty',
  portblair: 'port-blair',
  siliguri: 'siliguri',
  'palace-udaipur': 'udaipur',
};

// The old booking engine addressed properties by code in a query string
// (/reservations.php?ht=BUR&rm=BJS), not by path.
export const LEGACY_PROPERTY_CODES: Record<string, string> = {
  BUR: 'burdwan',
  DAR: 'darjeeling',
  DOO: 'dooars',
  GAN: 'gangtok',
  KAL: 'kalimpong',
  OTY: 'ooty',
  POR: 'port-blair',
  SIL: 'siliguri',
  UPR: 'udaipur',
};

// Everything a property had its own page for — rooms, dining, conference,
// gallery, sightseeing, packages — is now a section of that property's single
// page, so all of it collapses onto /hotels/<slug>. Sending these to /hotels
// or the homepage instead would be a soft-404: the content still exists, just
// not at its own URL.
function propertyRedirects(): Redirect[] {
  return Object.entries(LEGACY_PROPERTY_PATHS).flatMap(([legacyPath, slug]) => [
    {
      source: `/${legacyPath}`,
      destination: `/hotels/${slug}`,
      statusCode: STATUS_MOVED_PERMANENTLY,
    },
    {
      source: `/${legacyPath}-:section`,
      destination: `/hotels/${slug}`,
      statusCode: STATUS_MOVED_PERMANENTLY,
    },
  ]);
}

// One rule per code per legacy booking path. `has` is what lets a redirect
// depend on a query parameter; without it every /reservations.php URL would
// collapse to the same destination and lose which property was being booked.
function bookingRedirects(): Redirect[] {
  const bookingPaths = ['/reservations.php', '/festive_reservations', '/conference-booking'];

  return bookingPaths.flatMap((source) =>
    Object.entries(LEGACY_PROPERTY_CODES).map(([code, slug]) => ({
      source,
      has: [{ type: 'query' as const, key: 'ht', value: code }],
      destination: `/hotels/${slug}`,
      statusCode: STATUS_MOVED_PERMANENTLY,
    })),
  );
}

// Reached only when the query carries no usable `ht`, since the rules above are
// declared first and Next takes the first match.
const FALLBACK_REDIRECTS: Record<string, string> = {
  '/reservations.php': '/hotels',
  '/festive_reservations': '/hotels',
  '/conference-booking': '/meetings-events',
  '/reservations': '/hotels',
  '/bookings': '/hotels',
  '/honeymoon-reservations': '/weddings',
  '/wedding-booking': '/weddings',
  '/wedding-booking/honeymoon-reservations': '/weddings',
  '/contacts': '/contact',
  '/upcoming-hotels': '/hotels',
  '/special-offers': '/hotels',
  '/partner-with-us': '/contact',
  // /careers is deliberately absent: this app serves that path itself now, so
  // redirecting it would send the legacy URL past the page it was asking for.
  // Its fixture entry is covered by VALID_DESTINATIONS in the test instead.
  // No equivalent page exists yet. Home is the honest destination for a brand
  // page; the three legal paths below are a known gap, not a considered
  // mapping — see GO_LIVE_CHECKLIST.md § Cutover.
  '/about': '/',
  '/privacy-policy': '/',
  '/policy': '/',
  '/tnc': '/',
};

// Per-property PDFs served straight from the filesystem on the old host. They
// have no counterpart here, so they go to the property they described.
const LEGACY_ASSET_REDIRECTS: Record<string, string> = {
  '/factsheet/Burdwan.pdf': '/hotels/burdwan',
  '/factsheet/Darjeeling.pdf': '/hotels/darjeeling',
  '/factsheet/Dooars.pdf': '/hotels/dooars',
  '/factsheet/Gangtok.pdf': '/hotels/gangtok',
  '/factsheet/kalimpong.pdf': '/hotels/kalimpong',
  '/factsheet/Ooty.pdf': '/hotels/ooty',
  '/factsheet/PortBlair.pdf': '/hotels/port-blair',
  '/factsheet/Siliguri.pdf': '/hotels/siliguri',
  '/factsheet/palace-udaipur.pdf': '/hotels/udaipur',
  '/assets/Activities_Darjeeling.pdf': '/hotels/darjeeling',
  '/assets/Activities-Dooars.pdf': '/hotels/dooars',
};

export function legacyRedirects(): Redirect[] {
  return [
    // Query-dependent rules must come before the bare-path fallbacks for the
    // same source, because Next stops at the first match.
    ...bookingRedirects(),
    ...propertyRedirects(),
    ...Object.entries({ ...FALLBACK_REDIRECTS, ...LEGACY_ASSET_REDIRECTS }).map(
      ([source, destination]) => ({
        source,
        destination,
        statusCode: STATUS_MOVED_PERMANENTLY,
      }),
    ),
  ];
}
