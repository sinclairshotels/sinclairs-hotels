import { getHotelBySlug } from '@/content/hotels';
import { constantTimeEqual } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';
import { dailyDigestHtml } from '@/lib/email-templates/daily-digest';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import { coverageWarnings } from '@/lib/rate-calendar';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getPreviousIstDay(now: Date) {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const date = istNow.getUTCDate();

  const istTodayStartUtc = Date.UTC(year, month, date, 0, 0, 0) - IST_OFFSET_MS;
  const start = new Date(istTodayStartUtc - 24 * 60 * 60 * 1000);
  const end = new Date(istTodayStartUtc);
  const dayName = new Date(Date.UTC(year, month, date - 1)).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  const dateLabel = new Date(Date.UTC(year, month, date - 1)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return { start, end, dayName, dateLabel };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !constantTimeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const digestTo = process.env.DIGEST_TO_EMAIL;
  if (!digestTo) {
    // Reached in production today: DIGEST_TO_EMAIL is unset there, so the cron
    // runs, finds nobody to send to, and the digest silently never arrives.
    log.error('digest.skipped', { reason: 'DIGEST_TO_EMAIL not configured' });
    return NextResponse.json({ error: 'DIGEST_TO_EMAIL not configured' }, { status: 500 });
  }

  const { start, end, dayName, dateLabel } = getPreviousIstDay(new Date());

  // refundsDue and coverage are deliberately not bounded to yesterday: they
  // are outstanding state, and an unpaid refund from last week matters more
  // this morning than one taken overnight.
  const [enquiries, newsletterSignups, payments, refundsDue, coverage] = await Promise.all([
    prisma.enquiry.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.newsletter.findMany({
      where: { subscribedAt: { gte: start, lt: end } },
      orderBy: { subscribedAt: 'asc' },
    }),
    prisma.payment.findMany({
      where: { status: 'SUCCESS', createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.booking.findMany({
      where: { status: 'REFUND_DUE' },
      orderBy: { createdAt: 'asc' },
    }),
    coverageWarnings(),
  ]);

  const html = dailyDigestHtml({
    dateLabel: `${dayName}, ${dateLabel}`,
    enquiries: enquiries.map((e) => ({
      property: getHotelBySlug(e.property)?.name ?? e.property,
      checkIn: e.checkIn,
      checkOut: e.checkOut,
      name: e.name,
      message: e.message,
    })),
    newsletterEmails: newsletterSignups.map((n) => n.email),
    payments: payments.map((p) => ({
      hotelName: getHotelBySlug(p.hotelSlug)?.name ?? p.hotelSlug,
      orderId: p.orderId,
      amount: p.amount.toFixed(2),
      guestName: p.guestName,
      bankRefNo: p.bankRefNo,
    })),
    refundsDue: refundsDue.map((b) => ({
      reference: b.reference,
      hotelName: getHotelBySlug(b.hotelSlug)?.name ?? b.hotelSlug,
      amount: b.total.toFixed(2),
      bookedOn: b.createdAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
    })),
    coverage: coverage.map((c) => ({
      hotelName: c.hotelName,
      roomName: c.roomName,
      daysLeft: c.daysLeft,
    })),
  });

  await sendMail({
    to: digestTo,
    kind: 'daily-digest',
    bcc: process.env.DIGEST_BCC_EMAIL,
    // The subject is what gets read on a phone at 7am, so it carries the one
    // fact that might need acting on before the mail is even opened.
    subject:
      refundsDue.length > 0
        ? `Sinclairs Hotels — ${refundsDue.length} refund${refundsDue.length === 1 ? '' : 's'} owed — ${dayName.toUpperCase()}`
        : `Sinclairs Hotels online enquiries on ${dayName.toUpperCase()}`,
    html,
  });

  return NextResponse.json({
    ok: true,
    range: { start, end },
    counts: {
      enquiries: enquiries.length,
      newsletterSignups: newsletterSignups.length,
      payments: payments.length,
      refundsDue: refundsDue.length,
      coverageWarnings: coverage.length,
    },
  });
}
