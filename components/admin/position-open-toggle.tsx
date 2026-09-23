'use client';

import { type CareersState, setPositionOpen } from '@/app/admin/(dashboard)/careers/actions';
import { useActionState } from 'react';

const initial: CareersState = { status: 'idle' };

// A one-click switch rather than a form: opening and closing is the edit staff
// make most, and it is the one that changes what the public site shows.
export function PositionOpenToggle({ id, open }: { id: string; open: boolean }) {
  const [state, formAction, pending] = useActionState(setPositionOpen, initial);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="open" value={String(!open)} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-forest/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream disabled:opacity-50"
      >
        {pending ? '…' : open ? 'Close' : 'Open'}
      </button>
      {state.status === 'error' && state.message && (
        <span className="text-[10px] text-red-700">{state.message}</span>
      )}
    </form>
  );
}
