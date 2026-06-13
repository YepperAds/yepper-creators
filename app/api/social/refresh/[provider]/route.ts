import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function POST(req: NextRequest, { params }: { params: any }) {
  const resolvedParams = await params;
  const provider = resolvedParams.provider;
  const cookieHeader = req.headers.get('cookie') ?? '';

  try {
    const upstream = await fetch(`${ADSENSE_API}/api/social/refresh/${encodeURIComponent(provider)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cookie': cookieHeader,
      },
      body: '{}',
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }
    return NextResponse.json({ success: upstream.ok }, { status: upstream.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Network error during refresh' }, { status: 500 });
  }
}
