'use client';

import { type UserFormState, createUser } from '@/app/admin/(dashboard)/users/actions';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useState } from 'react';
import { useActionState } from 'react';

const initialState: UserFormState = { status: 'idle' };

const ROLES = [
  { value: 'ADMIN', label: 'Admin', blurb: 'Everything, including users and refunds.' },
  { value: 'REVENUE', label: 'Revenue', blurb: 'Rates, setup and reports. No bookings.' },
  { value: 'RESERVATIONS', label: 'Reservations', blurb: 'Bookings and the STAAH queue.' },
  { value: 'HOTEL', label: 'Hotel', blurb: 'Their own property only. No rate editing.' },
  { value: 'VIEWER', label: 'Viewer', blurb: 'Read-only.' },
];

export function UserForm({ properties }: { properties: Array<{ slug: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createUser, initialState);
  const [role, setRole] = useState('RESERVATIONS');

  if (state.status === 'success' && state.setupUrl) {
    return (
      <div className="rounded-lg border border-forest/30 bg-forest/5 p-6">
        <p className="font-display text-lg text-forest">{state.message}</p>
        <p className="mt-3 text-xs uppercase tracking-wider text-ink/60">Setup link</p>
        <code className="mt-1 block break-all rounded border border-ink/10 bg-white px-3 py-2 text-sm text-ink">
          {state.setupUrl}
        </code>
        <p className="mt-2 text-xs leading-relaxed text-ink/60">
          Nobody knows their password, including you — they choose it themselves through this link.
          It works once. If it is lost, deactivate the account and add them again.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="role" value={role} />

      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-xs uppercase tracking-wider text-ink/60">
            Name
          </label>
          <input id="name" name="name" type="text" required className="input mt-1" />
          {state.fieldErrors?.name?.[0] && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="text-xs uppercase tracking-wider text-ink/60">
            Email
          </label>
          <input id="email" name="email" type="email" required className="input mt-1" />
          {state.fieldErrors?.email?.[0] && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.email[0]}</p>
          )}
        </div>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wider text-ink/60">Role</span>
        <div className="mt-1">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger />
            <SelectContent>
              {ROLES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="mt-1 text-xs text-ink/50">
          {ROLES.find((option) => option.value === role)?.blurb}
        </p>
      </div>

      <fieldset>
        <legend className="text-xs uppercase tracking-wider text-ink/60">Properties</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {properties.map((property) => (
            <label
              key={property.slug}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition has-[:checked]:border-forest has-[:checked]:bg-forest/5 has-[:checked]:text-forest"
            >
              <input
                type="checkbox"
                name="hotelSlugs"
                value={property.slug}
                className="h-3.5 w-3.5"
              />
              {property.name}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink/50">
          Leave all unticked for the central team — that means every property. A Hotel user must
          have at least one.
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add User'}
      </button>
    </form>
  );
}
