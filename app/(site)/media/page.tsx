import { PressCard } from '@/components/press-card';
import { fraudAlert, pressMentions } from '@/content/site';
import { pressSlots } from '@/lib/photo-slots';
import { currentOverrides, photoUrl, withPhotos } from '@/lib/photos';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'Press & Media',
  description: 'Press coverage and media mentions of Sinclairs Hotels & Resorts.',
  path: '/media',
});

export const revalidate = 600;

export default async function MediaPage() {
  const overrides = await currentOverrides();
  // Derived here rather than at module scope, and from the overridden copy:
  // the module-level versions read the raw content, so a clipping replaced in
  // /admin/photos was swapped into `mentions` and then never rendered.
  const mentions = withPhotos(pressMentions, pressSlots(), overrides);
  const featured = mentions.filter(
    (mention): mention is (typeof mentions)[number] & { image: string } => 'image' in mention,
  );
  const inTheNews = mentions.filter((mention) => !('image' in mention));

  return (
    <div>
      <section className="relative flex h-[42vh] min-h-[320px] items-end overflow-hidden">
        <div className="absolute inset-0 animate-hero-zoom">
          <Image
            src={photoUrl(
              'media:hero',
              '/images/hotels/gangtok/destination/SinclairsGangtoknightview.webp',
              overrides,
            )}
            alt="Sinclairs Gangtok at night"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/95 via-forest-dark/50 to-forest-dark/15" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-14 text-cream">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <p className="text-xs uppercase tracking-[0.3em] text-cream drop-shadow-md">
                In The News
              </p>
            </div>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
              Press &amp; Media
            </h1>
            <p className="mt-4 max-w-xl text-base text-cream/85">
              Coverage of Sinclairs Hotels &amp; Resorts across national and regional press.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 pt-10 sm:pt-16">
        <div className="rounded-lg border border-gold/40 bg-gold/5 p-6">
          <p className="text-xs uppercase tracking-widest text-forest">Fraud Alert</p>
          <p className="mt-2 text-sm leading-relaxed text-ink/80">{fraudAlert}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pt-12 sm:pt-16">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">In The Press</p>
        <h2 className="mt-3 font-display text-3xl text-forest sm:text-4xl">Featured Coverage</h2>
        {/* Cards, like everything else on the site, rather than the full-bleed
            editorial band this used to borrow from Weddings. That band is for
            photographs: these are scans of newspaper pages, and cropping one to
            fill half a screen turns a clipping into unreadable grey texture.
            object-contain on a tinted ground shows the whole page instead, at a
            size that reads as "a clipping" rather than pretending otherwise.
            Neither clipping has a syndicated URL on file, so the scan itself is
            the source: opening it full size is the article. */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {featured.map((mention) => (
            <PressCard
              key={`${mention.outlet}-${mention.date}-${mention.title}`}
              title={mention.title}
              outlet={mention.outlet}
              date={mention.date}
              image={mention.image}
              url={'url' in mention ? mention.url : mention.image}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">In The News</p>
        <h2 className="mt-3 font-display text-3xl text-forest sm:text-4xl">
          Also Making Headlines
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {inTheNews.map((mention) =>
            'url' in mention ? (
              <a
                key={`${mention.outlet}-${mention.date}-${mention.title}`}
                href={mention.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col rounded-lg border border-forest/10 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <span className="font-display text-4xl leading-none text-gold/30">&ldquo;</span>
                <p className="-mt-4 font-display text-lg leading-snug text-ink/90 group-hover:text-forest">
                  {mention.title}
                </p>
                <p className="mt-4 text-xs uppercase tracking-wider text-ink/50">
                  {mention.outlet} &middot; {mention.date}
                </p>
              </a>
            ) : (
              // No hover lift and no link styling: these have no source URL
              // on file, and a card that rises under the cursor promises a
              // destination it cannot go to. Listed in docs/CONTENT_BACKLOG.md.
              <div
                key={`${mention.outlet}-${mention.date}-${mention.title}`}
                className="relative flex flex-col rounded-lg border border-forest/10 bg-white p-6 shadow-sm"
              >
                <span className="font-display text-4xl leading-none text-gold/30">&ldquo;</span>
                <p className="-mt-4 font-display text-lg leading-snug text-ink/90">
                  {mention.title}
                </p>
                <p className="mt-4 text-xs uppercase tracking-wider text-ink/50">
                  {mention.outlet} &middot; {mention.date}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      <section className="relative flex h-[36vh] min-h-[280px] items-center justify-center overflow-hidden text-center text-cream">
        <div className="absolute inset-0 animate-hero-zoom">
          <Image
            src="/images/hotels/dooars/amenities/DSC_1316-Enhanced-NR.webp"
            alt="Sinclairs Retreat Dooars"
            fill
            className="object-cover"
            sizes="100vw"
          />
        </div>
        <div className="absolute inset-0 bg-forest-dark/75" />
        <div className="relative animate-fade-up px-6">
          <h2 className="font-display text-3xl sm:text-4xl">Ready for Your Escape?</h2>
          <p className="mt-3 max-w-md text-sm text-cream/85">
            Share your travel dates and let our reservations team find the perfect stay for you.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded bg-gold px-8 py-3 text-sm uppercase tracking-wider text-forest transition hover:bg-gold-light"
          >
            Enquire Now
          </Link>
        </div>
      </section>
    </div>
  );
}
