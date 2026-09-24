import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

// The real authentication gate. proxy.ts only checks that a cookie exists —
// it runs on the edge and cannot reach the database — so whether that cookie
// still names a live session, belonging to an account that is still active and
// inside both the idle and absolute timeouts, is decided here.
export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/admin/login');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white lg:flex-row">
      <AdminSidebar user={user} />
      {/* The shell scrolls, so a page that is simply long — the voucher form —
          needs no scrolling box of its own. Screens with a sticky table header
          still make their own inner scroller; this only decides what happens
          to a page that overflows without one. */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
