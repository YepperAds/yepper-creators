import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '';

  try {
    const upstream = await fetch(`${ADSENSE_API}/api/social/ad-claims/pending`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'cookie': cookieHeader },
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }
    return NextResponse.json({ success: false, message: text || 'Upstream error' }, { status: upstream.status });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Network error while fetching pending claims' }, { status: 500 });
  }
}
