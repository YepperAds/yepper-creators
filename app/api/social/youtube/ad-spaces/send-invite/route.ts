import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '';

  try {
    const body = await req.text();
    const upstream = await fetch(`${ADSENSE_API}/api/social/youtube/ad-spaces/send-invite`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'cookie': cookieHeader },
      body,
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }
    return NextResponse.json({ success: false, message: text || 'Upstream error' }, { status: upstream.status });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Network error while sending invite' }, { status: 500 });
  }
}
