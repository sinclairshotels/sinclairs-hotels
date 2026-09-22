'use client';

import { type ToggleUserState, setUserActive } from '@/app/admin/(dashboard)/users/actions';
import { UserForm, type UserFormValues } from '@/components/admin/user-form';
import { useActionState, useState } from 'react';

const initialToggle: ToggleUserState = { status: 'idle' };

// Edit, Deactivate and Reactivate for one account. The form opens in the row
// rather than on its own page: an Admin changing three people's sections
// should not lose the list between each one.
export function UserRowActions({
  user,
  active,
  properties,
}: {
  user: UserFormValues;
  active: boolean;
  properties: Array<{ slug: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [toggleState, toggleAction, togglePending] = useActionState(setUserActive, initialToggle);

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded border border-ink/15 px-3 py-1 text-xs uppercase tracking-wider text-ink/60 transition hover:border-forest/40 hover:text-forest"
        >
          {open ? 'Close' : 'Edit'}
        </button>

        <form action={toggleAction}>
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="active" value={active ? 'false' : 'true'} />
          <button
            type="submit"
            disabled={togglePending}
            className={`rounded border px-3 py-1 text-xs uppercase tracking-wider transition disabled:opacity-60 ${
              active
                ? 'border-ink/15 text-ink/60 hover:border-red-400 hover:text-red-600'
                : 'border-forest/30 text-forest hover:bg-forest/5'
            }`}
          >
            {togglePending ? '…' : active ? 'Deactivate' : 'Reactivate'}
          </button>
        </form>
      </div>

      {toggleState.status === 'error' && toggleState.message && (
        <p className="mt-2 text-right text-xs text-red-600">{toggleState.message}</p>
      )}

      {open && (
        <div className="mt-3 rounded-lg border border-ink/10 bg-white p-5 text-left">
          <UserForm properties={properties} user={user} onDone={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
