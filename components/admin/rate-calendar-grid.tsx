'use client';

import type { CalendarCell, CalendarRow, RateCalendar } from '@/lib/rate-calendar';
import { useMemo, useState } from 'react';
import { RateEditPanel } from './rate-edit-panel';

export interface Selection {
  rowFrom: number;
  rowTo: number;
  colFrom: number;
  colTo: number;
}

function normalise(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

function dayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return {
    weekday: date.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' }),
    day: date.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric' }),
    month: date.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short' }),
    isWeekend: [0, 6].includes(date.getUTCDay()),
  };
}

// Fill drives the colour: how much of the allotment is still sellable. Kept in
// the site's own palette rather than raw traffic-light colours — forest reads
// as healthy, gold as tight and red as gone, consistently with the rest of
// /admin, and the text carries the numbers anyway.
function cellTone(cell: CalendarCell): string {
  if (cell.rate === null && cell.onSale === 0) return 'bg-ink/[0.04] text-ink/40';
  if (cell.closed) return 'bg-ink/10 text-ink/50';
  if (cell.onSale === 0 || cell.remaining === 0) return 'bg-red-50 text-red-800';

  const fill = cell.remaining / cell.onSale;
  if (fill <= 0.34) return 'bg-gold/25 text-gold-dark';
  if (fill <= 0.67) return 'bg-gold/10 text-ink';
  return 'bg-forest/[0.07] text-forest';
}

function restrictionMarks(cell: CalendarCell): string {
  const marks: string[] = [];
  if (cell.minStay) marks.push(`${cell.minStay}+`);
  if (cell.closedToArrival) marks.push('A');
  if (cell.closedToDeparture) marks.push('D');
  return marks.join(' ');
}

export function RateCalendarGrid({
  calendar,
  canEdit,
}: {
  calendar: RateCalendar;
  canEdit: boolean;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [anchor, setAnchor] = useState<{ row: number; col: number } | null>(null);

  const handleClick = (row: number, col: number, shiftKey: boolean) => {
    if (!canEdit) return;

    if (shiftKey && anchor) {
      const [rowFrom, rowTo] = normalise(anchor.row, row);
      const [colFrom, colTo] = normalise(anchor.col, col);
      setSelection({ rowFrom, rowTo, colFrom, colTo });
      return;
    }

    setAnchor({ row, col });
    setSelection({ rowFrom: row, rowTo: row, colFrom: col, colTo: col });
  };

  const isSelected = (row: number, col: number) =>
    selection !== null &&
    row >= selection.rowFrom &&
    row <= selection.rowTo &&
    col >= selection.colFrom &&
    col <= selection.colTo;

  const selected = useMemo(() => {
    if (!selection) return null;
    const rows = calendar.rows.slice(selection.rowFrom, selection.rowTo + 1);
    const dates = calendar.dates.slice(selection.colFrom, selection.colTo + 1);
    return { rows, dates };
  }, [selection, calendar]);

  return (
    <>
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-ink/10 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 border-b border-ink/10 bg-white px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink/50"
              >
                Room · Plan
              </th>
              {calendar.dates.map((iso) => {
                const label = dayLabel(iso);
                const holiday = calendar.holidays[iso];
                return (
                  <th
                    key={iso}
                    scope="col"
                    title={holiday}
                    className={`min-w-[5.5rem] border-b border-ink/10 px-2 py-3 text-center text-xs font-medium ${
                      holiday
                        ? 'bg-gold/20 text-gold-dark'
                        : label.isWeekend
                          ? 'bg-gold/10 text-gold-dark'
                          : 'bg-white text-ink/50'
                    }`}
                  >
                    <span className="block uppercase tracking-wider">{label.weekday}</span>
                    <span className="block text-sm text-ink">{label.day}</span>
                    <span className="block text-[10px] uppercase tracking-wider">
                      {holiday ? '★' : label.month}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {calendar.rows.map((row, rowIndex) => (
              <tr key={`${row.roomTypeId}:${row.ratePlanId}`} className="border-b border-ink/5">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[13rem] border-r border-ink/10 bg-white px-4 py-2 text-left font-medium text-ink"
                >
                  {row.roomName}
                  <span className="block text-xs font-normal text-ink/50">{row.ratePlanName}</span>
                </th>
                {row.cells.map((cell, colIndex) => (
                  <td key={cell.date} className="p-0.5 align-top">
                    <CellButton
                      cell={cell}
                      row={row}
                      selected={isSelected(rowIndex, colIndex)}
                      disabled={!canEdit}
                      onSelect={(shiftKey) => handleClick(rowIndex, colIndex, shiftKey)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink/50">
        Each cell shows the nightly rate, then rooms on sale, sold and left. Colour is how much of
        the allotment is still sellable.{' '}
        <strong>
          Click a night to select it, shift-click another to take the block between them
        </strong>
        , then edit them together.{' '}
        <span className="whitespace-nowrap">
          <code className="text-ink/60">3+</code> is a minimum stay,
        </span>{' '}
        <code className="text-ink/60">A</code> closed to arrival,{' '}
        <code className="text-ink/60">D</code> closed to departure. Gold columns are weekends;
        starred ones are holidays.
      </p>

      {canEdit && selected && (
        <div className="mt-4">
          <RateEditPanel
            hotelSlug={calendar.hotelSlug}
            rows={selected.rows}
            dates={selected.dates}
            onClear={() => {
              setSelection(null);
              setAnchor(null);
            }}
          />
        </div>
      )}
    </>
  );
}

function CellButton({
  cell,
  row,
  selected,
  disabled,
  onSelect,
}: {
  cell: CalendarCell;
  row: CalendarRow;
  selected: boolean;
  disabled: boolean;
  onSelect: (shiftKey: boolean) => void;
}) {
  const unloaded = cell.rate === null && cell.onSale === 0;
  const marks = restrictionMarks(cell);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => onSelect(event.shiftKey)}
      className={`w-full rounded px-1.5 py-1.5 text-center transition ${cellTone(cell)} ${
        selected ? 'ring-2 ring-forest ring-offset-1' : 'hover:ring-2 hover:ring-forest/30'
      } ${disabled ? 'cursor-default' : ''}`}
      aria-pressed={selected}
      aria-label={
        unloaded
          ? `${row.roomName}, ${row.ratePlanName}, ${cell.date}: nothing loaded`
          : `${row.roomName}, ${row.ratePlanName}, ${cell.date}: ${
              cell.rate === null ? 'no rate' : `${cell.rate} rupees`
            }, ${cell.onSale} on sale, ${cell.sold} sold, ${cell.remaining} left${
              cell.closed ? ', stop sell' : ''
            }`
      }
    >
      {unloaded ? (
        <span className="block py-2 text-xs">—</span>
      ) : (
        <>
          <span className={`block text-xs font-medium ${cell.closed ? 'line-through' : ''}`}>
            {cell.rate === null ? '—' : `₹${cell.rate.toLocaleString('en-IN')}`}
          </span>
          <span className="block text-[10px] opacity-70">{cell.onSale} on sale</span>
          <span className="block text-[10px] opacity-70">
            {cell.sold} sold · {cell.remaining} left
          </span>
          {marks && (
            <span className="mt-0.5 block text-[10px] font-medium tracking-wide opacity-80">
              {marks}
            </span>
          )}
        </>
      )}
    </button>
  );
}
