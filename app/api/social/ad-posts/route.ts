import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '';

  try {
    const url = new URL(`${ADSENSE_API}/api/social/ad-posts`);
    req.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

    const upstream = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'cookie': cookieHeader },
      cache:   'no-store',
    });

    const text = await upstream.text();
    return NextResponse.json(
      upstream.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : { success: false },
      { status: upstream.status },
    );
  } catch {
    return NextResponse.json({ success: false, message: 'Network error' }, { status: 500 });
  }
}
