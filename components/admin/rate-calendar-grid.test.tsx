import type { RateCalendar } from '@/lib/rate-calendar';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RateCalendarGrid } from './rate-calendar-grid';

vi.mock('@/app/admin/(dashboard)/rates/actions', () => ({ saveRates: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const calendar: RateCalendar = {
  hotelSlug: 'gangtok',
  hotelName: 'Sinclairs Gangtok',
  dates: ['2099-06-01', '2099-06-02'],
  rows: [
    {
      roomName: 'Deluxe Room',
      cells: [
        { date: '2099-06-01', rate: 6800, onSale: 5, sold: 2, remaining: 3, closed: false },
        { date: '2099-06-02', rate: 6800, onSale: 5, sold: 5, remaining: 0, closed: false },
      ],
    },
    {
      roomName: 'Deluxe Family Room',
      cells: [
        { date: '2099-06-01', rate: null, onSale: 0, sold: 0, remaining: 0, closed: false },
        { date: '2099-06-02', rate: 9200, onSale: 2, sold: 0, remaining: 2, closed: true },
      ],
    },
  ],
};

describe('RateCalendarGrid', () => {
  it('lays rooms down the side and dates across the top', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    expect(screen.getByRole('columnheader', { name: 'Room' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Deluxe Room' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Deluxe Family Room' })).toBeInTheDocument();
  });

  it('shows rate, rooms on sale, sold and remaining in every loaded cell', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    const cell = screen.getByRole('button', {
      name: /2099-06-01: 6800 rupees, 5 on sale, 2 sold, 3 remaining/i,
    });
    expect(cell).toHaveTextContent('₹6,800');
    expect(cell).toHaveTextContent('5 on sale');
    expect(cell).toHaveTextContent('2 sold · 3 left');
  });

  it('marks an unloaded night as having nothing, not as a zero rate', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    const cell = screen.getByRole('button', { name: /2099-06-01: no rate loaded/i });
    expect(cell).toHaveTextContent('—');
    expect(cell).not.toHaveTextContent('₹0');
  });

  it('opens an editor for the night that was clicked', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: /2099-06-01: 6800 rupees, 5 on sale, 2 sold, 3 remaining/i,
      }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Prefilled from that cell, so a small edit does not mean retyping it.
    expect(screen.getByLabelText('Rate per night (₹)')).toHaveValue(6800);
    expect(screen.getByLabelText('Rooms on sale')).toHaveValue(5);
  });

  it('warns before letting staff cut an allotment below what is already booked', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: /2099-06-01: 6800 rupees, 5 on sale, 2 sold, 3 remaining/i,
      }),
    );

    expect(screen.getByText(/2 rooms are already booked for this night/i)).toBeInTheDocument();
  });

  it('does not warn about existing bookings on a night with none', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    fireEvent.click(screen.getByRole('button', { name: /2099-06-01: no rate loaded/i }));

    expect(screen.queryByText(/already booked for this night/i)).not.toBeInTheDocument();
  });

  it('submits a single night, pre-confirmed — the preview step is for bulk loads', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    fireEvent.click(screen.getByRole('button', { name: /2099-06-02: 9200 rupees/i }));

    const dialog = screen.getByRole('dialog');
    const hidden = Object.fromEntries(
      Array.from(dialog.querySelectorAll('input[type="hidden"]')).map((input) => [
        input.getAttribute('name'),
        input.getAttribute('value'),
      ]),
    );

    expect(hidden).toEqual({
      hotelSlug: 'gangtok',
      roomName: 'Deluxe Family Room',
      from: '2099-06-02',
      to: '2099-06-02',
      confirmed: 'on',
    });
  });

  it('carries a stop sell into the editor', () => {
    render(<RateCalendarGrid calendar={calendar} />);

    fireEvent.click(screen.getByRole('button', { name: /2099-06-02: 9200 rupees/i }));

    expect(screen.getByLabelText(/stop sell this night/i)).toBeChecked();
  });
});
