import { RecipientsTable } from '@/components/admin/recipients-table';
import { hotels } from '@/content/hotels';
import { can, getSession } from '@/lib/auth';
import { allRecipients } from '@/lib/notification-emails';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function RecipientsPage() {
  const viewer = await getSession();
  // Admin-only, and deliberately not a grantable section: who gets told about
  // a booking is a different decision from who may read one.
  if (!viewer || !can(viewer, 'users:manage')) notFound();

  const properties = hotels.map((hotel) => ({ slug: hotel.slug, name: hotel.name }));
  const lists = await allRecipients(properties.map((property) => property.slug));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Email recipients</p>
        <p className="mt-1 text-sm text-ink/60">Who is emailed about each kind of message.</p>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-auto pb-6 pr-1">
        <RecipientsTable lists={lists} properties={properties} />
      </div>
    </div>
  );
}
