import { recordAudit } from '@/lib/audit';
import { can, getSession } from '@/lib/auth';
import { addDays, parseDateOnly, todayInIndia } from '@/lib/booking';
import { EXPORT_COLUMNS, exportFileName } from '@/lib/bookings-export';
import { prisma } from '@/lib/db';
import { log } from '@/lib/log';
import { ADMIN_REQUESTS_PER_WINDOW, clientIp, isRateLimited } from '@/lib/rate-limit';
import { hotelScopeFilter } from '@/lib/roles';
import ExcelJS from 'exceljs';
import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// A whole year of bookings is a reasonable report; ten is somebody fetching
// the table. Bounds the query as well as the file.
const MAX_RANGE_DAYS = 400;

export async function GET(request: NextRequest) {
  const viewer = await getSession();
  if (!viewer || !can(viewer, 'bookings:read')) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (isRateLimited(`bookings-export:${viewer.id}`, ADMIN_REQUESTS_PER_WINDOW)) {
    return new NextResponse('Too many requests. Please try again in a minute.', { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const basis = params.get('basis') === 'stay' ? 'stay' : 'booked';
  const today = todayInIndia();
  const from = parseDateOnly(params.get('from') ?? '') ?? addDays(today, -30);
  const to = parseDateOnly(params.get('to') ?? '') ?? today;

  if (to < from) {
    return new NextResponse('The end of the range is before its start.', { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    return new NextResponse(`Please pick a range of ${MAX_RANGE_DAYS} days or fewer.`, {
      status: 400,
    });
  }

  // Inclusive of the last day: a range that reads "1 to 30 September" must
  // include the 30th, and the stored values are dates, not instants.
  const until = addDays(to, 1);
  const where =
    basis === 'stay'
      ? { checkIn: { gte: from, lt: until } }
      : { createdAt: { gte: from, lt: until } };

  const bookings = await prisma.booking.findMany({
    // hotelScopeFilter spreads in so a scoped user's export cannot reach
    // another property's rows even if the page above it forgets to filter.
    where: { ...where, ...hotelScopeFilter(viewer) },
    include: { payment: { select: { status: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sinclairs Hotels';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Bookings');

  sheet.columns = EXPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const booking of bookings) {
    sheet.addRow(EXPORT_COLUMNS.map((column) => column.value(booking)));
  }

  const fileName = exportFileName(
    from.toISOString().slice(0, 10),
    to.toISOString().slice(0, 10),
    basis,
  );

  // Audited like any other read of a lot of guest data at once: a spreadsheet
  // of names, phones and email addresses leaves the building, and the log is
  // the only record that it did.
  await recordAudit({
    user: viewer,
    action: 'bookings.exported',
    entity: 'Booking',
    entityId: fileName,
    hotelSlug: null,
    summary: `Exported ${bookings.length} booking${bookings.length === 1 ? '' : 's'} by ${
      basis === 'stay' ? 'check-in date' : 'booked date'
    }, ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`,
    before: null,
    after: { basis, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    ip: clientIp(await headers()),
  });
  log.info('bookings.exported', { rows: bookings.length, basis });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      // Guest data: never stored by a proxy or the browser's back/forward cache.
      'Cache-Control': 'no-store',
    },
  });
}
