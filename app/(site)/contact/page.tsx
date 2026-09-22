import { ContactLink } from '@/components/contact-link';
import { EnquiryForm } from '@/components/enquiry-form';
import { hotels } from '@/content/hotels';
import { contactNumbers, whatsappHref } from '@/content/site';
import { currentOverrides, photoUrl } from '@/lib/photos';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  title: 'Contact Us',
  description: 'Get in touch with Sinclairs Hotels & Resorts reservations and sales teams.',
  path: '/contact',
});

// Photos are staff-editable without a deploy, so this is revalidated rather than
// frozen at build time.
export const revalidate = 600;

export default async function ContactPage({
  searchParams,
}: {
  // The same parameters /enquiry took. That page is gone and 301s here, so a
  // link printed on a voucher or sitting in an old email still lands on a form
  // with the property and type already chosen.
  searchParams: Promise<{
    property?: string;
    type?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  }>;
}) {
  const [{ property, type, checkIn, checkOut, guests }, overrides] = await Promise.all([
    searchParams,
    currentOverrides(),
  ]);

  return (
    <div>
      <section className="relative flex h-[42vh] min-h-[320px] items-end overflow-hidden">
        <div className="absolute inset-0 animate-hero-zoom">
          <Image
            src={photoUrl(
              'contact:hero',
              '/images/hotels/dooars/amenities/Welcoming guest with the traditional khada.webp',
              overrides,
            )}
            alt="A guest welcomed at reception with the traditional khada scarf"
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
                Get In Touch
              </p>
            </div>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">Contact Us</h1>
            <p className="mt-4 max-w-xl text-base text-cream/85">
              Reach our reservations team by phone, or send an enquiry and we&rsquo;ll come back to
              you — whichever of our nine properties you have in mind.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr]">
          <div className="rounded-xl border border-forest/10 bg-white p-6 shadow-xl sm:p-10">
            <h2 className="font-display text-xl text-forest">Send an enquiry</h2>
            <p className="mt-2 text-sm text-ink/70">
              Share your dates and requirements and our reservations team will come back to you.
            </p>
            <div className="mt-6">
              <EnquiryForm
                hotels={hotels}
                defaultProperty={property}
                defaultType={type}
                defaultCheckIn={checkIn}
                defaultCheckOut={checkOut}
                defaultGuests={guests}
              />
            </div>
          </div>

          <div className="space-y-10">
            <div className="rounded-lg border border-forest/10 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <h2 className="font-display text-xl text-forest">Reservations &amp; Sales</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-ink/50">Toll Free</dt>
                  <dd className="mt-1">
                    <ContactLink
                      method="phone"
                      href={contactNumbers.tollFreeHref}
                      ctaSource="contact_page_reservations"
                      className="hover:text-gold"
                    >
                      {contactNumbers.tollFree}
                    </ContactLink>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-ink/50">WhatsApp</dt>
                  <dd className="mt-1">
                    <a
                      href={whatsappHref()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-gold"
                    >
                      {contactNumbers.whatsapp}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-ink/50">Everything else</dt>
                  <dd className="mt-1 text-ink/70">
                    Use the enquiry form and the right team will answer — it reaches reservations,
                    sales and the property itself.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-forest/10 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <h2 className="font-display text-xl text-forest">Our Properties</h2>
              <ul className="mt-4 divide-y divide-forest/10 text-sm">
                {hotels.map((hotel) => (
                  <li
                    key={hotel.slug}
                    className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div>
                      <p className="text-ink/90">{hotel.name}</p>
                      <p className="text-xs text-ink/50">
                        {hotel.location}, {hotel.state}
                      </p>
                    </div>
                    <Link
                      href={`/contact?property=${hotel.slug}&type=hotel`}
                      className="shrink-0 text-gold-dark hover:text-gold"
                    >
                      Enquire
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
