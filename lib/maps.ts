// The Google Maps embed is opt-in per environment. A frame that cannot load —
// blocked by the CSP, by an extension, or by a network that will not reach
// maps.google.com — renders as a grey box, and nothing in the page can detect
// that to recover from it (see components/location-map.tsx). So an environment
// shows the frame only once someone has opened a hotel page there and seen a
// map; everywhere else the address and a link to Google Maps stand in, which is
// what a guest actually needs from that box.
//
// NEXT_PUBLIC_ because the value is read while rendering the page, so it is
// inlined at build time: changing it needs that environment rebuilt, like every
// other build-time variable here.
export function mapsEmbedEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MAPS_EMBED === 'on';
}
