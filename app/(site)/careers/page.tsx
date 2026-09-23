import { ApplyForm } from '@/components/apply-form';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { prisma } from '@/lib/db';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata({
  title: 'Careers',
  description:
    'Open positions across Sinclairs Hotels & Resorts, and how to apply. We take general applications whether or not a role is advertised.',
  path: '/careers',
});

// Positions are staff data, edited from /admin/careers without a deploy, so
// this revalidates rather than being frozen at build time — the same reasoning
// as the pages that render replaceable photos.
export const revalidate = 300;

export default async function CareersPage() {
  const positions = await prisma.jobPosition.findMany({
    where: { open: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  // Grouped by property, in site order, with anything not tied to one property
  // last under its own heading. A flat list makes somebody read nine titles to
  // find the one town they can actually work in.
  const order = hotels.map((hotel) => hotel.slug);
  const groups = [
    ...hotels.map((hotel) => ({
      key: hotel.slug,
      name: hotel.name,
      positions: positions.filter((position) => position.hotelSlug === hotel.slug),
    })),
    {
      key: 'other',
      name: 'Across the group',
      positions: positions.filter(
        (position) => !position.hotelSlug || !order.includes(position.hotelSlug),
      ),
    },
  ].filter((group) => group.positions.length > 0);

  return (
    <div>
      <section className="bg-forest px-6 py-16 text-cream sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-gold" />
            <p className="text-xs uppercase tracking-[0.3em] text-gold-light">Careers</p>
          </div>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">
            Work amongst peaks, serve with heart
          </h1>
          <p className="mt-4 max-w-2xl text-base text-cream/85">
            Nine properties across the hills, the plains and the islands. If you care about looking
            after people, there is a place for you here — and if nothing below fits, send your CV
            anyway.
          </p>
        </div>
      </section>

      <section className="bg-cream px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl text-forest">Current opportunities</h2>

          {groups.length === 0 ? (
            <div className="mt-6 rounded-xl border border-forest/10 bg-white p-8 shadow-sm">
              <p className="font-display text-xl text-forest">No current openings</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/70">
                We are not advertising a role at the moment. We still read every CV that reaches us,
                and we come back to people when something opens.
              </p>
              <ApplyForm positionLabel="a general application" />
            </div>
          ) : (
            <div className="mt-6 space-y-10">
              {groups.map((group) => (
                <div key={group.key}>
                  <h3 className="text-xs uppercase tracking-[0.2em] text-gold-dark">
                    {group.name}
                  </h3>
                  <div className="mt-3 space-y-4">
                    {group.positions.map((position) => {
                      const where = position.hotelSlug
                        ? (getHotelBySlug(position.hotelSlug)?.location ?? group.name)
                        : 'Across the group';
                      return (
                        <article
                          key={position.id}
                          className="rounded-xl border border-forest/10 bg-white p-6 shadow-sm transition hover:shadow-lg"
                        >
                          <h4 className="font-display text-xl text-forest">{position.title}</h4>
                          <p className="mt-1 text-xs uppercase tracking-wider text-ink/50">
                            {where} · {position.department}
                          </p>
                          {position.descriptionText && (
                            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/70">
                              {position.descriptionText}
                            </p>
                          )}
                          {position.jdUrl && (
                            <p className="mt-3 text-sm">
                              <a
                                href={position.jdUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-forest underline hover:text-forest-dark"
                              >
                                Read the full job description
                                {position.jdFileName ? ` (${position.jdFileName})` : ''}
                              </a>
                            </p>
                          )}
                          <ApplyForm positionId={position.id} positionLabel={position.title} />
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-forest/10 bg-white p-6 shadow-sm">
                <h4 className="font-display text-xl text-forest">Join our talent pool</h4>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/70">
                  Nothing above a match? Send your CV and we will come back to you when something
                  opens that fits.
                </p>
                <ApplyForm positionLabel="a general application" />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
