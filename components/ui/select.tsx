'use client';

import * as SelectPrimitive from '@radix-ui/react-select';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

// The control draws its own box, so no caller has to remember to wrap it in
// one — forgetting that is invisible in review and leaves a value and a chevron
// floating with no field around them. `bare` is the opt-out for the places that
// genuinely draw their own: the public booking cards, where each field sits in
// a divided cell, and this file's sibling date picker's month/year selects.
export function SelectTrigger({
  placeholder,
  className = '',
  id,
  bare = false,
}: {
  placeholder?: string;
  className?: string;
  id?: string;
  bare?: boolean;
}) {
  return (
    <SelectPrimitive.Trigger
      id={id}
      className={`flex w-full items-center justify-between gap-2 text-left text-sm text-ink outline-none data-[placeholder]:text-ink/40 ${
        bare ? 'border-0 bg-transparent' : 'input'
      } ${className}`}
    >
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon>
        <ChevronIcon />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={8}
        className="animate-fade-up z-50 max-h-[min(20rem,var(--radix-select-content-available-height))] overflow-hidden rounded-lg border border-gold/20 bg-forest-dark text-cream shadow-2xl"
      >
        <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1.5 text-gold-light">
          <ChevronIcon direction="up" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1.5 text-gold-light">
          <ChevronIcon direction="down" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  children,
  value,
}: {
  children: React.ReactNode;
  value: string;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm outline-none transition data-[highlighted]:bg-forest data-[highlighted]:text-gold-light data-[state=checked]:text-gold-light"
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <CheckIcon />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function ChevronIcon({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-ink/50"
    >
      <path
        d={direction === 'up' ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 13 4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
