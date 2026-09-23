'use client';

import { type SetupState, saveHotelSetup } from '@/app/admin/(dashboard)/rates/room-actions';
import { useActionState, useState } from 'react';

const initial: SetupState = { status: 'idle' };

export function BreakfastSupplementForm({
  hotelSlug,
  amount,
}: {
  hotelSlug: string;
  amount: number;
}) {
  const [state, formAction, pending] = useActionState(saveHotelSetup, initial);
  const [value, setValue] = useState(String(amount));

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="hotelSlug" value={hotelSlug} />
      <label htmlFor="breakfastSupplement" className="shrink-0 text-sm text-ink/70">
        Breakfast supplement ₹
      </label>
      <input
        id="breakfastSupplement"
        type="number"
        min={0}
        name="breakfastSupplement"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Breakfast supplement per person per night"
        title="Per person per night. With Breakfast is Room Only plus this, times the room's base guests."
        className="input w-24 shrink-0 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending || value === String(amount)}
        className="shrink-0 rounded border border-forest/40 px-3 py-1.5 text-xs uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state.message && (
        <p
          className={`text-xs ${state.status === 'error' ? 'text-red-700' : 'text-forest'}`}
          aria-live="polite"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
