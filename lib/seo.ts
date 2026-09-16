import { siteConfig } from '@/content/site';
import type { Metadata } from 'next';

export function pageMetadata({
  title,
  description,
  path,
  image,
  robots,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  // Only for pages that exist but shouldn't be indexed — a live availability
  // result, for instance, where the hotel's own page is the indexable one.
  robots?: Metadata['robots'];
}): Metadata {
  // No standalone social-share graphic exists yet, so pages without a more
  // specific image (a hotel's own heroImage) fall back to this real photo
  // rather than a placeholder.
  const ogImage = image ?? '/images/hotels/port-blair/destination/SinclairsBayviewAerielView.webp';

  return {
    title,
    description,
    alternates: { canonical: path },
    ...(robots ? { robots } : {}),
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}${path}`,
      siteName: siteConfig.name,
      // Actual source dimensions vary per photo, so width/height aren't
      // declared here — crawlers fetch and measure the image themselves.
      images: [{ url: ogImage }],
      locale: 'en_IN',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}
