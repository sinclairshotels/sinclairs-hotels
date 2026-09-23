import Image from 'next/image';

// A clipping is a scan of a newspaper page, not a photograph: cropping one to
// fill a band turns it into unreadable grey texture, so it sits whole
// (object-contain) on a tinted ground, in the same bordered card the rest of
// the site uses. Only a card that has somewhere to go is styled as though it
// does — a hover lift on a dead card promises a destination that isn't there.
export function PressCard({
  title,
  outlet,
  date,
  image,
  url,
}: {
  title: string;
  outlet: string;
  date: string;
  image: string;
  url?: string;
}) {
  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-forest/5">
        <Image
          src={image}
          alt={`${outlet}: ${title}`}
          fill
          sizes="(min-width: 640px) 50vw, 100vw"
          className="object-contain p-3"
        />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="font-display text-lg leading-snug text-ink/90 group-hover:text-forest">
          {title}
        </p>
        <p className="mt-auto pt-4 text-xs uppercase tracking-wider text-ink/50">
          {outlet} &middot; {date}
        </p>
        {url ? (
          <p className="mt-2 text-xs uppercase tracking-wider text-forest">
            {url.startsWith('/images/') ? 'View the clipping' : 'Read the article'} &rarr;
          </p>
        ) : null}
      </div>
    </>
  );

  const shell = 'group flex flex-col overflow-hidden rounded-lg border border-forest/10 bg-white';

  if (!url) return <div className={`${shell} shadow-sm`}>{body}</div>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${shell} shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      {body}
    </a>
  );
}
