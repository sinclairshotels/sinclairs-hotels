import type { Hotel } from '@/content/types';
import type { Voucher } from '@prisma/client';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(value: unknown): string {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Fields shown to the guest — the "view voucher" page and the guest copy email both
// use this same list, so what's guest-visible is decided in exactly one place.
export function voucherGuestFields(voucher: Voucher, hotel?: Hotel): Array<[string, string]> {
  const fields: Array<[string, string]> = [
    ['Voucher No.', String(voucher.voucherNo)],
    ['Hotel', hotel?.name ?? voucher.hotelSlug],
    ['Guest Name', voucher.guestName],
    ['Phone', voucher.guestPhone],
    ['Email', voucher.guestEmail],
    ['Billing Address', voucher.billingAddress],
  ];

  if (voucher.travelAgentName) fields.push(['Travel Agent', voucher.travelAgentName]);
  if (voucher.travelAgentGstin) {
    fields.push([
      'GSTIN',
      `${voucher.travelAgentGstin}${voucher.travelAgentState ? ` (${voucher.travelAgentState})` : ''}`,
    ]);
  }
  if (voucher.travelAgentPan) fields.push(['PAN', voucher.travelAgentPan]);

  fields.push(['No. of Rooms', String(voucher.rooms)]);
  if (voucher.roomCategory) fields.push(['Room Category', voucher.roomCategory]);
  if (voucher.mealPlan) fields.push(['Meal Plan', voucher.mealPlan]);

  fields.push(
    ['Check In', formatDate(voucher.checkIn)],
    ['Check Out', formatDate(voucher.checkOut)],
    ['Rate + GST', `${formatMoney(voucher.rate)} + ${formatMoney(voucher.taxes)}`],
  );

  // "Advance paid" is what reservations call it and what a guest arriving at
  // the desk asks about; the columns are still the deposit ones.
  if (voucher.depositAmount) fields.push(['Advance Paid', formatMoney(voucher.depositAmount)]);
  if (voucher.depositReceiptDate)
    fields.push(['Advance Paid On', formatDate(voucher.depositReceiptDate)]);
  if (voucher.depositReceiptNo) fields.push(['Receipt No.', voucher.depositReceiptNo]);
  // On the guest's copy as well as the office one: it says who settles what,
  // which is the thing argued about at check-out.
  if (voucher.billingInstructions)
    fields.push(['Billing Instructions', voucher.billingInstructions]);
  if (voucher.arrivalDetails) fields.push(['Arrival Details', voucher.arrivalDetails]);
  if (voucher.otherServices) fields.push(['Other Services', voucher.otherServices]);

  fields.push(['Booking Office', voucher.bookingOffice], ['Issued By', voucher.issuerName]);

  return fields;
}

// Guest-visible fields plus internal-only billing detail — used by the office/admin
// copy email only, never by anything the guest sees.
export function voucherAdminFields(voucher: Voucher, hotel?: Hotel): Array<[string, string]> {
  const fields = voucherGuestFields(voucher, hotel);

  if (voucher.commissionPct) fields.push(['Commission', `${voucher.commissionPct}%`]);
  if (voucher.tdsPct) fields.push(['TDS', `${voucher.tdsPct}%`]);
  if (voucher.specialInstructions) fields.push(['Details to Unit', voucher.specialInstructions]);

  return fields;
}
