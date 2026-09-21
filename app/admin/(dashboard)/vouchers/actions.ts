'use server';

import { randomBytes } from 'node:crypto';
import { getHotelBySlug } from '@/content/hotels';
import { bookingOffices } from '@/content/site';
import { authorize } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { voucherAdminHtml } from '@/lib/email-templates/voucher-admin';
import { voucherGuestHtml } from '@/lib/email-templates/voucher-guest';
import { VOUCHER_OFFICE_EMAIL, sendMail } from '@/lib/mail';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { publicSiteUrl } from '@/lib/site-url';
import { voucherSchema } from '@/lib/validation';
import { cookies, headers } from 'next/headers';

export type VoucherFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
  voucherNo?: number;
};

export async function createVoucher(
  _prevState: VoucherFormState,
  formData: FormData,
): Promise<VoucherFormState> {
  const auth = await authorize('vouchers:write');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const headerList = await headers();
  const ip = clientIp(headerList);

  if (isRateLimited(`voucher:${ip}`)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = voucherSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  const viewToken = randomBytes(32).toString('base64url');

  const voucher = await prisma.voucher.create({
    data: {
      viewToken,
      hotelSlug: d.hotelSlug,
      guestName: d.guestName,
      guestPhone: d.guestPhone,
      guestEmail: d.guestEmail,
      billingAddress: d.billingAddress,
      travelAgentName: d.travelAgentName || null,
      travelAgentPan: d.travelAgentPan || null,
      travelAgentGstin: d.travelAgentGstin || null,
      travelAgentState: d.travelAgentState || null,
      commissionPct: d.commissionPct ?? null,
      tdsPct: d.tdsPct ?? null,
      rooms: d.rooms,
      checkIn: new Date(d.checkIn),
      checkOut: new Date(d.checkOut),
      rate: d.rate,
      taxes: d.taxes,
      depositAmount: d.depositAmount ?? null,
      depositReceiptNo: d.depositReceiptNo || null,
      depositReceiptDate: d.depositReceiptDate ? new Date(d.depositReceiptDate) : null,
      billingInstructions: d.billingInstructions || null,
      arrivalDetails: d.arrivalDetails || null,
      otherServices: d.otherServices || null,
      specialInstructions: d.specialInstructions || null,
      issuerName: d.issuerName,
      issuerPhone: d.issuerPhone,
      bookingOffice: d.bookingOffice,
    },
  });

  const hotel = getHotelBySlug(voucher.hotelSlug);
  const viewUrl = `${publicSiteUrl}/v/${voucher.viewToken}`;
  const office = bookingOffices.find((o) => o.name === voucher.bookingOffice);

  await sendMail({
    to: voucher.guestEmail,
    kind: 'voucher-guest',
    subject: `Your Sinclairs Booking Voucher — #${voucher.voucherNo}`,
    html: voucherGuestHtml({ voucher, hotel, viewUrl }),
  });

  const officeCopyBcc = [office?.email, VOUCHER_OFFICE_EMAIL].filter(
    (email, index, all): email is string => Boolean(email) && all.indexOf(email) === index,
  );

  await sendMail({
    to: hotel?.contact?.notificationEmail ?? VOUCHER_OFFICE_EMAIL,
    kind: 'voucher-office',
    bcc: officeCopyBcc,
    subject: `[Office Copy] Voucher #${voucher.voucherNo} — ${voucher.guestName}`,
    html: voucherAdminHtml({ voucher, hotel }),
  });

  return {
    status: 'success',
    message: `Voucher #${voucher.voucherNo} created and emailed.`,
    voucherNo: voucher.voucherNo,
  };
}
