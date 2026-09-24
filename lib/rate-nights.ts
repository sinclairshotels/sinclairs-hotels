import { addDays, dateKey, formatStayDate, parseDateOnly } from '@/lib/booking';

// A daily override used to be one night at a time, which is how a wedding
// weekend took six visits to the form. These turn "a range, plus a few odd
// dates" into the list of nights to write, and back into words for the
// preview and the audit line.

// A season's worth at most. The monthly screen is the right tool past that,
// and an unbounded list is an unbounded transaction.
export const MAX_NIGHTS_PER_OVERRIDE = 62;

export function expandRange(fromKey: string, toKey: string): string[] {
  const from = parseDateOnly(fromKey);
  const to = parseDateOnly(toKey);
  if (!from || !to || to < from) return from ? [dateKey(from)] : [];

  const out: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    out.push(dateKey(day));
    if (out.length > MAX_NIGHTS_PER_OVERRIDE) break;
  }
  return out;
}

// Sorted, de-duplicated, and only dates that are really dates. A range and a
// handful of individual nights arrive as one comma-separated field, so the
// two ways of choosing cannot disagree about what gets written.
export function parseNightKeys(raw: string | undefined): string[] {
  const keys = (raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => parseDateOnly(part) !== null);

  return [...new Set(keys)].sort();
}

// "1 Oct 2026", "1–3 Oct 2026", "1–3 Oct 2026, 15 Oct 2026" — consecutive
// nights collapse into a run, because a list of thirty-one dates is not
// something anyone checks before pressing Save.
export function describeNights(keys: string[]): string {
  if (keys.length === 0) return 'no nights';

  const runs: Array<[string, string]> = [];
  for (const key of keys) {
    const last = runs.at(-1);
    const previous = last ? parseDateOnly(last[1]) : null;
    const current = parseDateOnly(key);
    if (last && previous && current && current.getTime() === previous.getTime() + 86_400_000) {
      last[1] = key;
      continue;
    }
    runs.push([key, key]);
  }

  return runs
    .map(([start, end]) => {
      const from = parseDateOnly(start);
      const to = parseDateOnly(end);
      if (!from || !to) return start;
      return start === end
        ? formatStayDate(from)
        : `${formatStayDate(from)} – ${formatStayDate(to)}`;
    })
    .join(', ');
}
