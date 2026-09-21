import { ContactLink } from '@/components/contact-link';
import { hotels } from '@/content/hotels';
import { contactNumbers, siteConfig, socialLinks } from '@/content/site';
import Link from 'next/link';
import { NewsletterForm } from './newsletter-form';
import { FacebookIcon, InstagramIcon, TwitterIcon } from './social-icons';

const socialIcons = {
  Facebook: FacebookIcon,
  Instagram: InstagramIcon,
  Twitter: TwitterIcon,
} as const;

export function Footer() {
  return (
    <footer className="bg-forest-dark text-cream/80">
      <div className="mx-auto max-w-7xl px-6 pt-16">
        <div className="grid gap-10 pb-16 md:grid-cols-5">
          <div className="min-w-0 md:col-span-2">
            <img src="/logo.svg" alt="Sinclairs" className="h-10 w-auto" />
            <p className="mt-4 text-sm leading-relaxed">{siteConfig.description}</p>
            <div className="mt-5 flex gap-3">
              {socialLinks.map((social) => {
                const Icon = socialIcons[social.label as keyof typeof socialIcons];
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/20 text-cream/70 transition hover:border-gold-light hover:text-gold-light"
                  >
                    <Icon />
                  </a>
                );
              })}
            </div>
            <div className="mt-6">
              <p className="text-xs uppercase tracking-widest text-gold-light">
                Get Special Offers
              </p>
              <div className="mt-3">
                <NewsletterForm />
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-gold-light">Our Hotels</p>
            <ul className="mt-4 space-y-2 text-sm">
              {hotels.map((hotel) => (
                <li key={hotel.slug}>
                  <Link
                    href={`/hotels/${hotel.slug}`}
                    className="transition hover:text-gold-light hover:underline hover:underline-offset-4"
                  >
                    {hotel.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-gold-light">Explore</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  href="/meetings-events"
                  className="transition hover:text-gold-light hover:underline hover:underline-offset-4"
                >
                  Meetings &amp; Events
                </Link>
              </li>
              <li>
                <Link
                  href="/weddings"
                  className="transition hover:text-gold-light hover:underline hover:underline-offset-4"
                >
                  Weddings
                </Link>
              </li>
              <li>
                <Link
                  href="/enquiry"
                  className="transition hover:text-gold-light hover:underline hover:underline-offset-4"
                >
                  Enquire Now
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="transition hover:text-gold-light hover:underline hover:underline-offset-4"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/media"
                  className="transition hover:text-gold-light hover:underline hover:underline-offset-4"
                >
                  Press &amp; Media
                </Link>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-gold-light">Reservations</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-cream/50">Toll Free</dt>
                <dd className="mt-0.5">
                  <ContactLink
                    method="phone"
                    href={contactNumbers.tollFreeHref}
                    ctaSource="footer"
                    className="transition hover:text-gold-light"
                  >
                    {contactNumbers.tollFree}
                  </ContactLink>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-cream/50">Enquiries</dt>
                <dd className="mt-0.5">
                  <Link href="/enquiry" className="transition hover:text-gold-light">
                    Send an enquiry
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-cream/50">WhatsApp</dt>
                <dd className="mt-0.5">
                  <a
                    href={contactNumbers.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-gold-light"
                  >
                    {contactNumbers.whatsapp}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-6 py-6 pb-24 text-center text-xs text-cream/50 sm:flex-row sm:justify-between sm:pb-6 sm:text-left">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p>Always book through this official website for the best available rate.</p>
        </div>
      </div>
    </footer>
  );
}
