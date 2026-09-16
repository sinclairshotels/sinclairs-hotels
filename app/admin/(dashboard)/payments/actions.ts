'use server';

import crypto from 'node:crypto';
import { getHotelBySlug } from '@/content/hotels';
import { ADMIN_COOKIE_NAME, verifySessionCookieValue } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';
import { refundConfirmationHtml } from '@/lib/email-templates/refund-confirmation';
import { callRefund, iciciConfig, isRefundAccepted } from '@/lib/icici';
import { errorFields, log } from '@/lib/log';
import { STAFF_NOTIFY_EMAIL, sendMail } from '@/lib/mail';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { refundSchema } from '@/lib/validation';
import { cookies, headers } from 'next/headers';

export type RefundFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
};

// Mirrors generateOrderId in app/(site)/ipay/actions.ts, prefixed so a
// refund reference is never mistaken for the original order/txn number it
// refers back to.
function generateRefundTxnNo(): string {
  const datePart = new Date()
    .toLocaleDateString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit' })
    .split('/')
    .reverse()
    .join('');
  const suffix = crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 10);
  return `RF${datePart}${suffix}`;
}

export async function refundPayment(
  _prevState: RefundFormState,
  formData: FormData,
): Promise<RefundFormState> {
  const authed = await verifySessionCookieValue((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
  if (!authed) {
    return { status: 'error', message: 'Session expired, please sign in again.' };
  }

  const headerList = await headers();
  const ip = clientIp(headerList);

  if (isRateLimited(`refund:${ip}`)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = refundSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.flatten().fieldErrors.amount?.[0] || 'Please check the amount.',
    };
  }

  const { orderId, amount } = parsed.data;

  const payment = await prisma.payment.findUnique({
    where: { orderId },
    include: { refunds: { where: { status: 'SUCCESS' } } },
  });

  if (!payment) {
    return { status: 'error', message: 'Payment not found.' };
  }

  // Checked before status, because provenance is the real reason and it holds
  // whatever the status says: a payment imported from the legacy MySQL was
  // taken by the gateway this site replaced, so its orderId means nothing to
  // ICICI and callRefund would send a transaction reference the gateway never
  // issued. These have to be settled with the bank instead.
  if (payment.legacySource) {
    log.warn('refund.rejected', {
      order_id: orderId,
      reason: 'legacy_payment',
      legacy_source: payment.legacySource,
    });
    return {
      status: 'error',
      message:
        'This payment predates the current gateway and cannot be refunded here. Settle it directly with the bank.',
    };
  }

  if (payment.status !== 'SUCCESS') {
    log.warn('refund.rejected', { order_id: orderId, reason: 'payment_not_successful' });
    return { status: 'error', message: 'Only a successful payment can be refunded.' };
  }

  const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  const remaining = Number(payment.amount) - alreadyRefunded;

  if (amount > remaining) {
    log.warn('refund.rejected', {
      order_id: orderId,
      reason: 'exceeds_balance',
      requested: amount,
      remaining,
    });
    return {
      status: 'error',
      message: `Amount exceeds the refundable balance (INR ${remaining.toFixed(2)}).`,
    };
  }

  const { merchantId, aggregatorID, hmacKey, baseUrl } = iciciConfig();
  if (!merchantId || !hmacKey) {
    log.error('refund.misconfigured', { reason: 'ICICI merchant credentials not set' });
    return { status: 'error', message: 'ICICI credentials not configured.' };
  }

  const merchantTxnNo = generateRefundTxnNo();

  let refundResponse: Awaited<ReturnType<typeof callRefund>>;
  try {
    refundResponse = await callRefund(
      {
        merchantId,
        aggregatorID,
        merchantTxnNo,
        originalTxnNo: orderId,
        amount: amount.toFixed(2),
        transactionType: 'REFUND',
      },
      hmacKey,
      baseUrl,
    );
  } catch (err) {
    log.error('refund.gateway_unreachable', {
      order_id: orderId,
      refund_txn_no: merchantTxnNo,
      amount,
      ...errorFields(err),
    });
    return {
      status: 'error',
      message: 'We could not reach the payment gateway. Please try again shortly.',
    };
  }

  const accepted = isRefundAccepted(refundResponse);
  const status = accepted ? 'SUCCESS' : 'FAILURE';

  await prisma.refund.create({
    data: {
      paymentId: payment.id,
      merchantTxnNo,
      amount,
      status,
      responseCode: refundResponse.responseCode,
      respDescription: refundResponse.respDescription,
      txnID: refundResponse.txnID,
    },
  });

  // Refunds move money out, so the settled outcome needs a server-side record
  // of its own — the Refund row says what was stored, this says what the
  // gateway actually answered.
  log[accepted ? 'info' : 'error']('refund.settled', {
    order_id: orderId,
    refund_txn_no: merchantTxnNo,
    status,
    amount,
    hotel: payment.hotelSlug,
    response_code: refundResponse.responseCode ?? null,
    gateway_txn_id: refundResponse.txnID ?? null,
  });

  const hotelName = getHotelBySlug(payment.hotelSlug)?.name ?? payment.hotelSlug;
  const emailData = {
    orderId: payment.orderId,
    refundTxnNo: merchantTxnNo,
    hotelName,
    amount: amount.toFixed(2),
    guestName: payment.guestName,
    guestEmail: payment.guestEmail,
    status: status as 'SUCCESS' | 'FAILURE',
    txnID: refundResponse.txnID,
    respDescription: refundResponse.respDescription,
  };

  const subject = `i-Pay Refund [${accepted ? 'Success' : 'Failure'}] Transaction: ${payment.orderId}`;

  await sendMail({
    to: payment.guestEmail,
    kind: 'refund-guest',
    subject,
    html: refundConfirmationHtml(emailData),
  });

  await sendMail({
    to: STAFF_NOTIFY_EMAIL,
    kind: 'refund-staff',
    subject: `${subject} — ${hotelName}`,
    html: refundConfirmationHtml(emailData),
  });

  if (!accepted) {
    return {
      status: 'error',
      message: refundResponse.respDescription || 'The gateway declined this refund.',
    };
  }

  return { status: 'success', message: `Refund of INR ${amount.toFixed(2)} processed.` };
}
