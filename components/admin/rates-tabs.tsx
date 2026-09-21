import Link from 'next/link';

const TABS = [
  { href: '/admin/rates', label: 'Calendar', hint: 'what is loaded' },
  { href: '/admin/rates/monthly', label: 'Set-up', hint: 'rooms and monthly rates' },
  { href: '/admin/rates/daily', label: 'Daily', hint: 'one night' },
];

export function RatesTabs({ active }: { active: string }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-2" aria-label="Rates screens">
      {TABS.map((tab) => {
        const current = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={`rounded border px-4 py-2 text-sm transition ${
              current
                ? 'border-forest bg-forest text-cream'
                : 'border-ink/15 bg-white text-ink/70 hover:border-forest hover:text-forest'
            }`}
          >
            {tab.label}
            <span className={`ml-2 text-xs ${current ? 'text-cream/70' : 'text-ink/40'}`}>
              {tab.hint}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
