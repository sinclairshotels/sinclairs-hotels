'use server';

import { randomBytes } from 'node:crypto';
import { roomOffer } from '@/lib/availability';
import {
  MAX_BOOKING_HORIZON_DAYS,
  MAX_GUESTS_PER_ROOM,
  MAX_NIGHTS,
  addDays,
  bookingReference,
  nightsBetween,
  parseDateOnly,
  todayUtc,
} from '@/lib/booking';
import { prisma } from '@/lib/db';
import { generateOrderId, ipayConfigured, requestBaseUrl, startSale } from '@/lib/ipay';
import { log } from '@/lib/log';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { bookingSchema } from '@/lib/validation';
import { Prisma } from '@prisma/client';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type BookingFormState = {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

// Raised when the rooms a guest is looking at were taken between the
// availability page rendering and this submission — the whole reason the
// booking is written inside a serializable transaction.
class RoomsGoneError extends Error {}

export async function createBooking(
  _prevState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const headerList = await headers();
  const ip = clientIp(headerList);

  if (isRateLimited(`booking:${ip}`)) {
    return { status: 'error', message: 'Too many requests. Please try again in a minute.' };
  }

  const parsed = bookingSchema.safeParse(Object.fromEntries(formData.entries()));
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

  const d = parsed.data;
  const checkIn = parseDateOnly(d.checkIn);
  const checkOut = parseDateOnly(d.checkOut);
  const today = todayUtc();

  // The dates arrive in a hidden field, so they are re-checked here rather
  // than trusted from the page that rendered them.
  if (!checkIn || !checkOut) {
    return { status: 'error', message: 'Please choose valid check-in and check-out dates.' };
  }
  if (checkIn < today || checkOut <= checkIn) {
    return { status: 'error', message: 'Please choose valid check-in and check-out dates.' };
  }
  if (
    nightsBetween(checkIn, checkOut) > MAX_NIGHTS ||
    checkIn > addDays(today, MAX_BOOKING_HORIZON_DAYS)
  ) {
    return { status: 'error', message: 'Please send an enquiry for a stay of that length.' };
  }
  if (d.adults + d.children > d.rooms * MAX_GUESTS_PER_ROOM) {
    return {
      status: 'error',
      message: `That many guests needs more rooms — we can take up to ${MAX_GUESTS_PER_ROOM} per room.`,
    };
  }

  // Checked before anything is written: without credentials the gateway is
  // never called, so the booking could only ever sit unpaid.
  if (!ipayConfigured()) {
    log.error('booking.ipay_misconfigured', { hotel: d.hotelSlug });
    return {
      status: 'error',
      message: 'Online booking is temporarily unavailable. Please send us an enquiry instead.',
    };
  }

  const orderId = generateOrderId();
  let created: { reference: string; total: number; bookingId: string };

  try {
    created = await prisma.$transaction(
      async (tx) => {
        // Re-priced and re-counted here, inside the transaction, against the
        // same rate rows the guest saw — the posted form carries no prices,
        // so a tampered submission cannot set its own total.
        const offer = await roomOffer(tx, {
          hotelSlug: d.hotelSlug,
          roomName: d.roomName,
          checkIn,
          checkOut,
          rooms: d.rooms,
        });

        if (!offer || offer.roomsLeft < d.rooms) throw new RoomsGoneError();

        const payment = await tx.payment.create({
          data: {
            orderId,
            hotelSlug: d.hotelSlug,
            amount: offer.quote.total,
            guestName: d.guestName,
            guestEmail: d.guestEmail,
            guestPhone: d.guestPhone,
            billingAddress: d.billingAddress,
            checkIn,
            checkOut,
            userIp: ip,
          },
        });

        const booking = await tx.booking.create({
          data: {
            reference: bookingReference(),
            viewToken: randomBytes(32).toString('base64url'),
            hotelSlug: d.hotelSlug,
            roomName: d.roomName,
            checkIn,
            checkOut,
            rooms: d.rooms,
            adults: d.adults,
            children: d.children,
            guestName: d.guestName,
            guestEmail: d.guestEmail,
            guestPhone: d.guestPhone,
            billingAddress: d.billingAddress,
            specialRequests: d.specialRequests || null,
            roomTotal: offer.quote.roomTotal,
            taxTotal: offer.quote.taxTotal,
            total: offer.quote.total,
            paymentId: payment.id,
            userIp: ip,
          },
        });

        // The payment's own guest-facing reference, so staff looking at a
        // transaction can find the booking it paid for and vice versa.
        await tx.payment.update({
          where: { id: payment.id },
          data: { reservationNo: booking.reference },
        });

        return { reference: booking.reference, total: offer.quote.total, bookingId: booking.id };
      },
      // Serializable because two guests can be holding the last room at the
      // same instant: the availability re-read above must not see a state
      // that a concurrent booking is about to invalidate. Postgres aborts
      // the loser, which surfaces as P2034 below.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (err instanceof RoomsGoneError) {
      return {
        status: 'error',
        message: 'Those rooms were taken while you were booking. Please search again.',
      };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      return {
        status: 'error',
        message: 'Someone else was booking the same room. Please try again.',
      };
    }
    throw err;
  }

  log.info('booking.created', {
    reference: created.reference,
    order_id: orderId,
    hotel: d.hotelSlug,
    room: d.roomName,
    rooms: d.rooms,
    nights: nightsBetween(checkIn, checkOut),
    amount: created.total,
  });

  const sale = await startSale({
    orderId,
    amount: created.total,
    guestName: d.guestName,
    guestEmail: d.guestEmail,
    guestPhone: d.guestPhone,
    baseUrl: requestBaseUrl(headerList),
  });

  if (!sale.ok) {
    // Closed rather than left pending: the gateway answered (or could not be
    // reached at all), so this attempt is over and its rooms should go back
    // immediately instead of waiting out the hold window.
    await prisma.$transaction([
      prisma.payment.update({
        where: { orderId },
        data: { status: 'FAILURE', failureMessage: sale.detail ?? sale.reason },
      }),
      prisma.booking.update({
        where: { id: created.bookingId },
        data: { status: 'PAYMENT_FAILED' },
      }),
    ]);
    return { status: 'error', message: sale.message };
  }

  redirect(sale.redirectUrl);
}
