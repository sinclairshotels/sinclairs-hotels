// Google's embed is a third-party frame, and every way it can fail looks the
// same from here: a `frame-src` the CSP does not allow, an ad blocker, a network
// that refuses maps.google.com, Google declining the keyless endpoint. Each one
// leaves the browser's own error page — a grey rectangle with no address and
// nowhere to click.
//
// Detecting that from script is not possible: a refused frame and a real map
// both report an opaque cross-origin document, which is why there is no
// onLoad probe here and adding one would not work. So the address and the link
// to Google Maps are the box, and the frame is drawn over them only where an
// environment has been told the embed renders (NEXT_PUBLIC_MAPS_EMBED=on, see
// lib/maps.ts). Everywhere else the box is still useful.
export function LocationMap({
  address,
  query,
  embedUrl,
  title,
  enabled = false,
}: {
  address: string;
  query: string;
  embedUrl?: string;
  title: string;
  enabled?: boolean;
}) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-lg border border-forest/10 bg-forest/5 shadow-md">
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 p-8 text-center">
        <PinIcon />
        <p className="max-w-xs text-sm leading-relaxed text-ink/80">{address}</p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-forest px-5 py-2.5 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark"
        >
          Open in Google Maps
        </a>
      </div>

      {embedUrl && enabled && (
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          className="absolute inset-0 h-full w-full"
        />
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 stroke-current stroke-[1.4] text-gold"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
