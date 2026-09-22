'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  size = 'sm',
  children,
}: {
  title: string;
  description?: string;
  // 'lg' is for content that is a grid rather than a form — the photo library
  // picker needs the width to show thumbnails several across.
  size?: 'sm' | 'lg';
  children: React.ReactNode;
}) {
  const width =
    size === 'lg'
      ? 'w-[min(72rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col'
      : 'w-[min(28rem,calc(100vw-2rem))]';

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-forest-dark/60 data-[state=open]:animate-fade-up" />
      <DialogPrimitive.Content
        className={`fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl focus:outline-none ${width}`}
      >
        <DialogPrimitive.Title className="font-display text-lg text-forest">
          {title}
        </DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="mt-1 text-sm text-ink/60">
            {description}
          </DialogPrimitive.Description>
        )}
        <div className={size === 'lg' ? 'mt-4 flex min-h-0 flex-1 flex-col' : 'mt-4'}>
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
