import { SectionHeading } from '@/components/section-heading';
import Link from 'next/link';

const reasons = [
  {
    title: 'The best available rate',
    body: 'No agent’s commission sits between you and the room, so the rate here is the lowest we publish.',
  },
  {
    title: 'No booking fee',
    body: 'You pay the room and the tax on it. Nothing is added at the last step.',
  },
  {
    title: 'The hotel reads your request',
    body: 'A late arrival, a quiet floor, a cot in the room — it reaches the property itself, not a call centre.',
  },
  {
    title: 'Confirmed on the spot',
    body: 'Pay securely and your room is held immediately, with the confirmation in your inbox.',
  },
];

export function BookDirect() {
  return (
    <section className="bg-forest-dark py-14 text-cream sm:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          tone="dark"
          align="center"
          eyebrow="Book Direct"
          title="Always Better On This Website"
          lede="Four reasons the same room costs less, and works better, booked here."
        />

        <ul className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason, i) => (
            <li key={reason.title} className="border-t border-gold/40 pt-5">
              <span className="font-display text-sm text-gold-light">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="mt-2 font-display text-xl text-cream">{reason.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-cream/75">{reason.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 text-center">
          <Link
            href="/book"
            className="inline-block rounded bg-gold px-8 py-3.5 text-sm uppercase tracking-wider text-forest-dark transition hover:bg-gold-light"
          >
            Check Rates &amp; Book
          </Link>
        </div>
      </div>
    </section>
  );
}
