import { getHotelBySlug } from '@/content/hotels';
import { roomOffer } from '@/lib/availability';
import { HOLD_MINUTES } from '@/lib/booking';
import { SERIALIZABLE, isWriteConflict, prisma } from '@/lib/db';
import {
  bookingConfirmationHtml,
  bookingOversoldHtml,
} from '@/lib/email-templates/booking-confirmation';
import { ipayConfirmationHtml } from '@/lib/email-templates/ipay-confirmation';
import {
  iciciConfig,
  isIciciSuccess,
  parseIciciPaymentResponse,
  rawFormFields,
  verifyHashV1,
} from '@/lib/icici';
import { errorFields, log } from '@/lib/log';
import { STAFF_NOTIFY_EMAIL, sendMail } from '@/lib/mail';
import { publicSiteUrl } from '@/lib/site-url';
import type { Booking } from '@prisma/client';
import { NextResponse } from 'next/server';

// A payment taken for a direct booking belongs to that booking, so the guest
// comes back to their booking page rather than the standalone i-Pay receipt.
// Used by the replay branch too, so a guest pressing back lands in the same
// place they did the first time.
async function settlementUrl(baseUrl: string, paymentId: string, orderId: string): Promise<string> {
  const [booking, payment] = await Promise.all([
    prisma.booking.findUnique({ where: { paymentId }, select: { viewToken: true } }),
    prisma.payment.findUnique({ where: { id: paymentId }, select: { viewToken: true } }),
  ]);
  // ?paid=1 marks the arrival that came straight from the bank. The same URL
  // is the permanent "view my booking" link in the guest's email, so without a
  // marker the purchase event would fire again every time they reopened it and
  // GA4 would count the revenue afresh each time — it does not de-duplicate.
  if (booking) return `${baseUrl}/booking/${booking.viewToken}?paid=1`;
  return payment?.viewToken
    ? `${baseUrl}/ipay/result?t=${payment.viewToken}`
    : `${baseUrl}/ipay/result`;
}

// Two late callbacks can be settling their way into the same last room at the
// same instant. Reading availability and writing the confirmation in one
// Serializable transaction is what makes them exclusive: Postgres sees that
// each read a set the other wrote into and aborts one, which comes back as a
// write conflict and is retried against the winner's committed state.
const SETTLE_ATTEMPTS = 3;

// Re-checks that the room this booking was made for can still be sold,
// ignoring the booking itself — its own expired hold must not count against
// it. Takes the transaction client so the read is part of the transaction's
// conflict footprint; against `prisma` it would be a separate snapshot and
// serializing the write around it would guarantee nothing.
async function hasRoomsLeftFor(
  db: Parameters<typeof roomOffer>[0],
  booking: Pick<
    Booking,
    | 'id'
    | 'hotelSlug'
    | 'roomTypeId'
    | 'ratePlanId'
    | 'checkIn'
    | 'checkOut'
    | 'rooms'
    | 'adults'
    | 'children'
  >,
): Promise<boolean> {
  // A booking with no room type is one whose room no longer exists at all, so
  // there is nothing to confirm it into. Failing closed sends it to
  // REFUND_DUE, which is the honest answer: we cannot promise a room we
  // cannot find.
  if (!booking.roomTypeId) return false;

  const offer = await roomOffer(db, {
    hotelSlug: booking.hotelSlug,
    roomTypeId: booking.roomTypeId,
    ...(booking.ratePlanId ? { ratePlanId: booking.ratePlanId } : {}),
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    rooms: booking.rooms,
    adults: booking.adults,
    children: booking.children,
    excludeBookingId: booking.id,
  });
  return Boolean(offer && offer.roomsLeft >= booking.rooms);
}

// Confirms a paid booking, or marks it for refund if its room is gone. Only
// ever called once per payment — the replay guard upstream sees to that — so
// the retries here are for lost races, not for redelivery.
async function confirmPaidBooking(bookingId: string): Promise<Booking> {
  for (let attempt = 1; attempt <= SETTLE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

        // A booking only holds its rooms for HOLD_MINUTES. Past that the
        // availability query has stopped counting it, so another guest may
        // have taken the same room while this one was still on the bank's
        // page — confirming blindly is how a paid guest arrives to no room.
        // Inside the window the rooms were genuinely reserved for this
        // booking, so there is nothing to re-check.
        const holdExpired = booking.createdAt.getTime() <= Date.now() - HOLD_MINUTES * 60_000;
        const available = !holdExpired || (await hasRoomsLeftFor(tx, booking));

        return tx.booking.update({
          where: { id: bookingId },
          data: { status: available ? 'CONFIRMED' : 'REFUND_DUE' },
        });
      }, SERIALIZABLE);
    } catch (err) {
      if (!isWriteConflict(err)) throw err;

      if (attempt === SETTLE_ATTEMPTS) {
        // Every attempt lost its race, so what is actually left in the room
        // is unknown. Fail safe: refunding a guest who might have had a room
        // is recoverable, sending two guests to one room is not.
        log.error('booking.settle_conflict', { booking_id: bookingId, ...errorFields(err) });
        return prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'REFUND_DUE' },
        });
      }
    }
  }

  // Unreachable: the loop either returns or throws on its last attempt.
  throw new Error('confirmPaidBooking exhausted its attempts without settling');
}

export async function POST(request: Request): Promise<NextResponse> {
  // Protocol can't be hardcoded to https: local dev serves plain http, and a
  // hardcoded https:// redirect back to localhost fails with
  // ERR_SSL_PROTOCOL_ERROR — x-forwarded-proto (set by Vercel) gives the real
  // scheme in production; localhost is the only case without that header.
  // See vouchers/page.tsx for the same pattern.
  const host = request.headers.get('host') ?? '';
  const protocol =
    request.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const baseUrl = `${protocol}://${host}`;

  const { hmacKey } = iciciConfig();
  if (!hmacKey) {
    log.error('ipay.callback.misconfigured', { reason: 'ICICI_HMAC_KEY not set' });
    return NextResponse.redirect(`${baseUrl}/ipay/result`, 303);
  }

  const formData = await request.formData();
  const resp = parseIciciPaymentResponse(formData);
  const orderId = resp.merchantTxnNo;

  if (!orderId) {
    log.error('ipay.callback.rejected', { reason: 'no_order_id' });
    return NextResponse.redirect(`${baseUrl}/ipay/result`, 303);
  }

  // Only the gateway's own signed response — never a plain redirect query
  // param a guest's browser could otherwise supply — is trusted as proof of
  // what happened to the payment. See lib/icici.ts for why this is hash v1.
  // Verified against every raw field ICICI actually sent (not just the
  // fields this route acts on) — a curated field list caused a real
  // secureHash mismatch in UAT testing, since the response payload varies
  // by payment method (UPI/card/netbanking each include different fields).
  const { secureHash, ...rawFields } = rawFormFields(formData);
  if (!verifyHashV1(rawFields, secureHash ?? '', hmacKey)) {
    // A signature that does not verify is either a tampered response or a
    // forged callback; both are security events, not payment outcomes.
    log.error('ipay.callback.rejected', { order_id: orderId, reason: 'hash_mismatch' });
    return NextResponse.redirect(`${baseUrl}/ipay/result`, 303);
  }

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) {
    log.error('ipay.callback.rejected', { order_id: orderId, reason: 'unknown_order' });
    return NextResponse.redirect(`${baseUrl}/ipay/result`, 303);
  }

  // Idempotent: the callback (or a guest's back button) can arrive more than
  // once — only the first delivery should update state and send mail.
  if (payment.status !== 'INITIATED') {
    // Expected, not an error: ICICI retries and guests use the back button.
    // Worth a line so a duplicate purchase in GA4 can be traced to a replay.
    log.info('ipay.callback.replayed', { order_id: orderId, status: payment.status });
    return NextResponse.redirect(await settlementUrl(baseUrl, payment.id, orderId), 303);
  }

  // The gateway's own signed response is trusted for pass/fail, but a
  // reported amount that doesn't match what this order was created for is
  // a tamper/replay signal worth failing closed on, not just recording
  // alongside a SUCCESS — never let a mismatched amount confirm a payment.
  const amountMismatch =
    resp.amount !== undefined && Number(resp.amount) !== Number(payment.amount);
  if (amountMismatch) {
    log.error('ipay.callback.amount_mismatch', {
      order_id: orderId,
      expected: payment.amount.toFixed(2),
      reported: resp.amount ?? null,
    });
  }

  const status: 'SUCCESS' | 'FAILURE' =
    isIciciSuccess(resp.responseCode) && !amountMismatch ? 'SUCCESS' : 'FAILURE';

  const updated = await prisma.payment.update({
    where: { orderId },
    data: {
      status,
      trackingId: resp.txnID || null,
      bankRefNo: resp.paymentID || resp.txnAuthID || null,
      paymentMode: resp.paymentMode || null,
      paymentInstId: resp.paymentInstId || null,
      failureMessage:
        status === 'FAILURE'
          ? amountMismatch
            ? `Amount mismatch: expected ${payment.amount.toFixed(2)}, gateway reported ${resp.amount}`
            : resp.respDescription || resp.responseCode
          : null,
    },
  });

  // The server-side counterpart of the client's purchase / payment_failed
  // event: this line exists for every settled payment, including the ones where
  // the guest closed the tab before /ipay/result ever loaded and GA4 saw nothing.
  log.info('ipay.settled', {
    order_id: orderId,
    status,
    amount: updated.amount.toNumber(),
    hotel: updated.hotelSlug,
    payment_mode: updated.paymentMode,
    response_code: resp.responseCode ?? null,
  });

  const hotel = getHotelBySlug(updated.hotelSlug);
  const hotelName = hotel?.name ?? updated.hotelSlug;

  // A payment raised by the booking engine settles its booking in the same
  // breath: the gateway's signed response is the only thing that confirms a
  // room, exactly as it is the only thing that confirms the money.
  const booking = await prisma.booking.findUnique({ where: { paymentId: updated.id } });
  if (booking) {
    // A failed payment needs no availability check — the booking is over
    // either way — so only the confirming path pays for a transaction.
    const settled =
      status === 'SUCCESS'
        ? await confirmPaidBooking(booking.id)
        : await prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'PAYMENT_FAILED' },
          });

    const stillAvailable = settled.status !== 'REFUND_DUE';

    log.info('booking.settled', {
      reference: settled.reference,
      order_id: orderId,
      status: settled.status,
      hotel: settled.hotelSlug,
      amount: settled.total.toNumber(),
    });

    if (status === 'SUCCESS' && !stillAvailable) {
      // Money taken, no room: an incident, not a payment outcome. The refund
      // itself stays manual — it goes back through ICICI from /admin/payments,
      // and this codebase never moves real money without a person deciding to.
      log.error('booking.oversold', {
        reference: settled.reference,
        order_id: orderId,
        hotel: settled.hotelSlug,
        room: settled.roomName,
        rooms: settled.rooms,
        amount: settled.total.toNumber(),
      });

      const viewUrl = `${publicSiteUrl}/booking/${settled.viewToken}`;

      await sendMail({
        to: settled.guestEmail,
        kind: 'booking-oversold-guest',
        subject: `We could not confirm booking ${settled.reference} — refund on its way`,
        html: bookingOversoldHtml({ booking: settled, hotel, viewUrl }),
      });

      await sendMail({
        to: STAFF_NOTIFY_EMAIL,
        kind: 'booking-oversold-staff',
        subject: `REFUND DUE: ${settled.reference} paid but not confirmed — ${hotelName}`,
        html: bookingOversoldHtml({ booking: settled, hotel, viewUrl, forStaff: true }),
      });
    }

    if (status === 'SUCCESS' && stillAvailable) {
      const viewUrl = `${publicSiteUrl}/booking/${settled.viewToken}`;

      await sendMail({
        to: settled.guestEmail,
        kind: 'booking-guest',
        subject: `Your Sinclairs booking is confirmed — ${settled.reference}`,
        html: bookingConfirmationHtml({ booking: settled, hotel, viewUrl }),
      });

      const hotelInbox = hotel?.contact?.notificationEmail ?? STAFF_NOTIFY_EMAIL;
      await sendMail({
        to: hotelInbox,
        bcc: hotelInbox === STAFF_NOTIFY_EMAIL ? undefined : STAFF_NOTIFY_EMAIL,
        kind: 'booking-hotel',
        subject: `New direct booking ${settled.reference} — ${hotelName}`,
        html: bookingConfirmationHtml({ booking: settled, hotel, viewUrl, forStaff: true }),
      });
    }

    return NextResponse.redirect(`${baseUrl}/booking/${settled.viewToken}`, 303);
  }

  const emailData = {
    orderId: updated.orderId,
    hotelName,
    amount: updated.amount.toFixed(2),
    guestName: updated.guestName,
    guestEmail: updated.guestEmail,
    guestPhone: updated.guestPhone,
    reservationNo: updated.reservationNo,
    checkIn: updated.checkIn?.toLocaleDateString('en-IN'),
    checkOut: updated.checkOut?.toLocaleDateString('en-IN'),
    status,
    trackingId: updated.trackingId,
    bankRefNo: updated.bankRefNo,
  };

  const subject = `i-Pay [${status === 'SUCCESS' ? 'Success' : 'Failure'}] Transaction: ${updated.orderId}`;

  await sendMail({
    to: updated.guestEmail,
    kind: 'ipay-guest',
    subject,
    html: ipayConfirmationHtml(emailData),
  });

  await sendMail({
    to: STAFF_NOTIFY_EMAIL,
    kind: 'ipay-staff',
    subject: `${subject} — ${hotelName}`,
    html: ipayConfirmationHtml(emailData),
  });

  // The guest has just paid and this is their receipt, so it is addressed by
  // the payment's own token rather than the order number they may be quoting.
  return NextResponse.redirect(await settlementUrl(baseUrl, updated.id, orderId), 303);
}
