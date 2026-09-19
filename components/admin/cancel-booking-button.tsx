'use client';

import { type CancelBookingState, cancelBooking } from '@/app/admin/(dashboard)/bookings/actions';
import { useActionState, useState } from 'react';

const initialState: CancelBookingState = { status: 'idle' };

// Two-step rather than a native confirm(): cancelling releases a paid room,
// and the rest of this dashboard never uses browser dialogs.
export function CancelBookingButton({ id, reference }: { id: string; reference: string }) {
  const [state, formAction, pending] = useActionState(cancelBooking, initialState);
  const [armed, setArmed] = useState(false);

  if (state.status === 'success') {
    return <span className="text-xs text-forest">Cancelled</span>;
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-xs uppercase tracking-wider text-red-700 transition hover:text-red-900"
      >
        Cancel
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-red-700 px-3 py-1 text-xs uppercase tracking-wider text-white transition hover:bg-red-800 disabled:opacity-60"
        aria-label={`Confirm cancelling booking ${reference}`}
      >
        {pending ? 'Cancelling…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-xs uppercase tracking-wider text-ink/50 hover:text-ink"
      >
        Keep
      </button>
      {state.status === 'error' && state.message && (
        <span className="text-xs text-red-700">{state.message}</span>
      )}
    </form>
  );
}
