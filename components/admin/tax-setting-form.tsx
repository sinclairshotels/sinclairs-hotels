'use client';

import { type TaxState, saveTaxSetting } from '@/app/admin/(dashboard)/tax/actions';
import { DatePicker } from '@/components/ui/date-picker';
import { useActionState, useState } from 'react';

const initial: TaxState = { status: 'idle' };

export interface TaxSlabValues {
  threshold: number;
  lowRate: number;
  highRate: number;
  effectiveFrom: string;
}

export function TaxSettingForm({
  current,
  saved,
}: {
  current: TaxSlabValues;
  saved: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveTaxSetting, initial);
  const [effectiveFrom, setEffectiveFrom] = useState(current.effectiveFrom);

  return (
    <form action={formAction} className="rounded-lg border border-ink/10 bg-white p-6">
      <input type="hidden" name="effectiveFrom" value={effectiveFrom} />

      {!saved && (
        <p className="mb-4 rounded border border-gold/50 bg-gold/10 px-4 py-3 text-xs text-ink/70">
          Nothing has been saved yet, so quotes use the values below. Saving records who set them
          and when.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Threshold ₹ per room per night">
          <input
            type="number"
            min={0}
            name="threshold"
            defaultValue={current.threshold}
            aria-label="Threshold"
            className="input"
          />
        </Field>
        <Field label="Takes effect from">
          <DatePicker value={effectiveFrom} onChange={setEffectiveFrom} />
        </Field>
        <Field label="Rate at or below the threshold %">
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            name="lowRate"
            defaultValue={current.lowRate}
            aria-label="Lower rate percent"
            className="input"
          />
        </Field>
        <Field label="Rate above the threshold %">
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            name="highRate"
            defaultValue={current.highRate}
            aria-label="Higher rate percent"
            className="input"
          />
        </Field>
      </div>

      <p className="mt-3 text-xs text-ink/50">
        The threshold is inclusive: a night at exactly it takes the lower rate. Extra adult and
        child charges count toward the night&rsquo;s value. Changing this never alters a booking
        already taken — each one stores the tax it was priced with.
      </p>

      {state.message && (
        <p
          className={`mt-4 rounded border px-4 py-3 text-sm ${
            state.status === 'error'
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-forest/30 bg-forest/5 text-forest'
          }`}
          aria-live="polite"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save tax rates'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-wider text-ink/60">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}
