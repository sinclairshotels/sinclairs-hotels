import type { CalendarCell, RateCalendar } from '@/lib/rate-calendar';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RateCalendarGrid } from './rate-calendar-grid';

const cell = (overrides: Partial<CalendarCell> & { date: string }): CalendarCell => ({
  rate: 6800,
  breakfastRate: 7800,
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
  breakfastSupplement: 500,
  dates: ['2099-06-01', '2099-06-02', '2099-06-03'],
  holidays: { '2099-06-02': 'Test Holiday' },
  rows: [
    {
      roomTypeId: 'room-deluxe',
      roomName: 'Deluxe Room',
      baseOccupancy: 2,
      cells: [
        cell({ date: '2099-06-01', sold: 1, remaining: 3 }),
        cell({ date: '2099-06-02', sold: 4, remaining: 0 }),
        cell({ date: '2099-06-03', closed: true, minStay: 3, closedToArrival: true }),
      ],
    },
    {
      roomTypeId: 'room-suite',
      roomName: 'Premier Suite',
      baseOccupancy: 2,
      cells: [
        cell({ date: '2099-06-01', rate: null, breakfastRate: null, onSale: 0, remaining: 0 }),
        cell({ date: '2099-06-02', rate: 9500, breakfastRate: 10500, overridden: true }),
        cell({ date: '2099-06-03', rate: 9500, breakfastRate: 10500 }),
      ],
    },
  ],
};

describe('RateCalendarGrid', () => {
  it('lays the nights out across and one row per room down', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByRole('rowheader', { name: /Deluxe Room/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Premier Suite/ })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('shows rate, allotment, sold and remaining for a loaded night', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByText(/Deluxe Room, 2099-06-01: room only 6800 rupees/)).toHaveTextContent(
      '4 on sale, 1 sold, 3 left',
    );
  });

  // The bug this replaces: With Breakfast had its own row, and every cell in it
  // read "—" because only Room Only carries stored prices. It is always on sale
  // wherever Room Only is, so a dash was simply wrong.
  it('states the With Breakfast rate rather than a dash', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByText(/Deluxe Room, 2099-06-01:/)).toHaveTextContent(
      'with breakfast 7800 rupees',
    );
  });

  it('shows both rates in the one cell', () => {
    const { container } = render(<RateCalendarGrid calendar={calendar} />);
    expect(container.textContent).toContain('RO ₹6,800');
    expect(container.textContent).toContain('BB ₹7,800');
  });

  it('says nothing is loaded rather than showing a zero rate', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByText('Premier Suite, 2099-06-01: nothing loaded')).toBeInTheDocument();
  });

  it('marks a night that a daily save has overridden', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByText(/Premier Suite, 2099-06-02:/)).toHaveTextContent('set daily');
    // and the night beside it, written by a monthly save, is not marked
    expect(screen.getByText(/Premier Suite, 2099-06-03:/)).not.toHaveTextContent('set daily');
  });

  it('reports a stop-sold night as such', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByText(/Deluxe Room, 2099-06-03:/)).toHaveTextContent('stop sell');
  });

  it('is read-only — rates are set on the Monthly and Daily screens', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
