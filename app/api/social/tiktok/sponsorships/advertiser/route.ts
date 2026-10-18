import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/social/tiktok/sponsorships/advertiser`, {
      headers: {
        Accept: 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({ success: false, message: 'Unexpected backend response' }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Could not load TikTok campaigns' }, { status: 502 });
  }
}