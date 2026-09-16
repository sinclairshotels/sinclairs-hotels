'use client';

import { type RateFormState, saveRates } from '@/app/admin/(dashboard)/rates/actions';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import type { CalendarCell, RateCalendar } from '@/lib/rate-calendar';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initialState: RateFormState = { status: 'idle' };

function dayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return {
    weekday: date.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' }),
    day: date.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric' }),
    month: date.toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'short' }),
    isWeekend: [0, 6].includes(date.getUTCDay()),
  };
}

export function RateCalendarGrid({ calendar }: { calendar: RateCalendar }) {
  const [editing, setEditing] = useState<{ roomName: string; cell: CalendarCell } | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-ink/10 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink/10">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink/50"
              >
                Room
              </th>
              {calendar.dates.map((iso) => {
                const label = dayLabel(iso);
                return (
                  <th
                    key={iso}
                    scope="col"
                    className={`min-w-[5.5rem] px-2 py-3 text-center text-xs font-medium ${
                      label.isWeekend ? 'bg-gold/10 text-gold-dark' : 'text-ink/50'
                    }`}
                  >
                    <span className="block uppercase tracking-wider">{label.weekday}</span>
                    <span className="block text-sm text-ink">{label.day}</span>
                    <span className="block text-[10px] uppercase tracking-wider">
                      {label.month}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {calendar.rows.map((row) => (
              <tr key={row.roomName} className="border-b border-ink/5 last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[12rem] bg-white px-4 py-2 text-left font-medium text-ink"
                >
                  {row.roomName}
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.date} className="p-1 align-top">
                    <CellButton
                      cell={cell}
                      onEdit={() => setEditing({ roomName: row.roomName, cell })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-ink/50">
        Each cell shows the nightly rate, then rooms on sale, sold and remaining. Click any night to
        edit it. Grey means nothing is loaded; a struck-through rate is a stop sell.
      </p>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent
            title={editing.roomName}
            description={`${calendar.hotelName} — ${new Date(
              `${editing.cell.date}T00:00:00.000Z`,
            ).toLocaleDateString('en-IN', {
              timeZone: 'UTC',
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}`}
          >
            <NightForm
              hotelSlug={calendar.hotelSlug}
              roomName={editing.roomName}
              cell={editing.cell}
              onSaved={() => setEditing(null)}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function CellButton({ cell, onEdit }: { cell: CalendarCell; onEdit: () => void }) {
  const unloaded = cell.rate === null;
  const soldOut = !unloaded && cell.remaining === 0;

  return (
    <button
      type="button"
      onClick={onEdit}
      className={`w-full rounded px-1.5 py-1.5 text-center transition hover:ring-2 hover:ring-forest/30 ${
        unloaded
          ? 'bg-ink/[0.04] text-ink/40'
          : cell.closed
            ? 'bg-ink/10 text-ink/50'
            : soldOut
              ? 'bg-red-50 text-red-800'
              : 'bg-forest/[0.06] text-forest'
      }`}
      aria-label={
        unloaded
          ? `${cell.date}: no rate loaded. Edit.`
          : `${cell.date}: ${cell.rate} rupees, ${cell.onSale} on sale, ${cell.sold} sold, ${cell.remaining} remaining. Edit.`
      }
    >
      {unloaded ? (
        <span className="block py-2 text-xs">—</span>
      ) : (
        <>
          <span className={`block text-xs font-medium ${cell.closed ? 'line-through' : ''}`}>
            ₹{cell.rate?.toLocaleString('en-IN')}
          </span>
          <span className="block text-[10px] text-ink/50">{cell.onSale} on sale</span>
          <span className="block text-[10px] text-ink/50">
            {cell.sold} sold · {cell.remaining} left
          </span>
        </>
      )}
    </button>
  );
}

// A single night is its own confirmation — the preview step exists for bulk
// loads that can silently replace a season, which this cannot.
function NightForm({
  hotelSlug,
  roomName,
  cell,
  onSaved,
}: {
  hotelSlug: string;
  roomName: string;
  cell: CalendarCell;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveRates, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
      onSaved();
    }
  }, [state.status, router, onSaved]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hotelSlug" value={hotelSlug} />
      <input type="hidden" name="roomName" value={roomName} />
      <input type="hidden" name="from" value={cell.date} />
      <input type="hidden" name="to" value={cell.date} />
      <input type="hidden" name="confirmed" value="on" />

      {state.status === 'error' && state.message && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="night-rate" className="text-xs uppercase tracking-wider text-ink/60">
            Rate per night (₹)
          </label>
          <input
            id="night-rate"
            name="rate"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={cell.rate ?? 4500}
            className="input mt-1"
          />
        </div>
        <div>
          <label htmlFor="night-rooms" className="text-xs uppercase tracking-wider text-ink/60">
            Rooms on sale
          </label>
          <input
            id="night-rooms"
            name="totalRooms"
            type="number"
            min={0}
            max={500}
            step={1}
            required
            defaultValue={cell.onSale}
            className="input mt-1"
          />
        </div>
      </div>

      {cell.sold > 0 && (
        <p className="rounded border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-ink/70">
          {cell.sold} {cell.sold === 1 ? 'room is' : 'rooms are'} already booked for this night.
          Setting rooms on sale below {cell.sold} will not cancel anything — it just stops further
          bookings.
        </p>
      )}

      <label className="flex items-start gap-2 text-sm text-ink/70">
        <input type="checkbox" name="closed" defaultChecked={cell.closed} className="mt-0.5" />
        <span>Stop sell this night</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-forest px-5 py-2 text-sm uppercase tracking-wider text-cream transition hover:bg-forest-dark disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save Night'}
        </button>
        <DialogClose asChild>
          <button type="button" className="text-sm text-ink/50 transition hover:text-ink">
            Cancel
          </button>
        </DialogClose>
      </div>
    </form>
  );
}
