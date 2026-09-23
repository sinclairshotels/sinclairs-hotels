import { stayTimes } from '@/content/site';

// Check-in and check-out differ by property (Gangtok is 2 pm, Dooars leaves at
// 10 am), so a guest comparing rooms is comparing stays of different shapes.
// The times belong next to the room, not only in the terms at the bottom of a
// confirmation nobody has yet.
//
// A slug with no published pair returns null rather than the commonest times:
// stating a time the property never published is worse than stating none.
export function stayWindowLine(hotelSlug: string): string | null {
  const times = stayTimes[hotelSlug];
  if (!times) return null;
  return `Check-in ${times.checkIn} · Check-out ${times.checkOut}`;
}
