'use client';

import { setPassword } from '@/app/admin/login/actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-shared';
import { useActionState } from 'react';

const initialState = { status: 'idle' as const };

export function SetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(setPassword, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="password" className="text-xs uppercase tracking-wider text-ink/60">
          New password
        </label>
        <div className="mt-1">
          <input
            id="password"
            type="password"
            name="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="input"
          />
        </div>
        <p className="mt-1 text-xs text-ink/50">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="text-xs uppercase tracking-wider text-ink/60">
          Confirm password
        </label>
        <div className="mt-1">
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="input"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-forest px-6 py-3 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Set Password'}
      </button>
    </form>
  );
}
