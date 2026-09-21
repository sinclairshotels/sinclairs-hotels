'use client';

import { login } from '@/app/admin/login/actions';
import { useActionState } from 'react';

const initialState = { status: 'idle' as const };

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="email" className="text-xs uppercase tracking-wider text-ink/60">
          Email
        </label>
        <div className="mt-1">
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="username"
            className="input"
            aria-invalid={state.status === 'error'}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="text-xs uppercase tracking-wider text-ink/60">
          Password
        </label>
        <div className="mt-1">
          <input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="input"
            aria-invalid={state.status === 'error'}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-forest px-6 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
