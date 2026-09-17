import { prisma } from '@/lib/db';

export interface RoomDisplay {
  name: string;
  active: boolean;
}

// Room photography and copy stay in content/hotels; the display name and
// whether the room is still sold are staff data. This joins the two by
// contentKey so a rename made in the back office reaches the public page
// without a deploy, and a deactivated room stops being listed there.
export async function roomDisplayNames(hotelSlug: string): Promise<Map<string, RoomDisplay>> {
  const rooms = await prisma.roomType.findMany({
    where: { hotelSlug },
    select: { contentKey: true, name: true, active: true },
  });

  return new Map(rooms.map((room) => [room.contentKey, { name: room.name, active: room.active }]));
}
