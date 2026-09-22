import { UserForm, type UserFormValues } from '@/components/admin/user-form';
import { UserRowActions } from '@/components/admin/user-row-actions';
import { getHotelBySlug, hotels } from '@/content/hotels';
import { formatDate } from '@/lib/admin-format';
import { can, getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SECTIONS, SECTION_LABELS, type Section, isSection } from '@/lib/roles';
import type { SectionLevel } from '@prisma/client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PROPERTIES = hotels.map((hotel) => ({ slug: hotel.slug, name: hotel.name }));

export default async function UsersPage() {
  const viewer = await getSession();
  // The sidebar already hides this, but a hidden link is not a permission —
  // someone typing the URL has to hit the same wall.
  if (!viewer || !can(viewer, 'users:manage')) notFound();

  const users = await prisma.user.findMany({
    include: { hotels: true, grants: true },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <p className="font-display text-xl text-forest">Users</p>
        <p className="mt-1 text-sm text-ink/60">
          Who can sign in, what they may do, and which properties they may do it for.
        </p>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
        <section className="max-w-3xl rounded-lg border border-ink/10 bg-white p-6">
          <p className="font-display text-lg text-forest">Add someone</p>
          <div className="mt-4">
            <UserForm properties={PROPERTIES} />
          </div>
        </section>

        <section className="pb-4">
          <p className="font-display text-lg text-forest">Staff accounts</p>
          <table className="mt-3 w-full border-collapse overflow-hidden rounded-lg bg-white text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink/50">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Sections</th>
                <th className="px-4 py-3 font-medium">Properties</th>
                <th className="px-4 py-3 font-medium">Last signed in</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const grants: Partial<Record<Section, SectionLevel>> = {};
                for (const grant of user.grants) {
                  if (isSection(grant.section)) grants[grant.section] = grant.level;
                }
                const values: UserFormValues = {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  grants,
                  allProperties: user.allProperties,
                  hotels: user.hotels.map((h) => h.hotelSlug),
                };

                return (
                  <tr key={user.id} className="border-b border-ink/5 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-ink/50">{user.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                      {user.role === 'ADMIN' ? 'Admin' : 'User'}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === 'ADMIN' ? (
                        <span className="text-ink/50">Everything</span>
                      ) : SECTIONS.some((section) => grants[section]) ? (
                        <div className="flex flex-wrap gap-1">
                          {SECTIONS.filter((section) => grants[section]).map((section) => (
                            <span
                              key={section}
                              className={`rounded px-1.5 py-0.5 text-[11px] ${
                                grants[section] === 'EDIT'
                                  ? 'bg-forest/10 text-forest'
                                  : 'bg-ink/[0.06] text-ink/60'
                              }`}
                            >
                              {SECTION_LABELS[section]}
                              <span className="opacity-60">
                                {grants[section] === 'EDIT' ? ' · edit' : ' · view'}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink/40">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink/70">
                      {user.role === 'ADMIN' || user.allProperties ? (
                        <span>
                          All properties
                          <span className="block text-xs text-ink/45">including new ones</span>
                        </span>
                      ) : user.hotels.length > 0 ? (
                        user.hotels
                          .map((h) => getHotelBySlug(h.hotelSlug)?.name ?? h.hotelSlug)
                          .join(', ')
                      ) : (
                        <span className="text-ink/40">None</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {!user.active ? (
                        <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink/60">
                          Deactivated
                        </span>
                      ) : user.passwordHash ? (
                        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-forest">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold-dark">
                          Awaiting setup
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserRowActions user={values} active={user.active} properties={PROPERTIES} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
