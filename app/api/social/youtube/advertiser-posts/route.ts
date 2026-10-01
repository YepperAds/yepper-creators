import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(req: NextRequest) {
  try {
    const upstream = await fetch(`${BACKEND_URL}/api/social/youtube/advertiser-posts`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });
    const body = await upstream.json().catch(() => ({ success: false }));
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Could not load YouTube ad posts' }, { status: 502 });
  }
}