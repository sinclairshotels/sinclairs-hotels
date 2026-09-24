'use client';

import {
  type CancelLinkActionState,
  cancelFromLink,
} from '@/app/(site)/booking/cancel/[token]/actions';
import { useActionState } from 'react';

const initial: CancelLinkActionState = { status: 'idle' };

// One confirmation click, as asked — but the button says what it does rather
// than "Confirm", because this page is opened from an email somebody may be
// reading at a traffic light.
export function CancelLinkForm({ token, refundable }: { token: string; refundable: boolean }) {
  const [state, formAction, pending] = useActionState(cancelFromLink, initial);

  if (state.status === 'success') {
    return (
      <p className="mt-6 rounded border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-forest">
        {state.message}
      </p>
    );
  }

  return (
    <div className="mt-6">
      {state.status === 'error' && state.message && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-red-700 px-6 py-3 text-sm uppercase tracking-wider text-white transition hover:bg-red-800 disabled:opacity-60"
        >
          {pending ? 'Cancelling…' : refundable ? 'Cancel booking and refund me' : 'Cancel booking'}
        </button>
      </form>
      <p className="mt-2 text-center text-xs text-ink/50">This cannot be undone.</p>
    </div>
  );
}
