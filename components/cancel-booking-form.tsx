'use client';

import { type CancelState, cancelOwnBooking } from '@/app/(site)/booking/[token]/actions';
import { useActionState, useState } from 'react';

const initial: CancelState = { status: 'idle' };

// Two steps, like the admin's own cancel button. A single click that releases a
// room and starts a refund is too easy to hit by accident on a phone, and this
// page is one a guest opens from an email they may be skim-reading.
export function CancelBookingForm({
  token,
  refundable,
  amount,
}: {
  token: string;
  refundable: boolean;
  amount: string;
}) {
  const [state, formAction, pending] = useActionState(cancelOwnBooking, initial);
  const [armed, setArmed] = useState(false);

  if (state.status === 'success') {
    return (
      <p className="mt-6 rounded border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-forest">
        {state.message}
      </p>
    );
  }

  return (
    <div className="mt-8 border-t border-ink/10 pt-6">
      {state.status === 'error' && state.message && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      {armed ? (
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="token" value={token} />
          <p className="w-full text-sm text-ink/70">
            {refundable
              ? `Cancel this booking? ${amount} will be refunded to your original payment method.`
              : 'Cancel this booking? No refund is due, and the rooms will be released.'}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-red-700 px-5 py-2 text-xs uppercase tracking-wider text-white transition hover:bg-red-800 disabled:opacity-60"
          >
            {pending ? 'Cancelling…' : 'Yes, cancel it'}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="text-xs uppercase tracking-wider text-ink/50 hover:text-ink"
          >
            Keep my booking
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-xs leading-relaxed text-ink/60">
            {refundable
              ? `Cancel now and ${amount} comes back to you in full.`
              : 'This booking can be cancelled, but no refund is due on it.'}
          </p>
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="text-xs uppercase tracking-wider text-red-700 underline transition hover:text-red-900"
          >
            Cancel this booking
          </button>
        </div>
      )}
    </div>
  );
}
