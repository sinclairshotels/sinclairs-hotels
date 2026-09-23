// The one line a room card shows in place of its description.
//
// Taken from the description rather than written separately, so there is no
// second copy of the same sentence to keep in step — and no field for somebody
// to leave stale. The full text is still one click away behind Details.
export function roomSummary(description: string, limit = 120): string {
  const firstSentence = description.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? description;
  const trimmed = firstSentence.trim();
  if (trimmed.length <= limit) return trimmed;
  // Cut at a word, not mid-word, and let the ellipsis say it was cut.
  const cut = trimmed.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}
