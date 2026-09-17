'use client';

import { type SetupState, addRoomType } from '@/app/admin/(dashboard)/rates/room-actions';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initial: SetupState = { status: 'idle' };

export function AddRoomTypeRow({ hotelSlug }: { hotelSlug: string }) {
  const [state, formAction, pending] = useActionState(addRoomType, initial);
  const [name, setName] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      setName('');
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <div className="rounded-lg border border-dashed border-ink/25 bg-white p-4">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="hotelSlug" value={hotelSlug} />
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-ink/60">Add room type</span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Garden Cottage"
            aria-label="New room type name"
            className="input mt-1 w-64 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending || name.trim().length < 2}
          className="rounded bg-forest px-4 py-1.5 text-sm text-cream transition hover:bg-forest-dark disabled:opacity-40"
        >
          {pending ? 'Adding…' : 'Add'}
        </button>
        <p className="w-full text-xs text-ink/50">
          It goes on sale once a month has rates. The website shows no photograph for it until one
          is added to the content files.
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
    </div>
  );
}
