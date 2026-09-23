import { formatStayDate, nightsBetween } from '@/lib/booking';
import { rateTypeLabel } from '@/lib/cancellation';
import type { Prisma } from '@prisma/client';

// The one description of the sheet: its columns, their widths, and how a row
// is built from a booking. Kept apart from the route so the shape can be
// tested without an HTTP request, and so adding a column is one edit rather
// than three that have to agree.

export type ExportBooking = Prisma.BookingGetPayload<{
  include: { payment: { select: { status: true } } };
}>;

export interface ExportColumn {
  header: string;
  width: number;
  value: (booking: ExportBooking) => string | number | null;
}

function money(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

// Breakfast is a breakdown of the room total, not an addition to it. Bookings
// taken before breakfastAmount existed have no figure, so they say what is
// actually known — how many guests, on which plan — rather than a 0 that would
// claim the guest had no breakfast when the plan name says they did.
function breakfast(booking: ExportBooking): string | number | null {
  if (booking.breakfastAmount !== null) return booking.breakfastAmount.toNumber();
  if (booking.breakfastGuests > 0) {
    return `${booking.breakfastGuests} guest${booking.breakfastGuests === 1 ? '' : 's'} · ${booking.planName ?? 'With Breakfast'}`;
  }
  return null;
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Reference', width: 18, value: (b) => b.reference },
  {
    header: 'Booked at',
    width: 20,
    value: (b) => b.createdAt.toISOString().slice(0, 16).replace('T', ' '),
  },
  { header: 'Hotel', width: 16, value: (b) => b.hotelSlug },
  { header: 'Room', width: 24, value: (b) => b.roomName },
  { header: 'Plan', width: 16, value: (b) => b.planName ?? '' },
  { header: 'Rate type', width: 16, value: (b) => rateTypeLabel(b.rateType) },
  { header: 'Check-in', width: 14, value: (b) => formatStayDate(b.checkIn) },
  { header: 'Check-out', width: 14, value: (b) => formatStayDate(b.checkOut) },
  { header: 'Nights', width: 8, value: (b) => nightsBetween(b.checkIn, b.checkOut) },
  { header: 'Rooms', width: 8, value: (b) => b.rooms },
  { header: 'Adults', width: 8, value: (b) => b.adults },
  { header: 'Children', width: 9, value: (b) => b.children },
  { header: 'Guest name', width: 24, value: (b) => b.guestName },
  { header: 'Phone', width: 18, value: (b) => b.guestPhone },
  { header: 'Email', width: 28, value: (b) => b.guestEmail },
  { header: 'City', width: 18, value: (b) => cityOf(b.billingAddress) },
  { header: 'Room total', width: 13, value: (b) => money(b.roomTotal) },
  { header: 'Breakfast', width: 22, value: breakfast },
  // Zero until transfers exist. The column is here now so the sheet's shape
  // does not change under whoever is already building a report on it.
  { header: 'Transfer', width: 11, value: () => 0 },
  { header: 'GST', width: 11, value: (b) => money(b.taxTotal) },
  { header: 'Total', width: 13, value: (b) => money(b.total) },
  { header: 'Payment', width: 13, value: (b) => b.payment?.status ?? '' },
  { header: 'Booking status', width: 18, value: (b) => b.status },
  {
    header: 'Cancel by',
    width: 14,
    value: (b) => (b.cancellationDeadline ? formatStayDate(b.cancellationDeadline) : ''),
  },
];

// The address is one free-text block on the booking, so the city is read out
// of it rather than stored apart. The booking form's own layout puts it on the
// second-to-last line, above the PIN and country.
export function cityOf(billingAddress: string): string {
  const lines = billingAddress
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3) return '';
  return lines[lines.length - 3] ?? '';
}

export function exportFileName(from: string, to: string, basis: 'booked' | 'stay'): string {
  return `sinclairs-bookings-${basis}-${from}-to-${to}.xlsx`;
}
