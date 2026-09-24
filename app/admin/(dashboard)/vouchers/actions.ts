'use server';

import { randomBytes } from 'node:crypto';
import { getHotelBySlug } from '@/content/hotels';
import { bookingOffices } from '@/content/site';
import { addressFromInput } from '@/lib/address';
import { recordAudit } from '@/lib/audit';
import { authorize, canAccessHotel } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { voucherAdminHtml } from '@/lib/email-templates/voucher-admin';
import { voucherCancelledHtml } from '@/lib/email-templates/voucher-cancelled';
import { voucherGuestHtml } from '@/lib/email-templates/voucher-guest';
import { log } from '@/lib/log';
import { VOUCHER_OFFICE_EMAIL, sendMail } from '@/lib/mail';
import { recipientsFor } from '@/lib/notification-emails';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { publicSiteUrl } from '@/lib/site-url';
import { cancelVoucherSchema, voucherSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
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

  // A new voucher can only name a property the group still sells. The
  // dropdown offers exactly these, but a dropdown is presentation, never a
  // permission — and the one slug this is really about, "Sinclairs Yangang",
  // exists on 1,300 imported vouchers and must stay readable and filterable
  // while never being written again.
  if (!getHotelBySlug(d.hotelSlug)) {
    return {
      status: 'error',
      message: 'That property is no longer open for new vouchers.',
      fieldErrors: { hotelSlug: ['Choose a current property'] },
    };
  }

  const viewToken = randomBytes(32).toString('base64url');

  const voucher = await prisma.voucher.create({
    data: {
      viewToken,
      hotelSlug: d.hotelSlug,
      guestName: d.guestName,
      guestPhone: d.guestPhone,
      guestEmail: d.guestEmail,
      billingAddress: addressFromInput(d),
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
      roomCategory: d.roomCategory || null,
      mealPlan: d.mealPlan || null,
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

export type CancelVoucherState = { status: 'idle' | 'success' | 'error'; message?: string };

// Cancelled, not deleted. The voucher was emailed to a guest and quoted to a
// property; a row that disappears cannot answer what happened to it, and the
// reason is the thing anyone asks about afterwards.
export async function cancelVoucher(
  _prev: CancelVoucherState,
  formData: FormData,
): Promise<CancelVoucherState> {
  const auth = await authorize('vouchers:write');
  if (!auth.ok) return { status: 'error', message: auth.message };

  const headerList = await headers();
  const ip = clientIp(headerList);
  if (isRateLimited(`voucher-cancel:${auth.user.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const parsed = cancelVoucherSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Please give a reason.',
    };
  }

  const before = await prisma.voucher.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { status: 'error', message: 'That voucher no longer exists.' };
  if (!canAccessHotel(auth.user, before.hotelSlug)) {
    return { status: 'error', message: 'That voucher belongs to another property.' };
  }
  if (before.cancelledAt) {
    return { status: 'error', message: `Voucher #${before.voucherNo} is already cancelled.` };
  }

  const voucher = await prisma.voucher.update({
    where: { id: before.id },
    data: {
      cancelledAt: new Date(),
      cancelledReason: parsed.data.reason,
      // Stored beside the reason, so the record still reads correctly once
      // that staff account is deleted.
      cancelledByLabel: auth.user.name || auth.user.email,
    },
  });

  const hotel = getHotelBySlug(voucher.hotelSlug);

  await recordAudit({
    user: auth.user,
    action: 'voucher.cancelled',
    entity: 'Voucher',
    entityId: voucher.id,
    hotelSlug: voucher.hotelSlug,
    summary: `Voucher #${voucher.voucherNo} cancelled — ${parsed.data.reason}`,
    before: { cancelledAt: null },
    after: { cancelledAt: voucher.cancelledAt, reason: parsed.data.reason },
    ip,
  });
  log.info('voucher.cancelled', { voucher_no: voucher.voucherNo, hotel: voucher.hotelSlug });

  await sendMail({
    to: voucher.guestEmail,
    kind: 'voucher-cancelled-guest',
    subject: `Your Sinclairs voucher #${voucher.voucherNo} has been cancelled`,
    html: voucherCancelledHtml({ voucher, hotel }),
  });

  // Its own list, not the one that is told when a voucher is issued: a
  // document withdrawn is different news from a document sent. No fallback is
  // invented — the guest has already been told, and the audit log is the
  // record that it happened.
  const staff = await recipientsFor('VOUCHER_CANCELLATION', voucher.hotelSlug);
  if (staff.to.length > 0 || staff.cc.length > 0 || staff.bcc.length > 0) {
    await sendMail({
      ...staff,
      to: staff.to,
      kind: 'voucher-cancelled-staff',
      subject: `Voucher #${voucher.voucherNo} cancelled — ${voucher.guestName}`,
      html: voucherCancelledHtml({ voucher, hotel, forStaff: true }),
    });
  }

  revalidatePath('/admin/vouchers');
  revalidatePath(`/v/${voucher.viewToken}`);
  return { status: 'success', message: `Voucher #${voucher.voucherNo} cancelled.` };
}
