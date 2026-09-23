import { BackLink } from '@/components/admin/back-link';
import { VoucherForm } from '@/components/admin/voucher-form';
import { hotels } from '@/content/hotels';
import { bookingOffices } from '@/content/site';
import { can, getSession } from '@/lib/auth';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function NewVoucherPage() {
  // createVoucher authorizes on its own, so nothing could be written from
  // here — but the page itself had no check, and a hidden nav link is
  // presentation, never a permission.
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'vouchers:write')) notFound();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <BackLink href="/admin/vouchers" label="All vouchers" />
        <p className="mt-2 font-display text-xl text-forest">New voucher</p>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pb-6 pr-1">
        <VoucherForm hotels={hotels} bookingOffices={bookingOffices} />
      </div>
    </div>
  );
}
