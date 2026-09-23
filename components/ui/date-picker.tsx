'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Two months need roughly twice the room, and a phone has nowhere to put the
// second one. Matches Tailwind's sm breakpoint so the popover and the page
// agree about what counts as a small screen.
const TWO_MONTH_QUERY = '(min-width: 640px)';

// Far enough that scrolling the page does not count as a swipe, short enough
// that a deliberate flick does.
const SWIPE_THRESHOLD_PX = 45;

function formatDisplay(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISO(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function DatePicker({
  value,
  onChange,
  min,
  placeholder = 'Select date',
  id,
  label,
  bare = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  placeholder?: string;
  id?: string;
  // The trigger is a button, not a form control, so a <label> cannot name it.
  // This is how it gets an accessible name of its own.
  label?: string;
  // See SelectTrigger: boxed by default, opt out where the parent draws one.
  bare?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const minDate = min ? parseISO(min) : undefined;
  const [displayMonth, setDisplayMonth] = useState(() =>
    startOfMonth(parseISO(value) ?? minDate ?? new Date()),
  );

  // Starts single-month so the first server-rendered paint and the first client
  // paint agree; the effect widens it once the browser can be asked.
  const [twoMonths, setTwoMonths] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(TWO_MONTH_QUERY);
    const sync = () => setTwoMonths(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  // Stepping back past the first bookable month would show a grid of disabled
  // days and nothing else, so the arrow goes dead instead.
  const firstAllowedMonth = minDate ? startOfMonth(minDate) : undefined;
  const canGoBack = !firstAllowedMonth || displayMonth > firstAllowedMonth;

  const step = (count: number) => {
    setDisplayMonth((prev) => {
      const next = addMonths(prev, count);
      if (firstAllowedMonth && next < firstAllowedMonth) return firstAllowedMonth;
      return next;
    });
  };

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const end = event.changedTouches[0]?.clientX;
    if (end === undefined) return;
    const travelled = end - start;
    if (Math.abs(travelled) < SWIPE_THRESHOLD_PX) return;
    // Dragging left pulls the next month in from the right, which is the way
    // every other horizontally paged thing on a phone behaves.
    if (travelled < 0) step(1);
    else if (canGoBack) step(-1);
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDisplayMonth(startOfMonth(parseISO(value) ?? minDate ?? new Date()));
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          aria-label={label}
          className={`flex w-full items-center justify-between gap-2 text-left text-sm text-ink outline-none ${
            bare ? '' : 'input'
          }`}
        >
          <span className={value ? '' : 'text-ink/40'}>
            {value ? formatDisplay(value) : placeholder}
          </span>
          <CalendarIcon />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          className={`animate-fade-up z-50 rounded-lg border border-forest/10 bg-white p-3 shadow-2xl ${
            twoMonths ? 'w-[min(620px,calc(100vw-2rem))]' : 'w-[min(300px,calc(100vw-2rem))]'
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <NavButton
              direction="previous"
              disabled={!canGoBack}
              onClick={() => step(-1)}
              label="Previous month"
            />
            <div className="flex flex-1 justify-around text-sm font-medium text-forest">
              <span>{monthLabel(displayMonth)}</span>
              {twoMonths && <span>{monthLabel(addMonths(displayMonth, 1))}</span>}
            </div>
            <NavButton
              direction="next"
              onClick={() => step(1)}
              label={twoMonths ? 'Next two months' : 'Next month'}
            />
          </div>

          <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <DayPicker
              mode="single"
              month={displayMonth}
              numberOfMonths={twoMonths ? 2 : 1}
              onMonthChange={setDisplayMonth}
              selected={parseISO(value)}
              onSelect={(date) => {
                if (date) {
                  onChange(toISO(date));
                  setOpen(false);
                }
              }}
              disabled={minDate ? { before: minDate } : undefined}
              classNames={{
                root: 'font-sans',
                months: 'flex gap-6',
                month: 'space-y-2 flex-1',
                // The header above owns the caption and the arrows. Leaving
                // react-day-picker's own visible as well renders the month
                // twice — see CLAUDE.md on captionLayout.
                month_caption: 'hidden',
                dropdowns: 'hidden',
                nav: 'hidden',
                month_grid: 'w-full border-collapse',
                weekdays: 'flex',
                weekday: 'text-ink/40 w-9 text-xs font-normal uppercase',
                week: 'flex w-full mt-1',
                day: 'h-9 w-9 text-center text-sm p-0 relative',
                day_button:
                  'h-9 w-9 rounded-full text-ink hover:bg-gold/20 transition flex items-center justify-center',
                selected:
                  '[&>button]:bg-gold [&>button]:text-forest-dark [&>button]:font-medium hover:[&>button]:bg-gold',
                today: '[&>button]:border [&>button]:border-gold',
                outside: 'text-ink/25',
                disabled: 'text-ink/20 [&>button]:hover:bg-transparent cursor-not-allowed',
              }}
            />
          </div>

          {!twoMonths && (
            <p className="mt-2 text-center text-[10px] uppercase tracking-wider text-ink/35">
              Swipe to change month
            </p>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function NavButton({
  direction,
  onClick,
  disabled = false,
  label,
}: {
  direction: 'previous' | 'next';
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-forest transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:text-ink/20 disabled:hover:bg-transparent"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={direction === 'previous' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-ink/40"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
