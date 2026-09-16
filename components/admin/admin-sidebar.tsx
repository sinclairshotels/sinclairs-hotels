'use client';

import { logout } from '@/app/admin/logout/actions';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Bookings', href: '/admin/bookings' },
  { label: 'Rates', href: '/admin/rates' },
  { label: 'Vouchers', href: '/admin/vouchers' },
  { label: 'Payments', href: '/admin/payments' },
  { label: 'Enquiries', href: '/admin/enquiries' },
  { label: 'Newsletter', href: '/admin/newsletter' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-ink/10 bg-forest text-cream lg:flex">
        <div className="px-5 py-6">
          <img src="/logo.svg" alt="Sinclairs" className="h-7 w-auto" />
          <span className="mt-3 inline-block rounded-full border border-gold/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold-light">
            Internal
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-2 text-sm transition ${
                isActive(item.href)
                  ? 'bg-forest-dark font-medium text-gold-light'
                  : 'text-cream/70 hover:bg-forest-dark/60 hover:text-cream'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-cream/10 px-3 py-4">
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded px-3 py-2 text-left text-xs uppercase tracking-wider text-cream/60 transition hover:bg-forest-dark/60 hover:text-gold-light"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Below lg the fixed sidebar has no room — collapse it into a compact top bar. */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink/10 bg-forest px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-4">
          <img src="/logo.svg" alt="Sinclairs" className="h-6 w-auto shrink-0" />
          <nav className="flex shrink-0 gap-4 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap text-xs uppercase tracking-wider transition ${
                  isActive(item.href) ? 'text-gold-light' : 'text-cream/70 hover:text-cream'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <form action={logout} className="shrink-0">
          <button
            type="submit"
            className="text-xs uppercase tracking-wider text-cream/60 transition hover:text-gold-light"
          >
            Sign Out
          </button>
        </form>
      </header>
    </>
  );
}
