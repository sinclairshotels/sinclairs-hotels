import { getHotelBySlug } from '@/content/hotels';
import { prisma } from '@/lib/db';
import { CLIENT_STEPS, type FunnelStep } from '@/lib/funnel';
import { clientIp, isRateLimited } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The three steps Postgres cannot otherwise see. Only those three are accepted:
// guest details, payment started and confirmed are counted from rows that exist
// because money was on its way, and taking them over HTTP would let anyone
// inflate the conversion rate from a terminal.
//
// No identifier is stored and no guest data is read — a step, a property and a
// time — so this needs no consent banner and leaks nothing if it is scraped.
export async function POST(request: Request) {
  const ip = clientIp(await headers());
  // Generous: a guest browsing quickly fires several of these legitimately.
  if (isRateLimited(`funnel:${ip}`, 120)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { step, hotel } = (body ?? {}) as { step?: unknown; hotel?: unknown };
  if (typeof step !== 'string' || !CLIENT_STEPS.includes(step as FunnelStep)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Checked against the content files rather than stored as given, so the table
  // cannot be filled with slugs that are not properties.
  const hotelSlug = typeof hotel === 'string' && getHotelBySlug(hotel) ? hotel : null;

  await prisma.funnelEvent.create({ data: { step, hotelSlug } });
  return NextResponse.json({ ok: true });
}
