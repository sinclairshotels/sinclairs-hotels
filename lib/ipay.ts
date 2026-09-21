import crypto from 'node:crypto';
import { dateKey } from '@/lib/booking';
import { callInitiateSale, iciciConfig, iciciTimestamp, initiateSaleAccepted } from '@/lib/icici';
import { errorFields, log } from '@/lib/log';

// Mirrors the legacy site's transaction-number shape (YYMMDD + random suffix,
// e.g. "260905ZJGQ8618") purely so a guest comparing an old and new receipt
// isn't confused by a totally different format — the gateway itself doesn't
// require this exact shape, any unique reference works.
//
// The date is UTC, via the same dateKey() the booking reference is built from.
// toLocaleDateString without a timeZone reads the server's zone, which made a
// booking and its own payment disagree: taken at 00:32 IST they came out
// SNC-260921-… and 260922…, five and a half hours of every night landing on
// different days. Worse, it disagreed by environment — Vercel runs UTC and
// would have matched, so the one place it looked wrong was the machine you
// test on. Reconciling a day's bookings against a day's payments needs them
// to mean the same day.
export function generateOrderId(now: Date = new Date()): string {
  const datePart = dateKey(now).slice(2).replace(/-/g, '');
  const suffix = crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 10);
  return `${datePart}${suffix}`;
}

// Protocol can't be hardcoded to https: local dev serves plain http, and a
// hardcoded https:// returnURL sent to ICICI sends the post-payment redirect
// to a URL local dev can't actually serve (ERR_SSL_PROTOCOL_ERROR) —
// x-forwarded-proto (set by Vercel) gives the real scheme in production;
// localhost is the only case without that header.
export function requestBaseUrl(headers: { get(name: string): string | null }): string {
  const host = headers.get('host') ?? '';
  const protocol =
    headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

// Checked before a caller writes its own row, so a deployment missing its
// ICICI credentials fails before creating a Payment/Booking that can never
// go anywhere — the gateway is never reached in that case, so there is no
// outcome to record.
export function ipayConfigured(): boolean {
  const { merchantId, hmacKey } = iciciConfig();
  return Boolean(merchantId && hmacKey);
}

export type SaleStart =
  | { ok: true; redirectUrl: string }
  | {
      ok: false;
      reason: 'misconfigured' | 'unreachable' | 'rejected';
      message: string;
      detail?: string;
    };

export interface SaleRequest {
  orderId: string;
  amount: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  baseUrl: string;
}

// Shared by the standalone /ipay page and the booking flow: both open a sale
// against the same gateway with the same credentials, and the only thing that
// differs is what each one writes to its own table afterwards. The caller
// records the outcome — this returns it rather than touching the database, so
// there is exactly one place that knows how to talk to ICICI.
export async function startSale({
  orderId,
  amount,
  guestName,
  guestEmail,
  guestPhone,
  baseUrl,
}: SaleRequest): Promise<SaleStart> {
  const { merchantId, aggregatorID, hmacKey, baseUrl: iciciBaseUrl } = iciciConfig();

  if (!merchantId || !hmacKey) {
    log.error('ipay.misconfigured', { reason: 'ICICI merchant credentials not set' });
    return {
      ok: false,
      reason: 'misconfigured',
      message: 'Online payment is temporarily unavailable. Please contact the hotel directly.',
    };
  }

  let saleResponse: Awaited<ReturnType<typeof callInitiateSale>>;
  try {
    saleResponse = await callInitiateSale(
      {
        merchantId,
        aggregatorID,
        merchantTxnNo: orderId,
        amount: amount.toFixed(2),
        currencyCode: '356',
        payType: '0',
        customerEmailID: guestEmail,
        transactionType: 'SALE',
        returnURL: `${baseUrl}/api/ipay/callback`,
        txnDate: iciciTimestamp(),
        customerMobileNo: guestPhone,
        customerName: guestName,
      },
      hmacKey,
      iciciBaseUrl,
    );
  } catch (err) {
    log.error('ipay.gateway_unreachable', { order_id: orderId, ...errorFields(err) });
    return {
      ok: false,
      reason: 'unreachable',
      message: 'We could not reach the payment gateway. Please try again shortly.',
      detail: 'initiateSale request failed',
    };
  }

  if (!initiateSaleAccepted(saleResponse)) {
    log.error('ipay.gateway_rejected', {
      order_id: orderId,
      response_code: saleResponse.responseCode ?? null,
      response_message: saleResponse.responseDescription ?? null,
    });
    return {
      ok: false,
      reason: 'rejected',
      message: 'The payment gateway declined this request. Please try again.',
      detail: saleResponse.responseDescription || saleResponse.responseCode,
    };
  }

  // Standard mode: ICICI's own domain collects payment details, so this is a
  // plain browser redirect — no client-side form POST involved.
  return {
    ok: true,
    redirectUrl: `${saleResponse.redirectURI}?tranCtx=${encodeURIComponent(saleResponse.tranCtx ?? '')}`,
  };
}
