import { emailLayout, escapeHtml } from './layout';

type DigestEnquiry = {
  property: string;
  checkIn: Date | null;
  checkOut: Date | null;
  name: string;
  message: string;
};

type DigestPayment = {
  hotelName: string;
  orderId: string;
  amount: string;
  guestName: string;
  bankRefNo: string | null;
};

// Unlike the rest of the digest these two are not "what happened yesterday",
// they are "what is still wrong this morning" — a guest who paid for a room
// that had gone, and a calendar about to run dry. Both are already on the
// dashboard; they are here because the dashboard only speaks to someone who
// opens it, and these are the two failures that cost money in silence.
type DigestRefundDue = {
  reference: string;
  hotelName: string;
  amount: string;
  bookedOn: string;
};

type DigestCoverage = {
  hotelName: string;
  roomName: string;
  daysLeft: number;
};

function refundRowsHtml(refunds: DigestRefundDue[]): string {
  if (refunds.length === 0) {
    return '<p style="font-size:13px; color:#6b6b63; margin:0 0 20px;">None outstanding.</p>';
  }
  const rows = refunds
    .map(
      (r) => `<tr>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(r.reference)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(r.hotelName)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(r.bookedOn)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">Rs ${escapeHtml(r.amount)}</td>
</tr>`,
    )
    .join('\n');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-family:Arial, Helvetica, sans-serif; font-size:12px; margin-bottom:20px;">
<tr style="background-color:#8c2f1f; color:#ffffff;">
<td style="padding:6px 12px;"><strong>Reference</strong></td>
<td style="padding:6px 12px;"><strong>Hotel</strong></td>
<td style="padding:6px 12px;"><strong>Booked</strong></td>
<td style="padding:6px 12px;"><strong>Amount</strong></td>
</tr>
${rows}
</table>`;
}

function coverageRowsHtml(coverage: DigestCoverage[]): string {
  if (coverage.length === 0) {
    return '<p style="font-size:13px; color:#6b6b63; margin:0 0 20px;">Every room type is loaded past the warning window.</p>';
  }
  const rows = coverage
    .map(
      (c) => `<tr>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(c.hotelName)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(c.roomName)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${c.daysLeft === 0 ? 'nothing loaded' : `${c.daysLeft} day${c.daysLeft === 1 ? '' : 's'} left`}</td>
</tr>`,
    )
    .join('\n');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-family:Arial, Helvetica, sans-serif; font-size:12px; margin-bottom:20px;">
<tr style="background-color:#8a6d2f; color:#ffffff;">
<td style="padding:6px 12px;"><strong>Hotel</strong></td>
<td style="padding:6px 12px;"><strong>Room</strong></td>
<td style="padding:6px 12px;"><strong>Loaded</strong></td>
</tr>
${rows}
</table>`;
}

function enquiryRowsHtml(enquiries: DigestEnquiry[]): string {
  if (enquiries.length === 0) {
    return '<p style="font-size:13px; color:#6b6b63; margin:0 0 20px;">No enquiries.</p>';
  }
  const rows = enquiries
    .map(
      (e) => `<tr>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(e.property)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${e.checkIn ? e.checkIn.toLocaleDateString('en-IN') : '—'}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${e.checkOut ? e.checkOut.toLocaleDateString('en-IN') : '—'}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(e.name)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(e.message.slice(0, 80))}</td>
</tr>`,
    )
    .join('\n');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-family:Arial, Helvetica, sans-serif; font-size:12px; margin-bottom:20px;">
<tr style="background-color:#006b54; color:#ffffff;">
<td style="padding:6px 12px;"><strong>Hotel</strong></td>
<td style="padding:6px 12px;"><strong>Check-in</strong></td>
<td style="padding:6px 12px;"><strong>Check-out</strong></td>
<td style="padding:6px 12px;"><strong>Name</strong></td>
<td style="padding:6px 12px;"><strong>Message</strong></td>
</tr>
${rows}
</table>`;
}

function paymentRowsHtml(payments: DigestPayment[]): string {
  if (payments.length === 0) {
    return '<p style="font-size:13px; color:#6b6b63; margin:0;">No successful payments.</p>';
  }
  const rows = payments
    .map(
      (p) => `<tr>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(p.hotelName)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(p.orderId)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">INR ${escapeHtml(p.amount)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(p.guestName)}</td>
<td style="padding:6px 12px; border-bottom:1px solid #e5e0d5;">${escapeHtml(p.bankRefNo ?? '—')}</td>
</tr>`,
    )
    .join('\n');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-family:Arial, Helvetica, sans-serif; font-size:12px;">
<tr style="background-color:#006b54; color:#ffffff;">
<td style="padding:6px 12px;"><strong>Hotel</strong></td>
<td style="padding:6px 12px;"><strong>i-Pay Order No.</strong></td>
<td style="padding:6px 12px;"><strong>Amount</strong></td>
<td style="padding:6px 12px;"><strong>Paid By</strong></td>
<td style="padding:6px 12px;"><strong>Bank Ref. No.</strong></td>
</tr>
${rows}
</table>`;
}

export function dailyDigestHtml(data: {
  dateLabel: string;
  enquiries: DigestEnquiry[];
  newsletterEmails: string[];
  payments: DigestPayment[];
  refundsDue: DigestRefundDue[];
  coverage: DigestCoverage[];
}): string {
  const needsAction = data.refundsDue.length + data.coverage.length;

  const bodyHtml = `
    ${
      needsAction > 0
        ? `<p style="font-size:14px; margin:0 0 20px; padding:10px 12px; background-color:#fdf3f1; border-left:3px solid #8c2f1f;">
      <strong>${needsAction} thing${needsAction === 1 ? '' : 's'} need${needsAction === 1 ? 's' : ''} attention</strong> —
      ${data.refundsDue.length} booking${data.refundsDue.length === 1 ? '' : 's'} owed a refund,
      ${data.coverage.length} room type${data.coverage.length === 1 ? '' : 's'} short of rates.
    </p>`
        : ''
    }

    <p style="font-size:14px; margin:24px 0 8px;"><strong>Owed a refund</strong></p>
    <p style="font-size:12px; color:#6b6b63; margin:0 0 8px;">
      Paid, but the room was gone by the time the bank confirmed. Refund from Payments in the admin — nothing moves money on its own.
    </p>
    ${refundRowsHtml(data.refundsDue)}

    <p style="font-size:14px; margin:24px 0 8px;"><strong>Rates running out</strong></p>
    <p style="font-size:12px; color:#6b6b63; margin:0 0 8px;">
      A calendar that runs out has no symptom — the room simply stops being offered.
    </p>
    ${coverageRowsHtml(data.coverage)}

    <p style="font-size:14px; margin:0 0 20px;">
      <strong>${data.enquiries.length}</strong> enquir${data.enquiries.length === 1 ? 'y' : 'ies'},
      <strong>${data.newsletterEmails.length}</strong> newsletter signup${data.newsletterEmails.length === 1 ? '' : 's'}, and
      <strong>${data.payments.length}</strong> successful payment${data.payments.length === 1 ? '' : 's'}.
    </p>

    <p style="font-size:14px; margin:24px 0 8px;"><strong>Enquiries</strong></p>
    ${enquiryRowsHtml(data.enquiries)}

    <p style="font-size:14px; margin:24px 0 8px;"><strong>Newsletter Signups</strong></p>
    <p style="font-size:13px; margin:0 0 20px;">
      ${data.newsletterEmails.length > 0 ? data.newsletterEmails.map((e) => escapeHtml(e)).join(', ') : 'None.'}
    </p>

    <p style="font-size:14px; margin:24px 0 8px;"><strong>i-Pay — Online Payments</strong></p>
    ${paymentRowsHtml(data.payments)}
  `;

  return emailLayout({ title: `Sinclairs Hotels Daily Digest — ${data.dateLabel}`, bodyHtml });
}
