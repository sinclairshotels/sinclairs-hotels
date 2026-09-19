import type { ReactNode } from 'react';

// One heading for every section on the site. Before this each section chose its
// own size, eyebrow colour and gap, so headings down a hotel page neither lined
// up nor matched each other. Pass content, not classes: the scale lives here so
// changing it changes every page at once.
export function SectionHeading({
  eyebrow,
  title,
  lede,
  tone = 'light',
  align = 'left',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  tone?: 'light' | 'dark';
  align?: 'left' | 'center';
  className?: string;
}) {
  const dark = tone === 'dark';
  const centered = align === 'center';

  return (
    <div className={`${centered ? 'text-center' : ''} ${className ?? ''}`.trim()}>
      {eyebrow && (
        <p
          className={`text-xs uppercase tracking-[0.3em] ${dark ? 'text-gold' : 'text-gold-dark'}`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`font-display text-3xl sm:text-4xl ${dark ? 'text-cream' : 'text-forest'} ${
          eyebrow ? 'mt-3' : ''
        }`}
      >
        {title}
      </h2>
      {lede && (
        <p
          className={`mt-4 max-w-2xl text-sm leading-relaxed ${
            centered ? 'mx-auto' : ''
          } ${dark ? 'text-cream/70' : 'text-ink/70'}`}
        >
          {lede}
        </p>
      )}
    </div>
  );
}
