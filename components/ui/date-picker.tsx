'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

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

export function DatePicker({
  value,
  onChange,
  min,
  placeholder = 'Select date',
  id,
  label,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  placeholder?: string;
  id?: string;
  // The trigger is a button, not a form control, so a <label> cannot name it.
  // This is how it gets an accessible name of its own.
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const minDate = min ? parseISO(min) : undefined;
  const [displayMonth, setDisplayMonth] = useState(() => parseISO(value) ?? minDate ?? new Date());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear + i);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDisplayMonth(parseISO(value) ?? minDate ?? new Date());
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          aria-label={label}
          className="flex w-full items-center justify-between gap-2 text-left text-sm text-ink outline-none"
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
          className="animate-fade-up z-50 w-[min(300px,calc(100vw-2rem))] rounded-lg border border-forest/10 bg-white p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={String(displayMonth.getMonth())}
                onValueChange={(v) =>
                  setDisplayMonth((prev) => new Date(prev.getFullYear(), Number(v), 1))
                }
              >
                <SelectTrigger className="rounded border border-forest/15 px-2 py-1.5 text-ink" />
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={name} value={String(i)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <Select
                value={String(displayMonth.getFullYear())}
                onValueChange={(v) =>
                  setDisplayMonth((prev) => new Date(Number(v), prev.getMonth(), 1))
                }
              >
                <SelectTrigger className="rounded border border-forest/15 px-2 py-1.5 text-ink" />
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DayPicker
            mode="single"
            month={displayMonth}
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
              months: 'flex',
              month: 'space-y-2',
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
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
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
