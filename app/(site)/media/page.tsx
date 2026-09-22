import { EditorialRow } from '@/components/editorial-row';
import { fraudAlert, pressMentions } from '@/content/site';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

const featured = pressMentions.filter(
  (mention): mention is (typeof pressMentions)[number] & { image: string } => 'image' in mention,
);
const inTheNews = pressMentions.filter((mention) => !('image' in mention));

export const metadata: Metadata = pageMetadata({
  title: 'Press & Media',
  description: 'Press coverage and media mentions of Sinclairs Hotels & Resorts.',
  path: '/media',
});

export default function MediaPage() {
  return (
    <div>
      <section className="relative flex h-[42vh] min-h-[320px] items-end overflow-hidden">
        <div className="absolute inset-0 animate-hero-zoom">
          <Image
            src="/images/hotels/gangtok/destination/SinclairsGangtoknightview.webp"
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

      <div className="mt-12 sm:mt-16">
        <p className="mx-auto max-w-5xl px-6 text-xs uppercase tracking-[0.3em] text-gold-dark">
          Featured Coverage
        </p>
        {featured.map((mention, i) => (
          <EditorialRow
            key={`${mention.outlet}-${mention.date}-${mention.title}`}
            image={mention.image}
            alt={mention.title}
            imageSide={i % 2 === 0 ? 'left' : 'right'}
            title={mention.title}
            body={`As featured in ${mention.outlet}, ${mention.date}.`}
          />
        ))}
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
              <div
                key={`${mention.outlet}-${mention.date}-${mention.title}`}
                className="group relative flex flex-col rounded-lg border border-forest/10 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
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
