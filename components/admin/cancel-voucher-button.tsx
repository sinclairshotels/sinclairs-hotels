'use client';

import { type CancelVoucherState, cancelVoucher } from '@/app/admin/(dashboard)/vouchers/actions';
import { useActionState, useState } from 'react';

const initial: CancelVoucherState = { status: 'idle' };

// Two steps, because the first click has to be recoverable: a voucher is a
// document a guest already has, and cancelling it sends them an email.
export function CancelVoucherButton({
  id,
  voucherNo,
  cancelledReason,
}: {
  id: string;
  voucherNo: number;
  cancelledReason: string | null;
}) {
  const [state, formAction, pending] = useActionState(cancelVoucher, initial);
  const [armed, setArmed] = useState(false);

  if (cancelledReason !== null) {
    return <span className="text-xs text-ink/50">{cancelledReason}</span>;
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
    <form action={formAction} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input
        name="reason"
        required
        maxLength={300}
        placeholder="Why?"
        aria-label={`Reason for cancelling voucher ${voucherNo}`}
        className="input w-36 px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-red-700 px-2 py-1 text-[10px] uppercase tracking-wider text-white transition hover:bg-red-800 disabled:opacity-60"
      >
        {pending ? 'Cancelling…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-[10px] uppercase tracking-wider text-ink/50 hover:text-ink"
      >
        Keep
      </button>
      {state.status === 'error' && state.message && (
        <span className="w-full text-[10px] text-red-700">{state.message}</span>
      )}
    </form>
  );
}
