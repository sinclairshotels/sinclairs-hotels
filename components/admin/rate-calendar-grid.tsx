import type { CalendarCell, CalendarRow, RateCalendar } from '@/lib/rate-calendar';

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

// Read-only on purpose: rates are set on the Monthly and Daily screens, and a
// grid that both displays a year and edits it was the thing that made the old
// panel hard to reason about. A server component, so no hydration at all.
export function RateCalendarGrid({ calendar }: { calendar: RateCalendar }) {
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
                Room
              </th>
              {calendar.dates.map((iso) => {
                const label = dayLabel(iso);
                const holiday = calendar.holidays[iso];
                return (
                  <th
                    key={iso}
                    scope="col"
                    title={holiday}
                    // Opaque golds, not gold/20 and gold/10: this header is
                    // sticky, and a translucent cell lets the rows scrolling
                    // underneath print straight through it. Same colours the
                    // alphas resolved to over white.
                    className={`min-w-[6rem] border-b border-ink/10 px-2 py-3 text-center text-xs font-medium ${
                      holiday
                        ? 'bg-[#f2eadd] text-gold-dark'
                        : label.isWeekend
                          ? 'bg-[#f8f4ee] text-gold-dark'
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
            {calendar.rows.map((row) => (
              <tr key={row.roomTypeId} className="border-b border-ink/5">
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-[13rem] border-r border-ink/10 bg-white px-4 py-2 text-left font-medium text-ink"
                >
                  {row.roomName}
                  <span className="block text-xs font-normal text-ink/50">
                    Sleeps {row.baseOccupancy}
                  </span>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.date} className="p-0.5 align-top">
                    <Cell cell={cell} row={row} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {calendar.breakfastSupplement === 0 && (
        <p className="mt-2 text-xs text-gold-dark">
          With Breakfast is not on sale here until a breakfast supplement is set on Set-up.
        </p>
      )}

      <p className="mt-2 text-xs leading-relaxed text-ink/50">
        Each cell shows Room Only and With Breakfast, then rooms on sale, sold and left. Both plans
        share the one allotment. Colour is how much of the allotment is still sellable. A{' '}
        <span className="text-ink/60 line-through">struck-through rate</span> is a stop sell — the
        night keeps its price but is not offered. A{' '}
        <span className="rounded-sm bg-forest px-1 py-0.5 font-medium text-cream">•</span> marks a
        night set on the Daily screen, which a monthly save leaves alone.{' '}
        <span className="whitespace-nowrap">
          <code className="text-ink/60">3+</code> is a minimum stay,
        </span>{' '}
        <code className="text-ink/60">A</code> closed to arrival,{' '}
        <code className="text-ink/60">D</code> closed to departure. Gold columns are weekends;
        starred ones are holidays.
      </p>
    </>
  );
}

function Cell({ cell, row }: { cell: CalendarCell; row: CalendarRow }) {
  const unloaded = cell.rate === null && cell.onSale === 0;
  const marks = restrictionMarks(cell);

  const description = unloaded
    ? `${row.roomName}, ${cell.date}: nothing loaded`
    : `${row.roomName}, ${cell.date}: ${
        cell.rate === null
          ? 'no rate'
          : `room only ${cell.rate} rupees${
              cell.breakfastRate === null ? '' : `, with breakfast ${cell.breakfastRate} rupees`
            }`
      }, ${cell.onSale} on sale, ${cell.sold} sold, ${cell.remaining} left${
        cell.closed ? ', stop sell' : ''
      }${cell.overridden ? ', set daily' : ''}`;

  return (
    <div
      className={`relative w-full rounded px-1.5 py-1.5 text-center ${cellTone(cell)} ${
        cell.overridden ? 'ring-1 ring-forest/40' : ''
      }`}
      title={description}
    >
      <span className="sr-only">{description}</span>
      {cell.overridden && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-forest"
        />
      )}
      {unloaded ? (
        <span className="block py-2 text-xs" aria-hidden="true">
          —
        </span>
      ) : (
        <div aria-hidden="true">
          {/* Stacked rather than "RO ₹5,100 · BB ₹6,000" on one line: two
              rates and a separator need about 8.5rem, and fourteen columns of
              that scroll sideways on a laptop. Two short lines in a narrow
              column show the whole fortnight at once, which is what the grid
              is for. */}
          <span className={`block text-xs font-medium ${cell.closed ? 'line-through' : ''}`}>
            {cell.rate === null ? '—' : <>RO ₹{cell.rate.toLocaleString('en-IN')}</>}
          </span>
          {cell.breakfastRate !== null && (
            <span className={`block text-xs font-medium ${cell.closed ? 'line-through' : ''}`}>
              BB ₹{cell.breakfastRate.toLocaleString('en-IN')}
            </span>
          )}
          <span className="block text-[10px] opacity-70">{cell.onSale} on sale</span>
          <span className="block text-[10px] opacity-70">
            {cell.sold} sold · {cell.remaining} left
          </span>
          {marks && (
            <span className="mt-0.5 block text-[10px] font-medium tracking-wide opacity-80">
              {marks}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
