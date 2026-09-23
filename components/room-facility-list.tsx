import { getRoomFacilityIcon } from '@/components/room-facility-icon';
import type { RoomFacility } from '@/lib/room-facilities';

// "In your room" — what the room actually holds, as icons with their labels.
// Nothing derived shows nothing: a room whose copy names no fittings renders
// no heading either, rather than an empty box promising a list.
export function RoomFacilityList({
  facilities,
  className = '',
}: { facilities: RoomFacility[]; className?: string }) {
  if (facilities.length === 0) return <div className={className} />;

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dark">In your room</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {facilities.map((facility) => {
          const Icon = getRoomFacilityIcon(facility.key, facility.label);
          return (
            <li key={facility.key} className="flex items-start gap-1.5 text-xs text-ink/70">
              {/* The stroke classes have to come along: className replaces the
                  icon's own default rather than adding to it. */}
              <Icon className="mt-px h-4 w-4 shrink-0 fill-none stroke-current stroke-[1.6] text-gold-dark" />
              {facility.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
