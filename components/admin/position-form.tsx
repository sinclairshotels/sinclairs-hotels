'use client';

import { type CareersState, savePosition } from '@/app/admin/(dashboard)/careers/actions';
import { CV_ACCEPT_ATTRIBUTE } from '@/lib/careers-storage';
import { useActionState } from 'react';

const initial: CareersState = { status: 'idle' };

export function PositionForm({
  properties,
}: {
  properties: Array<{ slug: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(savePosition, initial);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink/60">Title</span>
          <input name="title" type="text" required maxLength={120} className="input mt-1 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink/60">Property</span>
          {/* A dense admin row, like the enquiries assignee: the site-wide rule
              against native selects is about guest-facing forms. */}
          <select name="hotelSlug" defaultValue="" className="select mt-1 text-sm">
            <option value="">Across the group</option>
            {properties.map((property) => (
              <option key={property.slug} value={property.slug}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink/60">Department</span>
          <input
            name="department"
            type="text"
            required
            maxLength={80}
            placeholder="Front Office"
            className="input mt-1 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-ink/60">
          Job description — type it
        </span>
        <textarea name="descriptionText" rows={4} maxLength={8000} className="input mt-1 text-sm" />
      </label>

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-ink/60">
          …or upload one (PDF or Word, up to 5 MB)
        </span>
        <input
          name="jd"
          type="file"
          accept={CV_ACCEPT_ATTRIBUTE}
          className="mt-1 block w-full text-sm text-ink/70 file:mr-3 file:rounded file:border file:border-forest/30 file:bg-white file:px-3 file:py-1.5 file:text-xs file:uppercase file:tracking-wider file:text-forest"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input name="open" type="checkbox" className="h-4 w-4" />
        Open — show this on the careers page
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-forest px-4 py-2 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Add position'}
        </button>
        {state.message && (
          <p
            className={`text-xs ${state.status === 'error' ? 'text-red-700' : 'text-forest'}`}
            aria-live="polite"
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
