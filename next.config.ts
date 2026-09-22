import type { NextConfig } from 'next';
import { legacyRedirects } from './lib/legacy-redirects';

const nextConfig: NextConfig = {
  images: {
    // avif is deliberately excluded: it's meaningfully smaller than webp but
    // its encode is CPU-heavy, and in dev every first request re-encodes from
    // scratch (no CDN warm cache) — with a page rendering 9+ photos at once,
    // that stalls first paint until each one finishes. webp gets most of the
    // size win at a fraction of the encode cost.
    formats: ['image/webp'],
    // Content is static and only changes on redeploy, so cache optimized
    // variants for as long as possible instead of the 60s default.
    minimumCacheTTL: 31536000,
    // Default (75) is fine for cards/thumbnails. Full-bleed heroes stretch an
    // already-compressed 1600px source up to 3840px, so a second lossy pass
    // at 75 compounds into visible haze — those opt into 90 explicitly.
    qualities: [75, 90],
  },
  async redirects() {
    return [
      // /enquiry was a page of its own until the enquiry form moved onto
      // /contact. Next carries the query string across a redirect by itself,
      // so ?property=&type= still arrives and the form still pre-fills — which
      // matters because those links are printed on vouchers and sitting in
      // sent email.
      { source: '/enquiry', destination: '/contact', statusCode: 301 as const },
      ...legacyRedirects(),
    ];
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next's App Router streams RSC hydration payloads via inline <script>
      // tags it injects itself; a nonce-based CSP is possible but needs
      // middleware to thread a per-request nonce, so 'unsafe-inline' here is
      // a deliberate tradeoff for compatibility. The other directives below
      // still block the exfiltration and embedding vectors that matter most.
      // googletagmanager.com is GTM's own script host, needed once
      // NEXT_PUBLIC_GTM_ID is set (see app/layout.tsx) — GTM then loads GA4
      // itself from the same host. googleadservices/doubleclick are separate:
      // container GTM-NDXBWC also carries Google Ads conversion and
      // remarketing tags, which load conversion.js from googleadservices.com
      // and pixel from googleads.g.doubleclick.net. Without these the Ads tags
      // fail with a console-only CSP error and no visible symptom — the site
      // looks fine while every ad conversion silently goes unrecorded.
      // 'unsafe-eval' is dev-only: Next/React's Fast Refresh
      // and dev-mode stack-trace reconstruction use eval(), which a strict
      // script-src otherwise silently blocks (console warning, no visible
      // error) — React itself never calls eval() in production, so prod stays
      // without it.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net`,
      // Radix (Select/Popover) and react-day-picker position themselves via
      // inline style attributes, so style-src needs 'unsafe-inline' too.
      "style-src 'self' 'unsafe-inline'",
      // GA4 and Ads fall back to image beacons, and Ads conversion/remarketing
      // pixels are served from doubleclick and the google.com ccTLDs.
      "img-src 'self' data: https://www.googletagmanager.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://www.google.com https://www.google.co.in",
      "font-src 'self' data:",
      // Google Maps iframe on hotel pages, GTM's <noscript> fallback iframe,
      // doubleclick's remarketing frame, and tagassistant.google.com — the last
      // one is what GTM Preview mode uses, so without it the container can't be
      // debugged against this site at all.
      'frame-src https://maps.google.com https://www.google.com https://www.googletagmanager.com https://td.doubleclick.net https://bid.g.doubleclick.net https://tagassistant.google.com',
      // GA4 picks a regional collection host per property (region1..regionN),
      // so these are wildcarded rather than pinned to one region.
      "connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://googleads.g.doubleclick.net https://td.doubleclick.net https://www.google.com https://tagassistant.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
