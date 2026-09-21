import { pageMetadata } from '@/lib/seo';
import { describe, expect, it } from 'vitest';

describe('pageMetadata', () => {
  it('lets the layout template add the brand to a page that does not carry it', () => {
    const meta = pageMetadata({ title: 'Weddings', description: 'd', path: '/weddings' });

    expect(meta.title).toBe('Weddings');
    expect(meta.openGraph?.title).toBe('Weddings — Sinclairs');
  });

  it('opts out of the template when the title already says the brand', () => {
    const meta = pageMetadata({
      title: 'Sinclairs Retreat Dooars',
      description: 'd',
      path: '/hotels/dooars',
    });

    expect(meta.title).toEqual({ absolute: 'Sinclairs Retreat Dooars' });
    expect(meta.openGraph?.title).toBe('Sinclairs Retreat Dooars');
  });

  it('keeps the canonical path and falls back to a real share image', () => {
    const meta = pageMetadata({ title: 'Contact Us', description: 'd', path: '/contact' });

    expect(meta.alternates?.canonical).toBe('/contact');
    expect(meta.openGraph?.images).toBeDefined();
  });
});
