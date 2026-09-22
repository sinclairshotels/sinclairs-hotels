import { GalleryLightbox } from '@/components/gallery-lightbox';
import { Reveal } from '@/components/reveal';
import { SectionHeading } from '@/components/section-heading';
import {
  CakeIcon,
  CameraIcon,
  CateringIcon,
  FlowerIcon,
  HeartIcon,
  MusicIcon,
} from '@/components/service-icons';
import type { Hotel } from '@/content/types';
import Image from 'next/image';
import Link from 'next/link';

const HIGHLIGHT_ICONS = [HeartIcon, FlowerIcon, CateringIcon, CakeIcon, MusicIcon, CameraIcon];

export function WeddingSection({ hotel }: { hotel: Hotel }) {
  const weddings = hotel.weddings;
  if (!weddings) return null;

  const [lead, ...rest] = weddings.gallery;

  return (
    <section id="weddings" className="scroll-mt-32 bg-forest/5 py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-14">
          {lead && (
            <div className="relative order-1 aspect-[4/5] overflow-hidden rounded-lg shadow-lg lg:order-2 lg:col-span-2">
              <Image
                src={lead.src}
                alt={lead.alt}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="transform-gpu object-cover"
              />
            </div>
          )}
          <div className="order-2 flex flex-col justify-center lg:order-1 lg:col-span-3">
            <Reveal>
              <SectionHeading
                eyebrow="Weddings"
                title={`Weddings at ${hotel.name}`}
                lede={weddings.intro}
              />
            </Reveal>

            <ul className="mt-8 grid max-w-lg grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {weddings.highlights.map((highlight, i) => {
                const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length] ?? HeartIcon;
                return (
                  <li key={highlight} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 stroke-current stroke-2 text-gold" />
                    <span className="text-sm text-ink/80">{highlight}</span>
                  </li>
                );
              })}
            </ul>

            <Link
              href={`/contact?property=${hotel.slug}&type=wedding`}
              className="group mt-8 inline-flex w-fit items-center gap-2 border-b border-gold pb-1 text-sm uppercase tracking-wider text-forest transition hover:text-gold"
            >
              Enquire for Your Wedding
              <span aria-hidden="true" className="transition group-hover:translate-x-1">
                &rarr;
              </span>
            </Link>
          </div>
        </div>

        {rest.length > 0 && (
          <div className="mt-14">
            <GalleryLightbox images={rest} />
          </div>
        )}
      </div>
    </section>
  );
}
