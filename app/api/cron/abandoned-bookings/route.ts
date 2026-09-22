import { getHotelBySlug } from '@/content/hotels';
import {
  ABANDONED_AFTER_MINUTES,
  abandonedBookings,
  markAbandonedEmailSent,
} from '@/lib/abandoned';
import { constantTimeEqual } from '@/lib/admin-auth';
import { bookingAbandonedHtml } from '@/lib/email-templates/booking-abandoned';
import { log } from '@/lib/log';
import { sendMail } from '@/lib/mail';
import { publicSiteUrl } from '@/lib/site-url';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// One email per abandoned booking, an hour after its hold let go. The row is
// claimed before the mail is sent, so a crash between the two costs a guest
// their reminder rather than sending a second one — which is the one behaviour
// this endpoint is not allowed to get wrong.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !constantTimeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const due = await abandonedBookings();
  let sent = 0;

  for (const booking of due) {
    if (!(await markAbandonedEmailSent(booking.id))) continue;

    const hotel = getHotelBySlug(booking.hotelSlug);
    try {
      await sendMail({
        to: booking.guestEmail,
        subject: `Your ${hotel?.name ?? 'Sinclairs'} booking is waiting`,
        html: bookingAbandonedHtml({
          booking,
          hotel,
          resumeUrl: `${publicSiteUrl}/book/resume/${booking.viewToken}`,
        }),
        kind: 'booking-abandoned',
      });
      sent += 1;
    } catch (error) {
      // Left claimed on purpose. Retrying would mean re-reading rows whose
      // send may in fact have gone out, and a duplicate is worse than a miss.
      log.error('booking.abandoned_email_failed', {
        reference: booking.reference,
        error: String(error),
      });
    }
  }

  log.info('booking.abandoned_swept', {
    due: due.length,
    sent,
    after_minutes: ABANDONED_AFTER_MINUTES,
  });
  return NextResponse.json({ due: due.length, sent });
}
