import type { RoomRow } from '@/lib/room-table';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingRoomTable } from './booking-room-table';

const room = (id: string, name: string): RoomRow => ({
  roomTypeId: id,
  name,
  sizeSqFt: 210,
  baseOccupancy: 2,
  extraAdultCharge: 1200,
  facilities: [],
  images: [],
  roomsLeft: 4,
  plans: [
    {
      code: 'EP',
      name: 'Room Only',
      rates: [
        {
          rateType: 'NON_REFUNDABLE',
          ratePlanId: `${id}-ep`,
          total: 10500,
          perNight: 5250,
          taxTotal: 500,
          cancellationDeadline: null,
          breakfastGuests: 0,
        },
      ],
    },
  ],
});

const stay = {
  slug: 'gangtok',
  checkIn: '2026-10-01',
  checkOut: '2026-10-03',
  rooms: 1,
  adults: 2,
  children: 0,
};

const rooms = [room('deluxe', 'Deluxe Room'), room('valentine', 'Valentine Room')];

describe('BookingRoomTable', () => {
  it('opens with nothing chosen when the guest came from the search', () => {
    render(<BookingRoomTable rooms={rooms} unavailable={[]} planCodes={['EP']} stay={stay} />);

    expect(screen.getByText(/Pick a room and a rate/)).toBeInTheDocument();
  });

  it('opens on the room the guest pressed Book Now on', () => {
    render(
      <BookingRoomTable
        rooms={rooms}
        unavailable={[]}
        planCodes={['EP']}
        stay={stay}
        preselectRoom="Valentine Room"
      />,
    );

    const summary = screen.getByText('Your stay').closest('div') as HTMLElement;
    expect(summary).toHaveTextContent('Valentine Room');
    expect(summary).not.toHaveTextContent('Deluxe Room');
  });

  it('ignores a room name this property does not have', () => {
    render(
      <BookingRoomTable
        rooms={rooms}
        unavailable={[]}
        planCodes={['EP']}
        stay={stay}
        preselectRoom="Maharaja Suite"
      />,
    );

    expect(screen.getByText(/Pick a room and a rate/)).toBeInTheDocument();
  });

  it("shows the property's check-in and check-out times against each room", () => {
    render(
      <BookingRoomTable
        rooms={rooms}
        unavailable={[]}
        planCodes={['EP']}
        stay={stay}
        stayWindow="Check-in 2 pm · Check-out 12 noon"
      />,
    );

    expect(screen.getAllByText('Check-in 2 pm · Check-out 12 noon').length).toBeGreaterThan(0);
  });
});
