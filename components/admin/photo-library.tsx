'use client';

import {
  type PhotoState,
  assignPhoto,
  loadPhotoLibrary,
} from '@/app/admin/(dashboard)/photos/actions';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import type { LibraryPhoto } from '@/lib/photo-library';
import Image from 'next/image';
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const idle: PhotoState = { status: 'idle' };

interface Target {
  slotKey: string;
  label: string;
  contentPath: string;
}

interface LibraryContext {
  open: (target: Target) => void;
  result: PhotoState;
}

const Ctx = createContext<LibraryContext | null>(null);

export function usePhotoLibrary(): LibraryContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePhotoLibrary used outside PhotoLibraryProvider');
  return ctx;
}

// One picker for the whole page. Nine hundred slot cards each owning a copy of
// the library — which is every file on the site — would be nine hundred copies
// of the same list; they share this one and say which position they are filling.
export function PhotoLibraryProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [query, setQuery] = useState('');
  const [state, action, pending] = useActionState(assignPhoto, idle);

  // Fetched the first time the picker is opened, then kept.
  useEffect(() => {
    if (!target || photos) return;
    startTransition(async () => setPhotos(await loadPhotoLibrary()));
  }, [target, photos]);

  useEffect(() => {
    if (state.status === 'success') setTarget(null);
  }, [state]);

  const groups = useMemo(() => {
    if (!photos) return [];
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? photos.filter(
          (photo) =>
            photo.fileName.toLowerCase().includes(needle) ||
            photo.group.toLowerCase().includes(needle) ||
            photo.contentPath.toLowerCase().includes(needle) ||
            photo.usedIn.some((use) => use.toLowerCase().includes(needle)),
        )
      : photos;

    const byGroup = new Map<string, LibraryPhoto[]>();
    for (const photo of matching) {
      byGroup.set(photo.group, [...(byGroup.get(photo.group) ?? []), photo]);
    }
    return [...byGroup.entries()];
  }, [photos, query]);

  const shown = groups.reduce((total, [, list]) => total + list.length, 0);

  return (
    <Ctx.Provider value={{ open: setTarget, result: state }}>
      {children}

      <Dialog open={target !== null} onOpenChange={(next) => !next && setTarget(null)}>
        {target && (
          <DialogContent
            size="lg"
            title="Choose from library"
            description={`${target.label} — picking a photo points this position at it. Nothing is copied.`}
          >
            <form action={action} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="slotKey" value={target.slotKey} />

              <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by file name, property or where it is used"
                  className="input min-w-[16rem] flex-1 py-1.5 text-sm"
                />
                <p className="text-xs text-ink/50">
                  {photos ? `${shown} of ${photos.length} photos` : 'Loading…'}
                </p>
                <DialogClose className="rounded border border-ink/15 px-3 py-1.5 text-xs uppercase tracking-wider text-ink/60 transition hover:border-forest hover:text-forest">
                  Cancel
                </DialogClose>
              </div>

              {state.status === 'error' && state.message && (
                <output className="pb-2 text-xs text-red-700">{state.message}</output>
              )}

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
                {groups.map(([group, list]) => (
                  <section key={group}>
                    <p className="sticky top-0 bg-white py-1 text-xs uppercase tracking-wider text-ink/50">
                      {group} <span className="text-ink/30">· {list.length}</span>
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {list.map((photo) => (
                        <button
                          key={photo.contentPath}
                          type="submit"
                          name="sourcePath"
                          value={photo.contentPath}
                          disabled={pending}
                          title={photo.contentPath}
                          className={`group overflow-hidden rounded-lg border text-left transition hover:shadow-lg disabled:opacity-50 ${
                            photo.contentPath === target.contentPath
                              ? 'border-gold ring-1 ring-gold'
                              : 'border-ink/10'
                          }`}
                        >
                          <div className="relative aspect-[4/3] bg-forest/5">
                            <Image
                              src={photo.contentPath}
                              alt={photo.fileName}
                              fill
                              sizes="160px"
                              className="object-cover"
                            />
                          </div>
                          <div className="space-y-1 p-2">
                            <p className="break-all text-[11px] leading-snug text-ink/70">
                              {photo.fileName}
                            </p>
                            <p className="text-[10px] text-ink/40">
                              {photo.width}×{photo.height} · {photo.size}
                            </p>
                            {photo.contentPath === target.contentPath ? (
                              <p className="text-[10px] uppercase tracking-wider text-gold-dark">
                                This position&rsquo;s own photo
                              </p>
                            ) : photo.usedIn.length > 0 ? (
                              <p className="text-[10px] leading-snug text-ink/50">
                                {photo.usedIn.length === 1
                                  ? photo.usedIn[0]
                                  : `${photo.usedIn[0]} + ${photo.usedIn.length - 1} more`}
                              </p>
                            ) : (
                              <p className="text-[10px] text-ink/30">Not used anywhere</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}

                {photos && shown === 0 && (
                  <p className="py-8 text-center text-sm text-ink/60">
                    No photo matches &ldquo;{query}&rdquo;.
                  </p>
                )}
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}
