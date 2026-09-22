'use client';

import { type PhotoState, replacePhoto, retirePhoto } from '@/app/admin/(dashboard)/photos/actions';
import Image from 'next/image';
import { useActionState, useState } from 'react';

const idle: PhotoState = { status: 'idle' };

export interface SlotView {
  key: string;
  label: string;
  contentPath: string;
  targetWidth: number;
  src: string;
  fileName: string;
  width: number;
  height: number;
  size: string;
  replaced?: { uploadedLabel: string; uploadedAt: string; originalName: string };
  missing?: boolean;
}

export function PhotoSlotCard({
  slot,
  deletable = false,
  replaceable = true,
}: { slot: SlotView; deletable?: boolean; replaceable?: boolean }) {
  const [state, action, pending] = useActionState(replacePhoto, idle);
  const mine = state.slotKey === slot.key ? state : idle;

  return (
    <div
      data-slot={slot.key}
      className="flex flex-col overflow-hidden rounded-lg border border-ink/10 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-forest/5">
        {slot.missing ? (
          <p className="flex h-full items-center justify-center p-4 text-center text-xs text-red-700">
            File missing from the repository
          </p>
        ) : (
          <Image
            src={slot.src}
            alt={slot.label}
            fill
            sizes="240px"
            className="object-cover"
            unoptimized={slot.src.startsWith('/api/')}
          />
        )}
        {slot.replaced && (
          <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] uppercase tracking-wider text-forest-dark">
            Replaced
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-sm font-medium leading-snug text-ink">{slot.label}</p>
        <FileLine name={slot.fileName} />
        <p className="text-xs text-ink/50">
          {slot.missing ? '—' : `${slot.width}×${slot.height} · ${slot.size}`}
        </p>
        {slot.replaced && (
          <p className="text-[11px] leading-snug text-ink/50">
            {slot.replaced.originalName} · {slot.replaced.uploadedAt} ·{' '}
            {slot.replaced.uploadedLabel}
          </p>
        )}

        {replaceable && (
          <form action={action} className="mt-auto space-y-2 pt-2">
            <input type="hidden" name="slotKey" value={slot.key} />
            <label className="block text-[11px] uppercase tracking-wider text-ink/40">
              Replace
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp"
                required
                className="mt-1 block w-full text-xs text-ink/70 file:mr-2 file:rounded file:border-0 file:bg-forest file:px-2 file:py-1 file:text-xs file:text-cream hover:file:bg-forest-dark"
              />
            </label>
            <p className="text-[11px] text-ink/40">
              JPG, PNG or WebP — converted to WebP at {slot.targetWidth.toLocaleString('en-IN')}px
              wide.
            </p>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded bg-forest px-3 py-1.5 text-xs uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
            >
              {pending ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        )}

        {mine.message && (
          <output className={`text-xs ${mine.status === 'error' ? 'text-red-700' : 'text-forest'}`}>
            {mine.message}
          </output>
        )}

        {deletable && <DeleteButton contentPath={slot.contentPath} />}
      </div>
    </div>
  );
}

function FileLine({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 break-all text-[11px] leading-snug text-ink/60">{name}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(name).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => setCopied(false),
          );
        }}
        className="shrink-0 rounded border border-ink/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink/60 transition hover:border-forest hover:text-forest"
      >
        {copied ? 'Copied' : 'Copy name'}
      </button>
    </div>
  );
}

function DeleteButton({ contentPath }: { contentPath: string }) {
  const [state, action, pending] = useActionState(retirePhoto, idle);
  const [confirming, setConfirming] = useState(false);

  if (state.status === 'success') {
    return (
      <p className="pt-2 text-xs text-forest">Deleted — it leaves the repo on the next prune.</p>
    );
  }

  return (
    <form action={action} className="space-y-2 border-t border-ink/10 pt-2">
      <input type="hidden" name="contentPath" value={contentPath} />
      {confirming ? (
        <div className="space-y-1">
          <p className="text-[11px] leading-snug text-ink/60">
            Delete this photo? No page uses it, and it is recoverable from git.
          </p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded bg-red-700 px-3 py-1.5 text-xs uppercase tracking-wider text-white transition hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded border border-ink/15 px-3 py-1.5 text-xs uppercase tracking-wider text-ink/60"
            >
              Keep
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded border border-red-300 px-3 py-1.5 text-xs uppercase tracking-wider text-red-700 transition hover:bg-red-50"
        >
          Delete
        </button>
      )}
      {state.message && state.status === 'error' && (
        <output className="text-xs text-red-700">{state.message}</output>
      )}
    </form>
  );
}
