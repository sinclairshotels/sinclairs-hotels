'use client';

import { type SetupState, saveHotelSetup } from '@/app/admin/(dashboard)/rates/room-actions';
import { useActionState, useState } from 'react';

const initial: SetupState = { status: 'idle' };

// Breakfast and the refundable-rate policy are one form because they are one
// row: saving them separately would let a property sit with half a policy
// written while the other half was still on screen.
export function HotelSetupForm({
  hotelSlug,
  amount,
  refundableUpliftPct,
  freeCancellationDays,
}: {
  hotelSlug: string;
  amount: number;
  refundableUpliftPct: number | null;
  freeCancellationDays: number | null;
}) {
  const [state, formAction, pending] = useActionState(saveHotelSetup, initial);
  const [breakfast, setBreakfast] = useState(String(amount));
  const [uplift, setUplift] = useState(
    refundableUpliftPct === null ? '' : String(refundableUpliftPct),
  );
  const [days, setDays] = useState(
    freeCancellationDays === null ? '' : String(freeCancellationDays),
  );

  const unchanged =
    breakfast === String(amount) &&
    uplift === (refundableUpliftPct === null ? '' : String(refundableUpliftPct)) &&
    days === (freeCancellationDays === null ? '' : String(freeCancellationDays));

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <input type="hidden" name="hotelSlug" value={hotelSlug} />

      <label htmlFor="breakfastSupplement" className="shrink-0 text-sm text-ink/70">
        Breakfast supplement ₹
      </label>
      <input
        id="breakfastSupplement"
        type="number"
        min={0}
        name="breakfastSupplement"
        value={breakfast}
        onChange={(event) => setBreakfast(event.target.value)}
        aria-label="Breakfast supplement per person per night"
        className="input w-24 shrink-0 py-1.5 text-sm"
      />

      <label htmlFor="refundableUpliftPct" className="shrink-0 text-sm text-ink/70">
        Refundable rate uplift %
      </label>
      <input
        id="refundableUpliftPct"
        type="number"
        min={0}
        max={100}
        step="0.01"
        name="refundableUpliftPct"
        value={uplift}
        onChange={(event) => setUplift(event.target.value)}
        placeholder="—"
        aria-label="Refundable rate uplift percent on the room only price"
        className="input w-20 shrink-0 py-1.5 text-sm"
      />

      <label htmlFor="freeCancellationDays" className="shrink-0 text-sm text-ink/70">
        Free cancellation until
      </label>
      <input
        id="freeCancellationDays"
        type="number"
        min={0}
        max={365}
        name="freeCancellationDays"
        value={days}
        onChange={(event) => setDays(event.target.value)}
        placeholder="—"
        aria-label="Free cancellation until this many days before check-in"
        className="input w-20 shrink-0 py-1.5 text-sm"
      />
      <span className="shrink-0 text-sm text-ink/70">days before check-in</span>

      <button
        type="submit"
        disabled={pending || unchanged}
        className="shrink-0 rounded border border-forest/40 px-3 py-1.5 text-xs uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>

      {state.message && (
        <p
          className={`w-full text-xs ${state.status === 'error' ? 'text-red-700' : 'text-forest'}`}
          aria-live="polite"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
