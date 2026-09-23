'use client';

import { type ApplicationState, submitApplication } from '@/app/(site)/careers/actions';
import { CV_ACCEPT_ATTRIBUTE } from '@/lib/careers-storage';
import { useActionState, useState } from 'react';

const initial: ApplicationState = { status: 'idle' };

export function ApplyForm({
  positionId,
  positionLabel,
}: {
  // Absent for the talent pool, which is the form the page still offers when
  // nothing is open.
  positionId?: string;
  positionLabel: string;
}) {
  const [state, formAction, pending] = useActionState(submitApplication, initial);
  const [open, setOpen] = useState(false);

  if (state.status === 'success') {
    return (
      <p className="mt-4 rounded border border-forest/30 bg-forest/5 px-4 py-3 text-sm text-forest">
        {state.message}
      </p>
    );
  }

  const fieldError = (field: string) => state.fieldErrors?.[field]?.[0];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-block rounded bg-forest px-5 py-2.5 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark"
      >
        {positionId ? 'Apply now' : 'Send your CV'}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-4 border-t border-ink/10 pt-4">
      {positionId && <input type="hidden" name="positionId" value={positionId} />}

      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.message}
        </p>
      )}

      <p className="text-xs uppercase tracking-wider text-ink/50">Applying for {positionLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Your name" name={`name-${positionId ?? 'pool'}`} error={fieldError('name')}>
          <input
            id={`name-${positionId ?? 'pool'}`}
            name="name"
            type="text"
            required
            autoComplete="name"
            className="input"
          />
        </Field>
        <Field label="Email" name={`email-${positionId ?? 'pool'}`} error={fieldError('email')}>
          <input
            id={`email-${positionId ?? 'pool'}`}
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
          />
        </Field>
        <Field label="Phone" name={`phone-${positionId ?? 'pool'}`} error={fieldError('phone')}>
          <input
            id={`phone-${positionId ?? 'pool'}`}
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            className="input"
          />
        </Field>
        <Field label="City" name={`city-${positionId ?? 'pool'}`} error={fieldError('city')}>
          <input
            id={`city-${positionId ?? 'pool'}`}
            name="city"
            type="text"
            autoComplete="address-level2"
            className="input"
          />
        </Field>
      </div>

      <Field label="Your CV" name={`cv-${positionId ?? 'pool'}`} error={fieldError('cv')}>
        <input
          id={`cv-${positionId ?? 'pool'}`}
          name="cv"
          type="file"
          accept={CV_ACCEPT_ATTRIBUTE}
          className="block w-full text-sm text-ink/70 file:mr-3 file:rounded file:border file:border-forest/30 file:bg-white file:px-3 file:py-1.5 file:text-xs file:uppercase file:tracking-wider file:text-forest"
        />
        <p className="mt-1 text-xs text-ink/50">PDF or Word, up to 5 MB.</p>
      </Field>

      <Field
        label="Anything you would like to add"
        name={`message-${positionId ?? 'pool'}`}
        error={fieldError('message')}
      >
        <textarea
          id={`message-${positionId ?? 'pool'}`}
          name="message"
          rows={3}
          className="input"
        />
      </Field>

      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-forest px-5 py-2.5 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send application'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs uppercase tracking-wider text-ink/50 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-xs uppercase tracking-wider text-ink/60">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
