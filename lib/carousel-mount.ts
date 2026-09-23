// Which slides of a crossfading carousel may exist in the DOM.
//
// Every slide of a full-bleed carousel sits inside the viewport, hidden only
// by `opacity-0`. Opacity defers nothing, and `loading="lazy"` only defers
// what is off screen — so rendering all of them made the browser fetch every
// hero at once. On the home page that was six pictures, 1.9 MB, five of which
// nobody would see for another half a minute.
//
// So a slide is rendered when it is about to be needed: the one showing and
// the one after it. Callers union this with what they have already mounted,
// which keeps every slide the guest has seen in the DOM — the browser has
// those cached, so the fade back round is instant — and, when a guest clicks
// straight to slide seven, mounts seven and eight rather than everything in
// between.
export function slidesToMount(index: number, count: number): Set<number> {
  if (count <= 0) return new Set();
  return new Set([index % count, (index + 1) % count]);
}

export function mergeMounted(current: Set<number>, next: Set<number>): Set<number> {
  if ([...next].every((i) => current.has(i))) return current;
  return new Set([...current, ...next]);
}
