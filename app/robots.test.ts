import { siteConfig } from '@/content/site';
import { describe, expect, it, vi } from 'vitest';

const mockHeaders = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ headers: mockHeaders }));

async function robotsFor(host: string) {
  mockHeaders.mockResolvedValue(new Headers(host ? { host } : {}));
  const { default: robots } = await import('./robots');
  return robots();
}

const CANONICAL_HOST = new URL(siteConfig.url).host;

describe('robots', () => {
  it('lets crawlers in only on the canonical host', async () => {
    const result = await robotsFor(CANONICAL_HOST);
    expect(result.rules).toMatchObject({ userAgent: '*', allow: '/' });
  });

  it.each([
    ['sinclairs-hotels.vercel.app', 'the Vercel deployment URL'],
    ['dev.sinclairshotels.com', 'the dev subdomain'],
    ['staff.dev.sinclairshotels.com', 'the staff dev subdomain'],
    ['sinclairs-hotels-abc123-subham-5497.vercel.app', 'a preview deployment'],
    ['sinclairshotels.com', 'the apex, which redirects to www'],
  ])('keeps crawlers out of %s (%s)', async (host) => {
    const result = await robotsFor(host);
    expect(result.rules).toEqual({ userAgent: '*', disallow: '/' });
  });

  it('stays closed when the host header is missing entirely', async () => {
    const result = await robotsFor('');
    expect(result.rules).toEqual({ userAgent: '*', disallow: '/' });
  });

  it('ignores host casing, which is not case-sensitive in DNS', async () => {
    const result = await robotsFor(CANONICAL_HOST.toUpperCase());
    expect(result.rules).toMatchObject({ allow: '/' });
  });

  it('keeps the admin dashboard, payments and token-addressed guest links out of the index', async () => {
    const result = await robotsFor(CANONICAL_HOST);
    const rules = result.rules as { disallow?: string[] };
    expect(rules.disallow).toEqual(['/admin', '/api', '/ipay', '/v', '/booking']);
  });

  it('leaves /book itself crawlable — it is the public entry to the booking engine', async () => {
    const result = await robotsFor(CANONICAL_HOST);
    const rules = result.rules as { disallow?: string[] };
    expect(rules.disallow).not.toContain('/book');
  });

  it('always advertises the sitemap on the canonical host, never the host it was asked on', async () => {
    const result = await robotsFor('dev.sinclairshotels.com');
    expect(result.sitemap).toBe(`${siteConfig.url}/sitemap.xml`);
  });
});
