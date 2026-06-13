import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '';

  try {
    const url = new URL(`${ADSENSE_API}/api/social/stats`);
    // forward query params
    req.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'cookie': cookieHeader,
      },
      cache: 'no-store',
    });

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';

    if (!upstream.ok) {
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
    return NextResponse.json({ success: false, message: 'Network error while fetching social stats' }, { status: 500 });
  }
}
