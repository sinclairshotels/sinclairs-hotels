'use client';

import {
  type RecipientState,
  addRecipient,
  removeRecipient,
} from '@/app/admin/(dashboard)/recipients/actions';
import type { NotificationField } from '@prisma/client';
import { useActionState, useState } from 'react';

const initial: RecipientState = { status: 'idle' };

const FIELDS: Array<{ field: NotificationField; label: string }> = [
  { field: 'TO', label: 'To' },
  { field: 'CC', label: 'CC' },
  { field: 'BCC', label: 'BCC' },
];

export interface RecipientRow {
  id: string;
  hotelSlug: string | null;
  field: NotificationField;
  address: string;
}

// Collapsed by default. It is a setting somebody changes twice a year, on a
// page whose actual work is a list of bookings — open it and it would push
// that list down the screen every day for the sake of two days a year.
export function EmailRecipientsPanel({
  kind,
  label,
  perProperty,
  properties,
  rows,
  fallback,
}: {
  kind: string;
  label: string;
  perProperty: boolean;
  properties: Array<{ slug: string; name: string }>;
  rows: RecipientRow[];
  // Where this page's mail goes while To is empty, so nobody has to guess.
  // Null where the list has no fallback by design.
  fallback: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string>('');
  const [addState, addAction, adding] = useActionState(addRecipient, initial);
  const [removeState, removeAction] = useActionState(removeRecipient, initial);

  const slug = perProperty && scope ? scope : null;
  const inScope = rows.filter((row) => row.hotelSlug === slug);
  const state = addState.message ? addState : removeState;

  return (
    <aside className="rounded-lg border border-ink/10 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-ink">Email recipients</span>
        <span className="text-xs text-ink/50">
          {rows.length === 0 ? 'Not set' : `${rows.length}`} {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="border-t border-ink/10 px-4 py-3">
          <p className="text-xs text-ink/55">Who is emailed about {label.toLowerCase()}.</p>

          {perProperty && (
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              aria-label="Property this list applies to"
              className="select mt-3 w-full py-1.5 text-sm"
            >
              <option value="">Central — every property</option>
              {properties.map((property) => (
                <option key={property.slug} value={property.slug}>
                  {property.name}
                </option>
              ))}
            </select>
          )}

          {FIELDS.map(({ field, label: fieldLabel }) => {
            const addresses = inScope.filter((row) => row.field === field);
            return (
              <div key={field} className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-ink/40">{fieldLabel}</p>
                {addresses.length === 0 ? (
                  <p className="mt-1 text-xs text-ink/40">None</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {addresses.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-ink/80">{row.address}</span>
                        <form action={removeAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            aria-label={`Remove ${row.address} from ${fieldLabel}`}
                            className="text-[10px] uppercase tracking-wider text-red-700 transition hover:text-red-900"
                          >
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                <form action={addAction} className="mt-1 flex gap-1">
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="field" value={field} />
                  <input type="hidden" name="hotelSlug" value={slug ?? ''} />
                  <input
                    type="email"
                    name="address"
                    required
                    placeholder="name@example.com"
                    aria-label={`Add an address to ${fieldLabel}`}
                    className="input min-w-0 flex-1 px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={adding}
                    className="shrink-0 rounded border border-forest/40 px-2 py-1 text-[10px] uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              </div>
            );
          })}

          {/* Said plainly rather than left to be discovered: a list that looks
              empty is still sending mail somewhere. */}
          {inScope.filter((row) => row.field === 'TO').length === 0 && (
            <p className="mt-3 text-xs text-gold-dark">
              {fallback
                ? `With To empty, these go to ${fallback}.`
                : 'With To empty, nobody is emailed.'}
            </p>
          )}

          {state.message && (
            <p
              className={`mt-3 text-xs ${state.status === 'error' ? 'text-red-700' : 'text-forest'}`}
              aria-live="polite"
            >
              {state.message}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
