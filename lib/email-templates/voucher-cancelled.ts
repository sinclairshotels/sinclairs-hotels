import { contactNumbers } from '@/content/site';
import type { Hotel } from '@/content/types';
import type { Voucher } from '@prisma/client';
import { emailLayout, escapeHtml } from './layout';

// The guest's copy and the office's are the same facts with a different
// opening line: the guest is told their voucher no longer stands, and staff
// are told which one and why, because the reason is what they will be asked
// about. The reason is staff-written text and is escaped on both.
export function voucherCancelledHtml({
  voucher,
  hotel,
  forStaff = false,
}: {
  voucher: Voucher;
  hotel?: Hotel;
  forStaff?: boolean;
}): string {
  const property = hotel?.name ?? voucher.hotelSlug;
  const stay = `${voucher.checkIn.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })} to ${voucher.checkOut.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}`;

  const opening = forStaff
    ? `Voucher #${voucher.voucherNo} for ${escapeHtml(voucher.guestName)} has been cancelled.`
    : `Your booking voucher #${voucher.voucherNo} for ${escapeHtml(property)} has been cancelled.`;

  const closing = forStaff
    ? ''
    : `<p style="font-size:14px; color:#404040; line-height:22px; margin:0 0 16px;">
        If this is unexpected, please call us on ${escapeHtml(contactNumbers.tollFree)} and quote
        voucher number ${voucher.voucherNo}.
      </p>`;

  const bodyHtml = `
    <p style="font-size:15px; color:#1c1c1a; line-height:24px; margin:0 0 16px;">${opening}</p>
    <table style="width:100%; border-collapse:collapse; font-size:14px; color:#404040; margin:0 0 16px;">
      <tr><td style="padding:4px 0; width:140px; color:#767676;">Property</td><td style="padding:4px 0;">${escapeHtml(property)}</td></tr>
      <tr><td style="padding:4px 0; color:#767676;">Guest</td><td style="padding:4px 0;">${escapeHtml(voucher.guestName)}</td></tr>
      <tr><td style="padding:4px 0; color:#767676;">Stay</td><td style="padding:4px 0;">${escapeHtml(stay)}</td></tr>
      <tr><td style="padding:4px 0; color:#767676;">Reason</td><td style="padding:4px 0;">${escapeHtml(voucher.cancelledReason ?? '')}</td></tr>
      ${forStaff && voucher.cancelledByLabel ? `<tr><td style="padding:4px 0; color:#767676;">Cancelled by</td><td style="padding:4px 0;">${escapeHtml(voucher.cancelledByLabel)}</td></tr>` : ''}
    </table>
    ${closing}
  `;

  return emailLayout({
    title: `Voucher #${voucher.voucherNo} cancelled`,
    bodyHtml,
  });
}
