import { hotels } from '@/content/hotels';
import { siteConfig } from '@/content/site';
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    '',
    '/hotels',
    '/book',
    '/weddings',
    '/meetings-events',
    '/contact',
    '/enquiry',
    '/media',
  ];

  return [
    ...staticPaths.map((path) => ({
      url: `${siteConfig.url}${path}`,
      changeFrequency: 'monthly' as const,
      priority: path === '' ? 1 : 0.8,
    })),
    ...hotels.map((hotel) => ({
      url: `${siteConfig.url}/hotels/${hotel.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
  ];
}
