import { VOUCHER_TERMS_HTML } from '@/content/legal';
import { pageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = pageMetadata({
  title: 'Terms and Conditions',
  description:
    'Booking terms, check-in and check-out times, cancellation policy and guest conditions for Sinclairs Hotels & Resorts.',
  path: '/terms',
});

// The same block the voucher carries, rendered here so the confirmation page
// and the confirmation email have somewhere real to send a guest. It is one
// source rather than two: a terms page that restated the voucher in its own
// words would be a second policy the moment either was edited.
//
// dangerouslySetInnerHTML is safe here and only here: the content is a string
// literal in content/legal.ts, developer-authored, with no request input
// anywhere near it.
export default function TermsPage() {
  return (
    <section className="bg-cream px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">Legal</p>
        <h1 className="mt-3 font-display text-4xl text-forest">Terms and Conditions</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/70">
          These terms apply to every booking made with Sinclairs Hotels &amp; Resorts, and are the
          same terms printed on your voucher.
        </p>

        <div
          className="mt-10 rounded-xl border border-ink/10 bg-white p-8 shadow-sm"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static developer-authored legal copy, see comment above
          dangerouslySetInnerHTML={{ __html: VOUCHER_TERMS_HTML }}
        />
      </div>
    </section>
  );
}
