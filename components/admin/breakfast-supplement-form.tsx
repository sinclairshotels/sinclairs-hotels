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
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="hotelSlug" value={hotelSlug} />
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-ink/60">
          Breakfast supplement per person per night ₹
        </span>
        <input
          type="number"
          min={0}
          name="breakfastSupplement"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Breakfast supplement per person per night"
          className="input mt-1 w-32 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending || value === String(amount)}
        className="rounded border border-forest/40 px-3 py-1.5 text-xs uppercase tracking-wider text-forest transition hover:bg-forest hover:text-cream disabled:opacity-40"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      <p className="w-full text-xs text-ink/50">
        With Breakfast is Room Only plus this, times the room&rsquo;s base guests. It has no
        calendar of its own.
      </p>
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
