// "1 dining venues" is the kind of thing nobody notices writing and everybody
// notices reading. One helper, so a count and its noun cannot drift apart.
export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

export function counted(count: number, one: string, many = `${one}s`): string {
  return `${count} ${plural(count, one, many)}`;
}
