'use client';

import {
  type EnquiryActionState,
  assignEnquiry,
  forwardEnquiry,
  saveReplyNote,
  setEnquiryStatus,
} from '@/app/admin/(dashboard)/enquiries/actions';
import type { EnquiryCloseReason, EnquiryStatus } from '@prisma/client';
import { useActionState, useState } from 'react';

const initial: EnquiryActionState = { status: 'idle' };

export interface StaffOption {
  id: string;
  name: string;
}

export const CLOSE_REASONS: Array<{ value: EnquiryCloseReason; label: string }> = [
  { value: 'BOOKED', label: 'Booked' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'NO_RESPONSE', label: 'No response' },
  { value: 'SPAM', label: 'Spam' },
];

// A native <select> here on purpose, against the site-wide rule: this is one
// cell in a dense table, repeated once per row, and a Radix popover per row
// costs far more than it returns. The rule is about guest-facing forms.
export function AssigneeSelect({
  enquiryId,
  value,
  staff,
}: {
  enquiryId: string;
  value: string | null;
  staff: StaffOption[];
}) {
  const [state, action, pending] = useActionState(assignEnquiry, initial);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={enquiryId} />
      <select
        name="userId"
        defaultValue={value ?? ''}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full rounded border border-ink/15 bg-white px-2 py-1 text-xs text-ink/80 disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {staff.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
      {state.status === 'error' && <p className="mt-1 text-[11px] text-red-600">{state.message}</p>}
    </form>
  );
}

export function StatusControls({
  enquiryId,
  status,
  compact = false,
}: {
  enquiryId: string;
  status: EnquiryStatus;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(setEnquiryStatus, initial);
  const [closing, setClosing] = useState(false);

  const button =
    'rounded border px-2 py-1 text-[11px] uppercase tracking-wider transition disabled:opacity-60';

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div className="flex flex-wrap items-center gap-1">
        {status !== 'CONTACTED' && status !== 'CLOSED' && (
          <form action={action}>
            <input type="hidden" name="id" value={enquiryId} />
            <input type="hidden" name="status" value="CONTACTED" />
            <button
              type="submit"
              disabled={pending}
              className={`${button} border-forest/30 text-forest hover:bg-forest/5`}
            >
              Mark contacted
            </button>
          </form>
        )}

        {status !== 'CLOSED' && (
          <button
            type="button"
            onClick={() => setClosing((v) => !v)}
            className={`${button} border-ink/20 text-ink/60 hover:border-ink/40`}
          >
            {closing ? 'Cancel' : 'Close'}
          </button>
        )}

        {status === 'CLOSED' && (
          <form action={action}>
            <input type="hidden" name="id" value={enquiryId} />
            <input type="hidden" name="status" value="NEW" />
            <button
              type="submit"
              disabled={pending}
              className={`${button} border-gold/50 text-gold-dark hover:bg-gold/10`}
            >
              Reopen
            </button>
          </form>
        )}
      </div>

      {closing && status !== 'CLOSED' && (
        <form action={action} className="flex flex-wrap items-center gap-1">
          <input type="hidden" name="id" value={enquiryId} />
          <input type="hidden" name="status" value="CLOSED" />
          {CLOSE_REASONS.map((reason) => (
            <button
              key={reason.value}
              type="submit"
              name="closeReason"
              value={reason.value}
              disabled={pending}
              className={`${button} border-ink/20 text-ink/70 hover:border-forest/40 hover:text-forest`}
            >
              {reason.label}
            </button>
          ))}
        </form>
      )}

      {state.status === 'error' && <p className="text-[11px] text-red-600">{state.message}</p>}
    </div>
  );
}

export function ForwardForm({ enquiryId }: { enquiryId: string }) {
  const [state, action, pending] = useActionState(forwardEnquiry, initial);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={enquiryId} />
      <div className="flex flex-wrap gap-2">
        <input
          name="address"
          type="email"
          required
          placeholder="forward to an address"
          className="input max-w-xs flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-forest/30 px-4 py-1.5 text-xs uppercase tracking-wider text-forest transition hover:bg-forest/5 disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Forward'}
        </button>
      </div>
      {state.message && (
        <p className={`text-xs ${state.status === 'error' ? 'text-red-600' : 'text-forest'}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ReplyNoteForm({ enquiryId, value }: { enquiryId: string; value: string | null }) {
  const [state, action, pending] = useActionState(saveReplyNote, initial);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={enquiryId} />
      <textarea
        name="replyNote"
        rows={4}
        defaultValue={value ?? ''}
        placeholder="What was said back — one or two lines, so the next person does not have to open the mailbox."
        className="input w-full text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-forest px-5 py-2 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save note'}
        </button>
        {state.message && (
          <span className={`text-xs ${state.status === 'error' ? 'text-red-600' : 'text-ink/50'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
