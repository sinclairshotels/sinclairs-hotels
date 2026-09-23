import { ContactLink } from '@/components/contact-link';
import { EnquiryForm } from '@/components/enquiry-form';
import { hotels } from '@/content/hotels';
import { contactNumbers, registeredOffice, reservationsHours, whatsappHref } from '@/content/site';
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
            <p className="mt-4 max-w-2xl text-base text-cream/85">
              For room bookings, use Book Now for live prices and instant confirmation. For
              weddings, meetings, groups or anything else, tell us below and the right team replies
              within one working day.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr]">
          <div className="rounded-xl border border-forest/10 bg-white p-6 shadow-xl sm:p-10">
            <h2 className="font-display text-xl text-forest">Send an enquiry</h2>
            <p className="mt-2 text-sm text-ink/70">
              Choose what it&rsquo;s about and we&rsquo;ll ask only what we need.
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
              <h2 className="font-display text-xl text-forest">Reservations</h2>
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
                  <dt className="text-xs uppercase tracking-wider text-ink/50">Hours</dt>
                  <dd className="mt-1 text-ink/70">{reservationsHours}</dd>
                </div>
              </dl>
              <a
                href={whatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block rounded bg-[#25D366] px-4 py-2 text-xs font-medium uppercase tracking-wider text-white transition hover:brightness-95"
              >
                Chat on WhatsApp
              </a>
            </div>

            <div className="rounded-lg border border-forest/10 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <h2 className="font-display text-xl text-forest">Our properties</h2>
              {/* Straight to the property's own page rather than back into this
                  form: someone reading the contact page wants to see the hotel,
                  and the form is already open beside them. */}
              <ul className="mt-4 grid grid-cols-1 gap-x-8 text-sm sm:grid-cols-2">
                {hotels.map((hotel) => (
                  <li key={hotel.slug} className="border-b border-dotted border-forest/15 py-2">
                    <Link href={`/hotels/${hotel.slug}`} className="text-ink/90 hover:text-forest">
                      {hotel.location}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-ink/50">
                Each name opens that hotel&rsquo;s page with directions and a map.
              </p>
            </div>

            <div className="rounded-lg border border-forest/10 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <h2 className="font-display text-xl text-forest">Registered office</h2>
              <address className="mt-4 text-sm not-italic leading-relaxed text-ink/70">
                {registeredOffice.company}
                {registeredOffice.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
