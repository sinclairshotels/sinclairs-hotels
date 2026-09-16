import type { CalendarCell, RateCalendar } from '@/lib/rate-calendar';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RateCalendarGrid } from './rate-calendar-grid';

vi.mock('@/app/admin/(dashboard)/rates/edit-actions', () => ({
  editRates: vi.fn(),
  copyWeek: vi.fn(),
  copyRoomRates: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const cell = (overrides: Partial<CalendarCell> & { date: string }): CalendarCell => ({
  rate: 6800,
  onSale: 4,
  sold: 0,
  remaining: 4,
  closed: false,
  minStay: null,
  closedToArrival: false,
  closedToDeparture: false,
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
      roomTypeId: 'room-family',
      ratePlanId: 'plan-family-ep',
      roomName: 'Deluxe Family Room',
      ratePlanName: 'Room Only',
      cells: [
        cell({ date: '2099-06-01', rate: null, onSale: 0, remaining: 0 }),
        cell({ date: '2099-06-02', rate: 9200, onSale: 2, sold: 0, remaining: 2 }),
        cell({ date: '2099-06-03', rate: 9200, onSale: 2, sold: 0, remaining: 2 }),
      ],
    },
  ],
};

const cellAt = (row: number, date: string) =>
  screen.getAllByRole('button').filter((button) => {
    const label = button.getAttribute('aria-label') ?? '';
    return label.includes(calendar.rows[row]?.roomName ?? '') && label.includes(date);
  })[0] as HTMLElement;

describe('RateCalendarGrid', () => {
  it('lays rooms and plans down the side and dates across the top', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit />);

    expect(screen.getByRole('rowheader', { name: /Deluxe Room/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /Deluxe Family Room/ })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(calendar.dates.length + 1);
  });

  it('shows rate, on sale, sold and left in a loaded cell', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit />);

    const target = cellAt(0, '2099-06-01');
    expect(target).toHaveTextContent('₹6,800');
    expect(target).toHaveTextContent('4 on sale');
    expect(target).toHaveTextContent('1 sold · 3 left');
  });

  it('marks an unloaded night as nothing rather than a zero rate', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit />);

    expect(cellAt(1, '2099-06-01')).toHaveTextContent('—');
    expect(cellAt(1, '2099-06-01')).not.toHaveTextContent('₹0');
  });

  it('shows the restrictions staff set on the cell itself', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit />);

    // Minimum stay of three, closed to arrival.
    expect(cellAt(0, '2099-06-03')).toHaveTextContent('3+ A');
  });

  it('colours a sold-out night differently from one with room left', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit />);

    expect(cellAt(0, '2099-06-02').className).toContain('bg-red-50');
    expect(cellAt(0, '2099-06-01').className).not.toContain('bg-red-50');
  });

  it('selects a single night on click', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit />);

    fireEvent.click(cellAt(0, '2099-06-01'));

    expect(cellAt(0, '2099-06-01')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 night selected')).toBeInTheDocument();
  });

  it('takes the block between two cells on shift-click', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit />);

    fireEvent.click(cellAt(0, '2099-06-01'));
    fireEvent.click(cellAt(1, '2099-06-03'), { shiftKey: true });

    // Two rows by three dates.
    expect(screen.getByText('6 nights selected')).toBeInTheDocument();
    expect(cellAt(1, '2099-06-02')).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts a fresh selection on a plain click after a block', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit />);

    fireEvent.click(cellAt(0, '2099-06-01'));
    fireEvent.click(cellAt(1, '2099-06-03'), { shiftKey: true });
    fireEvent.click(cellAt(1, '2099-06-02'));

    expect(screen.getByText('1 night selected')).toBeInTheDocument();
    expect(cellAt(0, '2099-06-01')).toHaveAttribute('aria-pressed', 'false');
  });

  it('posts every selected row and date to the edit action', () => {
    const { container } = render(<RateCalendarGrid calendar={calendar} canEdit />);

    fireEvent.click(cellAt(0, '2099-06-01'));
    fireEvent.click(cellAt(1, '2099-06-02'), { shiftKey: true });

    const hidden = Array.from(container.querySelectorAll('input[type="hidden"]'));
    const rows = hidden
      .filter((i) => i.getAttribute('name') === 'rows')
      .map((i) => i.getAttribute('value'));
    const dates = hidden
      .filter((i) => i.getAttribute('name') === 'dates')
      .map((i) => i.getAttribute('value'));

    expect(rows).toEqual(['room-deluxe:plan-deluxe-ep', 'room-family:plan-family-ep']);
    expect(dates).toEqual(['2099-06-01', '2099-06-02']);
  });

  it('offers no editing at all to someone who may only read', () => {
    render(<RateCalendarGrid calendar={calendar} canEdit={false} />);

    fireEvent.click(cellAt(0, '2099-06-01'));

    expect(screen.queryByText(/night selected/)).not.toBeInTheDocument();
    expect(cellAt(0, '2099-06-01')).toBeDisabled();
  });
});
