import { NextRequest, NextResponse } from 'next/server';

// Proxy route: /api/proxy/connect/[provider]?user_uuid=...
// The browser cannot navigate directly to the backend domain while preserving the
// session cookie, so the frontend asks Next.js to initiate the OAuth request and
// returns the provider redirect URL JSON back to the popup window.
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const userUuid = request.nextUrl.searchParams.get('user_uuid');

  if (!userUuid) {
    return NextResponse.json(
      { success: false, message: 'Missing user_uuid. Please refresh and try again.' },
      { status: 400 },
    );
  }

  const backendUrl = process.env.BACKEND_URL ?? process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

  try {
    const url = new URL(`${backendUrl}/api/connect/${encodeURIComponent(provider)}`);
    url.searchParams.set('user_uuid', userUuid);

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    const location = upstream.headers.get('location');
    if (location) {
      return NextResponse.json({ success: true, url: location });
    }

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }

    return NextResponse.json(
      { success: false, message: text || 'Unexpected response from backend' },
      { status: upstream.status },
    );
  } catch (err) {
    console.error('[proxy connect] error:', err);
    return NextResponse.json({ success: false, message: 'Network error while initiating connect' }, { status: 500 });
  }
}
