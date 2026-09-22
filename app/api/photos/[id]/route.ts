import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// Replaced photos live in Postgres because public/ is baked into the deployment
// and Vercel's filesystem is read-only at runtime. The id changes with every
// upload, so the response can be cached forever: a new photo is a new URL.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const asset = await prisma.photoAsset.findUnique({
    where: { id },
    select: { data: true, contentType: true },
  });
  if (!asset) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
