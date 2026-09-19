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

  // The root layout appends the brand through a title template. A page whose own
  // title already carries it — every hotel page, since the brand is part of the
  // property's name — would otherwise read "Sinclairs Gangtok — Sinclairs", so
  // those opt out of the template rather than say it twice.
  const repeatsBrand = title.includes(siteConfig.shortName);
  const fullTitle = repeatsBrand ? title : `${title} — ${siteConfig.shortName}`;

  return {
    title: repeatsBrand ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    ...(robots ? { robots } : {}),
    openGraph: {
      title: fullTitle,
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
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}
