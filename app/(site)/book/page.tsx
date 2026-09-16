import { BookingSearchForm } from '@/components/booking-search-form';
import { hotels } from '@/content/hotels';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = pageMetadata({
  title: 'Book a Stay',
  description:
    'Check live availability and book direct across Sinclairs Hotels & Resorts — nine properties from the Himalayas to the Andamans.',
  path: '/book',
});

export default function BookPage() {
  return (
    <>
      <section className="relative h-[42vh] min-h-[320px] overflow-hidden">
        <div className="absolute inset-0 animate-hero-zoom">
          <Image
            src="/images/hotels/gangtok/destination/SinclairsGangtoknightview.webp"
            alt="Sinclairs Gangtok lit up at night"
            fill
            priority
            sizes="100vw"
            quality={90}
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-forest-dark/95 via-forest-dark/50 to-forest-dark/15" />
        <div className="absolute inset-x-0 bottom-0 animate-fade-up px-6 pb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-cream drop-shadow-md">
            Book Direct
          </p>
          <h1 className="mt-3 font-display text-4xl text-cream drop-shadow-md sm:text-5xl">
            Reserve Your Stay
          </h1>
        </div>
      </section>

      <section className="px-6">
        <div className="mx-auto -mt-10 max-w-4xl rounded-xl bg-white p-6 shadow-2xl sm:p-8">
          <BookingSearchForm hotels={hotels} />
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-2xl text-forest">Why Book With Us Directly</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 text-sm text-ink/70 sm:grid-cols-3">
            <div>
              <p className="font-display text-base text-forest">Our Best Rate</p>
              <p className="mt-2 leading-relaxed">
                The rate you see here is the one our reservations team holds — no agency margin
                sitting between you and the hotel.
              </p>
            </div>
            <div>
              <p className="font-display text-base text-forest">Confirmed Instantly</p>
              <p className="mt-2 leading-relaxed">
                Your room is held the moment payment clears, and your confirmation reaches your
                inbox straight away.
              </p>
            </div>
            <div>
              <p className="font-display text-base text-forest">Talk To A Person</p>
              <p className="mt-2 leading-relaxed">
                A booking made here is a booking our own team can see, change and help you with over
                the phone.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
