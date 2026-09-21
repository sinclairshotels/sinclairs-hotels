'use server';

import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { generateOrderId, ipayConfigured, requestBaseUrl, startSale } from '@/lib/ipay';
import { log } from '@/lib/log';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { ipaySchema } from '@/lib/validation';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type IpayFormState = {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function initiatePayment(
  _prevState: IpayFormState,
  formData: FormData,
): Promise<IpayFormState> {
  const headerList = await headers();
  const ip = clientIp(headerList);

  if (isRateLimited(`ipay:${ip}`)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = ipaySchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (parsed.data.company) {
    return { status: 'error', message: 'Something went wrong. Please try again.' };
  }

  const {
    hotelSlug,
    amount,
    guestName,
    guestEmail,
    guestPhone,
    billingAddress,
    remark,
    reservationNo,
    checkIn,
    checkOut,
  } = parsed.data;

  // Checked before the Payment row is written: without credentials the
  // gateway is never called, so an INITIATED row here would be one that can
  // never settle either way.
  if (!ipayConfigured()) {
    log.error('ipay.misconfigured', { reason: 'ICICI merchant credentials not set' });
    return {
      status: 'error',
      message: 'Online payment is temporarily unavailable. Please contact the hotel directly.',
    };
  }

  const orderId = generateOrderId();

  await prisma.payment.create({
    data: {
      orderId,
      viewToken: randomBytes(32).toString('base64url'),
      hotelSlug,
      amount,
      guestName,
      guestEmail,
      guestPhone,
      billingAddress: billingAddress || null,
      remark: remark || null,
      reservationNo: reservationNo || null,
      checkIn: checkIn ? new Date(checkIn) : null,
      checkOut: checkOut ? new Date(checkOut) : null,
      userIp: ip,
    },
  });

  // Server-side counterpart of the client's add_payment_info: the denominator
  // for payment abandonment, and unlike the client event it cannot be lost to a
  // blocked tag.
  log.info('ipay.initiated', { order_id: orderId, hotel: hotelSlug, amount });

  const sale = await startSale({
    orderId,
    amount,
    guestName,
    guestEmail,
    guestPhone,
    baseUrl: requestBaseUrl(headerList),
  });

  if (!sale.ok) {
    await prisma.payment.update({
      where: { orderId },
      data: { status: 'FAILURE', failureMessage: sale.detail ?? sale.reason },
    });
    return { status: 'error', message: sale.message };
  }

  redirect(sale.redirectUrl);
}
