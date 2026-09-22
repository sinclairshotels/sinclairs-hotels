'use client';

import { type UserFormState, createUser, updateUser } from '@/app/admin/(dashboard)/users/actions';
import { SECTIONS, SECTION_EDIT_NOTES, SECTION_LABELS, type Section } from '@/lib/roles';
import type { SectionLevel } from '@prisma/client';
import { useActionState, useState } from 'react';

const initialState: UserFormState = { status: 'idle' };

export interface UserFormValues {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  grants: Partial<Record<Section, SectionLevel>>;
  allProperties: boolean;
  hotels: string[];
}

type Level = 'none' | SectionLevel;

export function UserForm({
  properties,
  user,
  onDone,
}: {
  properties: Array<{ slug: string; name: string }>;
  // Absent for Add, present for Edit. The same form either way — the sections
  // and properties an Admin is choosing are identical, so two forms would be
  // two places to keep the same rules.
  user?: UserFormValues;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(user ? updateUser : createUser, initialState);
  const [role, setRole] = useState<'ADMIN' | 'USER'>(user?.role ?? 'USER');
  const [levels, setLevels] = useState<Record<Section, Level>>(() => {
    const initial = {} as Record<Section, Level>;
    for (const section of SECTIONS) initial[section] = user?.grants[section] ?? 'none';
    return initial;
  });
  const [allProperties, setAllProperties] = useState(user?.allProperties ?? true);

  if (state.status === 'success' && state.setupUrl) {
    return (
      <div className="rounded-lg border border-forest/30 bg-forest/5 p-6">
        <p className="font-display text-lg text-forest">{state.message}</p>
        <p className="mt-3 text-xs uppercase tracking-wider text-ink/60">Setup link</p>
        <code className="mt-1 block break-all rounded border border-ink/10 bg-white px-3 py-2 text-sm text-ink">
          {/* Absolute, because this gets pasted into an email or a message —
              a bare path is not something the recipient can open. The origin
              is whichever staff host the admin is already on. */}
          {typeof window === 'undefined'
            ? state.setupUrl
            : `${window.location.origin}${state.setupUrl}`}
        </code>
        <p className="mt-2 text-xs leading-relaxed text-ink/60">
          Nobody knows their password, including you — they choose it themselves through this link.
          It works once. If it is lost, deactivate the account and add them again.
        </p>
      </div>
    );
  }

  if (user && state.status === 'success') {
    return (
      <div className="rounded-lg border border-forest/30 bg-forest/5 p-5">
        <p className="text-sm text-forest">{state.message}</p>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="mt-3 rounded border border-forest/30 px-4 py-1.5 text-xs uppercase tracking-wider text-forest transition hover:bg-forest/5"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {user && <input type="hidden" name="id" value={user.id} />}
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="allProperties" value={allProperties ? 'true' : 'false'} />
      {SECTIONS.map((section) => (
        <input key={section} type="hidden" name={`section:${section}`} value={levels[section]} />
      ))}

      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`name-${user?.id ?? 'new'}`}
            className="text-xs uppercase tracking-wider text-ink/60"
          >
            Name
          </label>
          <input
            id={`name-${user?.id ?? 'new'}`}
            name="name"
            type="text"
            required
            defaultValue={user?.name}
            className="input mt-1"
          />
          {state.fieldErrors?.name?.[0] && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.name[0]}</p>
          )}
        </div>

        <div>
          <label
            htmlFor={`email-${user?.id ?? 'new'}`}
            className="text-xs uppercase tracking-wider text-ink/60"
          >
            Email
          </label>
          <input
            id={`email-${user?.id ?? 'new'}`}
            name="email"
            type="email"
            required
            defaultValue={user?.email}
            className="input mt-1"
          />
          {state.fieldErrors?.email?.[0] && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.email[0]}</p>
          )}
        </div>
      </div>

      <fieldset>
        <legend className="text-xs uppercase tracking-wider text-ink/60">Role</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['ADMIN', 'USER'] as const).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition has-[:checked]:border-forest has-[:checked]:bg-forest/5 has-[:checked]:text-forest"
            >
              <input
                type="radio"
                name={`role-choice-${user?.id ?? 'new'}`}
                checked={role === option}
                onChange={() => setRole(option)}
                className="h-3.5 w-3.5"
              />
              {option === 'ADMIN' ? 'Admin' : 'User'}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink/50">
          {role === 'ADMIN'
            ? 'Everything, including Users, Tax and adding accounts. Sections and properties below do not apply.'
            : 'Only the sections ticked below. Users, Tax and adding accounts are always Admin-only.'}
        </p>
      </fieldset>

      {role === 'USER' && (
        <>
          <fieldset>
            <legend className="text-xs uppercase tracking-wider text-ink/60">Sections</legend>
            <div className="mt-2 overflow-hidden rounded-lg border border-ink/10">
              {SECTIONS.map((section, i) => (
                <div
                  key={section}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 ${
                    i > 0 ? 'border-t border-ink/5' : ''
                  } ${levels[section] === 'none' ? 'bg-white' : 'bg-forest/[0.03]'}`}
                >
                  <div className="min-w-0">
                    <span className="text-sm text-ink/80">{SECTION_LABELS[section]}</span>
                    {levels[section] === 'EDIT' && SECTION_EDIT_NOTES[section] && (
                      <p className="text-xs text-ink/45">{SECTION_EDIT_NOTES[section]}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(['none', 'VIEW', 'EDIT'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setLevels((prev) => ({ ...prev, [section]: level }))}
                        className={`rounded px-3 py-1 text-xs uppercase tracking-wider transition ${
                          levels[section] === level
                            ? 'bg-forest text-cream'
                            : 'border border-ink/15 text-ink/50 hover:border-forest/40 hover:text-forest'
                        }`}
                      >
                        {level === 'none' ? 'No access' : level === 'VIEW' ? 'View' : 'Edit'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink/50">
              Each section is one item in the sidebar. No access hides it entirely.
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-xs uppercase tracking-wider text-ink/60">Properties</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition has-[:checked]:border-forest has-[:checked]:bg-forest/5 has-[:checked]:text-forest">
                <input
                  type="radio"
                  name={`scope-${user?.id ?? 'new'}`}
                  checked={allProperties}
                  onChange={() => setAllProperties(true)}
                  className="h-3.5 w-3.5"
                />
                All properties
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition has-[:checked]:border-forest has-[:checked]:bg-forest/5 has-[:checked]:text-forest">
                <input
                  type="radio"
                  name={`scope-${user?.id ?? 'new'}`}
                  checked={!allProperties}
                  onChange={() => setAllProperties(false)}
                  className="h-3.5 w-3.5"
                />
                Only the ones I pick
              </label>
            </div>

            {allProperties ? (
              <p className="mt-1.5 text-xs text-ink/50">
                Including properties added later — no need to come back here when one opens.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {properties.map((property) => (
                  <label
                    key={property.slug}
                    className="flex cursor-pointer items-center gap-1.5 rounded border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition has-[:checked]:border-forest has-[:checked]:bg-forest/5 has-[:checked]:text-forest"
                  >
                    <input
                      type="checkbox"
                      name="hotelSlugs"
                      value={property.slug}
                      defaultChecked={user?.hotels.includes(property.slug)}
                      className="h-3.5 w-3.5"
                    />
                    {property.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-forest px-6 py-2.5 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending ? 'Saving…' : user ? 'Save changes' : 'Add User'}
        </button>
        {user && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="text-xs uppercase tracking-wider text-ink/50 transition hover:text-forest"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
