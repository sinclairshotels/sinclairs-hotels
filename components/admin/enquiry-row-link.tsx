'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

// The row opens the enquiry, except where the click landed on one of the
// controls the row carries — the assignee select and the status buttons act in
// place, and navigating away from them would throw the click away.
export function EnquiryRowLink({
  href,
  className,
  children,
}: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();

  return (
    <tr
      className={className}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('form, button, select, input, textarea, a')) return;
        router.push(href);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter') router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
