import { VOUCHER_TERMS_HTML } from '@/content/legal';
import type { Hotel } from '@/content/types';
import type { Voucher } from '@prisma/client';
import { voucherGuestFields } from '../voucher-view';
import { buttonHtml, emailLayout, escapeHtml, fieldRowsHtml } from './layout';

export function voucherGuestHtml({
  voucher,
  hotel,
  viewUrl,
}: {
  voucher: Voucher;
  hotel?: Hotel;
  viewUrl: string;
}): string {
  const contactHtml = hotel?.contact
    ? `<p style="font-size:12px; color:#404040; margin:16px 0;">
        <strong>${escapeHtml(hotel.name)}</strong><br>
        ${escapeHtml(hotel.contact.address)}<br>
        Phone: ${escapeHtml(hotel.contact.phone)}
      </p>`
    : '';

  const bodyHtml = `
    <p style="font-size:14px; margin:0 0 16px;">Dear ${escapeHtml(voucher.guestName)},</p>
    <p style="font-size:14px; margin:0 0 20px;">Please find your booking voucher details below.</p>
    ${fieldRowsHtml(voucherGuestFields(voucher, hotel))}
    ${contactHtml}
    <div style="margin:20px 0;">
      ${buttonHtml(viewUrl, 'View This Voucher Online')}
    </div>
    ${VOUCHER_TERMS_HTML}
  `;

  return emailLayout({ title: `Your Sinclairs Booking Voucher #${voucher.voucherNo}`, bodyHtml });
}
