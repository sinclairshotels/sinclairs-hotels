'use client';

import {
  type EnquiryActionState,
  addNotificationEmail,
  removeNotificationEmail,
} from '@/app/admin/(dashboard)/enquiries/actions';
import { useActionState, useState } from 'react';

const initial: EnquiryActionState = { status: 'idle' };

export interface NotificationAddress {
  id: string;
  hotelSlug: string | null;
  kind: 'GENERAL' | 'CANCELLATION' | 'CAREERS';
  address: string;
}

// Admin-only. Who gets told about an enquiry is a different decision from who
// may read one, which is why this is not one of the grantable sections.
export function NotificationEmailsPanel({
  properties,
  addresses,
  fallbacks,
}: {
  properties: Array<{ slug: string; name: string }>;
  addresses: NotificationAddress[];
  // What each list falls back to while it is empty — the content files and
  // STAFF_NOTIFY_EMAIL. Shown so nobody has to guess where mail is going today.
  fallbacks: { central: string; perHotel: Record<string, string> };
}) {
  const [open, setOpen] = useState(false);
  const [addState, addAction, addPending] = useActionState(addNotificationEmail, initial);
  const [removeState, removeAction] = useActionState(removeNotificationEmail, initial);

  const forList = (slug: string | null, kind: 'GENERAL' | 'CANCELLATION' | 'CAREERS') =>
    addresses.filter((a) => a.hotelSlug === slug && a.kind === kind);

  const lists: Array<{
    slug: string | null;
    kind: 'GENERAL' | 'CANCELLATION' | 'CAREERS';
    name: string;
    fallback: string | null;
  }> = [
    { slug: null, kind: 'GENERAL', name: 'Central', fallback: fallbacks.central },
    ...properties.map((p) => ({
      slug: p.slug,
      kind: 'GENERAL' as const,
      name: p.name,
      fallback: fallbacks.perHotel[p.slug] ?? fallbacks.central,
    })),
    // Deliberately last and deliberately without a fallback: an empty
    // cancellations list means nobody asked for the copy, and inventing a
    // recipient for money news would be worse than sending none.
    {
      slug: null,
      kind: 'CANCELLATION' as const,
      name: 'Cancellations (finance)',
      fallback: null,
    },
    { slug: null, kind: 'CAREERS' as const, name: 'Careers (HR)', fallback: null },
  ];

  return (
    <section className="rounded-lg border border-ink/10 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span>
          <span className="font-display text-base text-forest">Notification emails</span>
          <span className="ml-2 text-xs text-ink/50">
            {addresses.length === 0
              ? 'none set — using the addresses in the content files'
              : `${addresses.length} set`}
          </span>
        </span>
        <span className="text-xs uppercase tracking-wider text-ink/50">
          {open ? 'Close' : 'Open'}
        </span>
      </button>

      {open && (
        <div className="border-t border-ink/10 px-5 py-4">
          {(addState.status === 'error' || removeState.status === 'error') && (
            <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {addState.message ?? removeState.message}
            </p>
          )}
          <p className="mb-4 text-xs leading-relaxed text-ink/60">
            Enquiry and booking emails go to the central list <em>and</em> the property&rsquo;s own
            list. A list with nothing in it falls back to the address in the content files, shown in
            grey, so these can be filled in one property at a time. Cancellations are different:
            finance is copied only when a cancellation actually owes money, and an empty list means
            nobody is copied.
          </p>

          <div className="space-y-4">
            {lists.map((list) => {
              const rows = forList(list.slug, list.kind);
              return (
                <div
                  key={`${list.kind}:${list.slug ?? 'central'}`}
                  className="rounded border border-ink/10 p-3"
                >
                  <p className="text-xs uppercase tracking-wider text-ink/60">{list.name}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {rows.length === 0 ? (
                      <span className="text-sm text-ink/40">
                        {list.fallback ? `${list.fallback} (from content)` : 'Nobody is copied'}
                      </span>
                    ) : (
                      rows.map((row) => (
                        <form key={row.id} action={removeAction} className="inline-flex">
                          <input type="hidden" name="id" value={row.id} />
                          <span className="inline-flex items-center gap-1.5 rounded border border-forest/25 bg-forest/5 px-2.5 py-1 text-sm text-forest">
                            {row.address}
                            <button
                              type="submit"
                              aria-label={`Remove ${row.address}`}
                              className="text-forest/50 transition hover:text-red-600"
                            >
                              ×
                            </button>
                          </span>
                        </form>
                      ))
                    )}
                  </div>

                  <form action={addAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="hotelSlug" value={list.slug ?? ''} />
                    <input type="hidden" name="kind" value={list.kind} />
                    <input
                      name="address"
                      type="email"
                      required
                      placeholder="add an address"
                      className="input max-w-xs flex-1 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={addPending}
                      className="rounded border border-forest/30 px-3 py-1.5 text-xs uppercase tracking-wider text-forest transition hover:bg-forest/5 disabled:opacity-60"
                    >
                      Add
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
