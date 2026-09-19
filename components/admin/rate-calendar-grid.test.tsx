import type { CalendarCell, RateCalendar } from '@/lib/rate-calendar';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RateCalendarGrid } from './rate-calendar-grid';

const cell = (overrides: Partial<CalendarCell> & { date: string }): CalendarCell => ({
  rate: 6800,
  onSale: 4,
  sold: 0,
  remaining: 4,
  closed: false,
  minStay: null,
  closedToArrival: false,
  closedToDeparture: false,
  overridden: false,
  ...overrides,
});

const calendar: RateCalendar = {
  hotelSlug: 'gangtok',
  hotelName: 'Sinclairs Gangtok',
  dates: ['2099-06-01', '2099-06-02', '2099-06-03'],
  holidays: { '2099-06-02': 'Test Holiday' },
  rows: [
    {
      roomTypeId: 'room-deluxe',
      ratePlanId: 'plan-deluxe-ep',
      roomName: 'Deluxe Room',
      ratePlanName: 'Room Only',
      cells: [
        cell({ date: '2099-06-01', sold: 1, remaining: 3 }),
        cell({ date: '2099-06-02', sold: 4, remaining: 0 }),
        cell({ date: '2099-06-03', closed: true, minStay: 3, closedToArrival: true }),
      ],
    },
    {
      roomTypeId: 'room-suite',
      ratePlanId: 'plan-suite-ep',
      roomName: 'Premier Suite',
      ratePlanName: 'Room Only',
      cells: [
        cell({ date: '2099-06-01', rate: null, onSale: 0, remaining: 0 }),
        cell({ date: '2099-06-02', rate: 9500, overridden: true }),
        cell({ date: '2099-06-03', rate: 9500 }),
      ],
    },
  ],
};

describe('RateCalendarGrid', () => {
  it('lays the nights out across and the room-plan pairs down', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByRole('rowheader', { name: /Deluxe Room/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Premier Suite/ })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('shows rate, allotment, sold and remaining for a loaded night', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByText(/Deluxe Room, Room Only, 2099-06-01: 6800 rupees/)).toHaveTextContent(
      '4 on sale, 1 sold, 3 left',
    );
  });

  it('says nothing is loaded rather than showing a zero rate', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(
      screen.getByText('Premier Suite, Room Only, 2099-06-01: nothing loaded'),
    ).toBeInTheDocument();
  });

  it('marks a night that a daily save has overridden', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByText(/Premier Suite, Room Only, 2099-06-02:/)).toHaveTextContent(
      'set daily',
    );
    // and the night beside it, written by a monthly save, is not marked
    expect(screen.getByText(/Premier Suite, Room Only, 2099-06-03:/)).not.toHaveTextContent(
      'set daily',
    );
  });

  it('reports a stop-sold night as such', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByText(/Deluxe Room, Room Only, 2099-06-03:/)).toHaveTextContent('stop sell');
  });

  it('is read-only — rates are set on the Monthly and Daily screens', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
