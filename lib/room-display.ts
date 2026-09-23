import { prisma } from '@/lib/db';

export interface RoomDisplay {
  name: string;
  active: boolean;
  // Null where staff have not entered one. The caller falls back to the figure
  // in the content file, which is where these came from in the first place.
  sizeSqFt: number | null;
}

// Room photography and copy stay in content/hotels; the display name and
// whether the room is still sold are staff data. This joins the two by
// contentKey so a rename made in the back office reaches the public page
// without a deploy, and a deactivated room stops being listed there.
export async function roomDisplayNames(hotelSlug: string): Promise<Map<string, RoomDisplay>> {
  const rooms = await prisma.roomType.findMany({
    where: { hotelSlug },
    select: { contentKey: true, name: true, active: true, sizeSqFt: true },
  });

  return new Map(
    rooms.map((room) => [
      room.contentKey,
      { name: room.name, active: room.active, sizeSqFt: room.sizeSqFt },
    ]),
  );
}
