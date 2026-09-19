import { siteConfig } from '@/content/site';
import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

// Never belong in the index, on any host: the admin dashboard and its login,
// the payment flow, and voucher/booking pages addressed by a one-off token.
// /book itself is crawlable — it is the public entry point — but everything
// under it is a live availability result, which is not a page to index.
const PRIVATE_PATHS = ['/admin', '/api', '/ipay', '/v', '/booking'];

// Keyed on the requested host rather than on an env var, because this project
// answers on several hostnames with the same build at once —
// sinclairs-hotels.vercel.app, dev.sinclairshotels.com,
// staff.dev.sinclairshotels.com and every preview URL. An env-based rule opens
// or closes all of them together, so at cutover the dev subdomain would have
// begun serving a crawlable, full duplicate of the live site. Only the canonical
// host is ever crawlable; every other host stays closed before and after
// cutover, with no step to remember.
//
// Until DNS moves, no request can arrive on the canonical host at all, so this
// also keeps the pre-cutover deployment out of the index — which matters because
// every canonical it emits points at a WordPress URL that is still a 404, and
// Google discards a canonical that resolves to a 404 and indexes the crawled URL
// instead.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host')?.toLowerCase() ?? '';
  const canonicalHost = new URL(siteConfig.url).host.toLowerCase();

  return {
    rules:
      host === canonicalHost
        ? { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS }
        : { userAgent: '*', disallow: '/' },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
