import Link from 'next/link';

// Every admin sub-page gets one. The sidebar reaches the section but not the
// list a record came from, so without this the only way back from a voucher or
// a booking is the browser's own button.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink/50 transition hover:text-forest"
    >
      <span aria-hidden="true">&larr;</span> {label}
    </Link>
  );
}
