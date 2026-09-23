import { hotels } from '@/content/hotels';
import { describe, expect, it } from 'vitest';
import { LEGACY_PROPERTY_CODES, LEGACY_PROPERTY_PATHS, legacyRedirects } from './legacy-redirects';
import fixture from './legacy-redirects.fixture.json';

const redirects = legacyRedirects();

// Every route this app serves that a redirect is allowed to point at. A
// destination outside this set is a redirect to a 404, which is worse than
// leaving the old URL alone.
const VALID_DESTINATIONS = new Set([
  '/',
  '/hotels',
  '/weddings',
  '/meetings-events',
  '/contact',
  '/enquiry',
  '/media',
  '/careers',
  ...hotels.map((hotel) => `/hotels/${hotel.slug}`),
]);

// Mirrors how Next matches a redirect: a literal path, or a literal prefix
// followed by a single :param segment. Query rules are matched via `has`.
function matches(source: string, path: string, query: URLSearchParams): boolean {
  const paramIndex = source.indexOf('/:');
  const colonIndex = source.indexOf(':');

  if (colonIndex === -1) return source === path;

  if (paramIndex === -1) {
    const prefix = source.slice(0, colonIndex);
    if (!path.startsWith(prefix)) return false;
    const rest = path.slice(prefix.length);
    return rest.length > 0 && !rest.includes('/');
  }

  return false;
}

function resolve(url: string): string | undefined {
  const [path, search = ''] = url.split('?');
  const query = new URLSearchParams(search);

  for (const redirect of redirects) {
    if (!matches(redirect.source, path ?? '', query)) continue;
    const has = (redirect as { has?: { key: string; value?: string }[] }).has;
    if (has && !has.every((cond) => query.get(cond.key) === cond.value)) continue;
    return redirect.destination;
  }
  return undefined;
}

describe('legacy redirect map', () => {
  it('covers every live URL recovered from the WordPress site', () => {
    // A legacy URL is handled either by a redirect or by this app already
    // serving that exact path (/, /media), in which case redirecting it would
    // be a pointless hop.
    const unmapped = fixture.urls.filter(
      (url) => !VALID_DESTINATIONS.has(url) && resolve(url) === undefined,
    );
    expect(unmapped).toEqual([]);
  });

  it('never sends a legacy URL to a route this app does not serve', () => {
    const bad = redirects
      .map((r) => r.destination)
      .filter((destination) => !VALID_DESTINATIONS.has(destination));
    expect(bad).toEqual([]);
  });

  it('issues 301, not 308, so every crawler reads it the same way', () => {
    expect(redirects.every((r) => r.statusCode === 301)).toBe(true);
    expect(redirects.some((r) => 'permanent' in r)).toBe(false);
  });

  it('maps each property landing page to its own hotel page', () => {
    for (const [legacyPath, slug] of Object.entries(LEGACY_PROPERTY_PATHS)) {
      expect(resolve(`/${legacyPath}`)).toBe(`/hotels/${slug}`);
    }
  });

  it('collapses a property sub-page onto that property, not onto /hotels', () => {
    expect(resolve('/darjeeling-accomodation')).toBe('/hotels/darjeeling');
    expect(resolve('/portblair-premier-family-suite')).toBe('/hotels/port-blair');
    expect(resolve('/palace-udaipur-dining')).toBe('/hotels/udaipur');
    expect(resolve('/kalimpong-photo-gallery')).toBe('/hotels/kalimpong');
    expect(resolve('/ooty-sightseeing.php')).toBe('/hotels/ooty');
  });

  it('keeps the property when the old booking URL carried it in the query', () => {
    for (const [code, slug] of Object.entries(LEGACY_PROPERTY_CODES)) {
      expect(resolve(`/reservations.php?ht=${code}&rm=XYZ`)).toBe(`/hotels/${slug}`);
      expect(resolve(`/conference-booking?ht=${code}`)).toBe(`/hotels/${slug}`);
    }
    expect(resolve('/festive_reservations?ht=DAR&pkg=GAKL&rm=CDR')).toBe('/hotels/darjeeling');
  });

  it('falls back sensibly when the booking URL carries no property', () => {
    expect(resolve('/reservations.php')).toBe('/hotels');
    expect(resolve('/conference-booking')).toBe('/meetings-events');
    expect(resolve('/reservations')).toBe('/hotels');
  });

  it('sends an unrecognised property code to the hotels index rather than nowhere', () => {
    expect(resolve('/reservations.php?ht=ZZZ')).toBe('/hotels');
  });

  it('routes the per-property PDFs to the property they described', () => {
    expect(resolve('/factsheet/PortBlair.pdf')).toBe('/hotels/port-blair');
    expect(resolve('/factsheet/kalimpong.pdf')).toBe('/hotels/kalimpong');
    expect(resolve('/assets/Activities-Dooars.pdf')).toBe('/hotels/dooars');
  });

  it('does not hijack a path that merely starts with a property name', () => {
    expect(resolve('/hotels/darjeeling')).toBeUndefined();
    expect(resolve('/enquiry')).toBeUndefined();
  });

  it('declares every property code as a real hotel slug', () => {
    const slugs = new Set(hotels.map((hotel) => hotel.slug));
    for (const slug of Object.values(LEGACY_PROPERTY_CODES)) expect(slugs).toContain(slug);
    for (const slug of Object.values(LEGACY_PROPERTY_PATHS)) expect(slugs).toContain(slug);
  });
});
