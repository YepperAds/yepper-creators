import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function POST(req: NextRequest, { params }: { params: any }) {
  const resolvedParams = await params;
  const provider = resolvedParams.provider;

  // Forward cookies from the incoming request to the backend so it can authenticate the session
  const cookieHeader = req.headers.get('cookie') ?? '';

  try {
    const upstream = await fetch(`${ADSENSE_API}/api/social/disconnect/${encodeURIComponent(provider)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cookie': cookieHeader,
      },
      // forward request body if needed
      body: await req.text(),
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';

    if (!upstream.ok) {
      // Attempt to parse JSON error body
      if (contentType.includes('application/json')) {
        return NextResponse.json(JSON.parse(text), { status: upstream.status });
      }
      return NextResponse.json({ success: false, message: text || 'Upstream error' }, { status: upstream.status });
    }

    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text));
    }

    return new NextResponse(text, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Network error while disconnecting' }, { status: 500 });
  }
}
