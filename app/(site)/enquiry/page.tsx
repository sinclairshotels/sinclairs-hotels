import { EnquiryForm } from '@/components/enquiry-form';
import { hotels } from '@/content/hotels';
import { currentOverrides, photoUrl } from '@/lib/photos';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = pageMetadata({
  title: 'Enquire Now',
  description: 'Send us your travel dates and requirements and our team will get back to you.',
  path: '/enquiry',
});

export default async function EnquiryPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    type?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  }>;
}) {
  const overrides = await currentOverrides();
  const { property, type, checkIn, checkOut, guests } = await searchParams;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden aspect-[4/3] lg:sticky lg:top-0 lg:block lg:aspect-auto lg:h-screen">
        <Image
          src={photoUrl(
            '/images/hotels/darjeeling/destination/Sinclairs-Darjeeling-Entrance-1.webp',
            overrides,
          )}
          alt="The warmly lit entrance porch at Sinclairs Darjeeling"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/70 via-forest-dark/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-cream">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-light">Get In Touch</p>
          <h2 className="mt-3 max-w-sm font-display text-3xl leading-tight">
            Nine Destinations, One Warm Welcome
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-cream/80">
            Wherever you&rsquo;re headed — the mountains, a palace, the coast — our reservations
            team will find the right room, rate and dates for you.
          </p>
        </div>
      </div>

      <div className="bg-forest/5 px-6 py-10 sm:py-16 lg:px-16 lg:py-24">
        <div className="mx-auto max-w-lg lg:mx-0">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">Get In Touch</p>
            <h1 className="mt-4 font-display text-4xl text-forest">Enquire Now</h1>
            <p className="mt-4 text-sm text-ink/70">
              Share your travel dates and requirements, and our reservations team will be in touch.
            </p>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-xl sm:p-10">
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
      </div>
    </div>
  );
}
