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
  kind: string;
  hotelSlug: string | null;
  field: NotificationField;
  address: string;
}

export interface RecipientList {
  kind: string;
  label: string;
  rows: RecipientRow[];
  // What an empty To still reaches, or null where nothing is sent at all.
  fallback: string | null;
  hotelFallbacks: Record<string, string>;
}

// One table for every kind of mail the site sends, rather than a panel hidden
// on each page that sends it. Who is emailed about a booking is one decision
// somebody makes once, across all of it — it does not belong scattered behind
// seven collapsed panels.
export function RecipientsTable({
  lists,
  properties,
}: {
  lists: RecipientList[];
  properties: Array<{ slug: string; name: string }>;
}) {
  const [state, addAction, adding] = useActionState(addRecipient, initial);
  const [removeState, removeAction] = useActionState(removeRecipient, initial);
  // Per row: a list is central until somebody picks a property, and each row
  // is looked at on its own.
  const [scope, setScope] = useState<Record<string, string>>({});

  const shown = state.message ? state : removeState;

  return (
    <div className="overflow-hidden rounded-lg border border-ink/10 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-forest text-[11px] uppercase tracking-wide text-cream/90">
          <tr>
            <th className="w-56 px-4 py-3 font-medium">Emails about</th>
            <th className="w-52 px-4 py-3 font-medium">Property</th>
            {FIELDS.map(({ field, label }) => (
              <th key={field} className="px-4 py-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lists.map((list) => {
            const slug = scope[list.kind] ?? '';
            const inScope = list.rows.filter((row) => (row.hotelSlug ?? '') === slug);
            const fallback = slug ? (list.hotelFallbacks[slug] ?? list.fallback) : list.fallback;

            return (
              <tr key={list.kind} className="border-b border-ink/10 align-top last:border-0">
                <th scope="row" className="px-4 py-4 text-left font-medium text-ink">
                  {list.label}
                </th>
                <td className="px-4 py-4">
                  <select
                    value={slug}
                    onChange={(event) =>
                      setScope((current) => ({ ...current, [list.kind]: event.target.value }))
                    }
                    aria-label={`Property for ${list.label}`}
                    className="select w-full py-1.5 text-sm"
                  >
                    <option value="">Central — every property</option>
                    {properties.map((property) => (
                      <option key={property.slug} value={property.slug}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </td>

                {FIELDS.map(({ field, label }) => {
                  const addresses = inScope.filter((row) => row.field === field);
                  return (
                    <td key={field} className="px-4 py-4">
                      {addresses.length === 0 ? (
                        // Grey, and says where the mail actually goes: a list
                        // that looks empty is still sending somewhere.
                        <p className="text-xs text-ink/40">
                          {field === 'TO' ? (fallback ?? 'Nobody is emailed') : 'None'}
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {addresses.map((row) => (
                            <li key={row.id} className="flex items-center gap-2">
                              <span className="truncate text-xs text-ink/80">{row.address}</span>
                              <form action={removeAction}>
                                <input type="hidden" name="id" value={row.id} />
                                <button
                                  type="submit"
                                  aria-label={`Remove ${row.address} from ${list.label} ${label}`}
                                  className="text-[10px] uppercase tracking-wider text-red-700 transition hover:text-red-900"
                                >
                                  Remove
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form action={addAction} className="mt-1.5 flex gap-1">
                        <input type="hidden" name="kind" value={list.kind} />
                        <input type="hidden" name="field" value={field} />
                        <input type="hidden" name="hotelSlug" value={slug} />
                        <input
                          type="email"
                          name="address"
                          required
                          placeholder="name@example.com"
                          aria-label={`Add an address to ${list.label} ${label}`}
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
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {shown.message && (
        <p
          className={`border-t border-ink/10 px-4 py-2 text-xs ${
            shown.status === 'error' ? 'text-red-700' : 'text-forest'
          }`}
          aria-live="polite"
        >
          {shown.message}
        </p>
      )}
    </div>
  );
}
