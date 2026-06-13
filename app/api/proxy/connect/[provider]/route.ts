import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Proxy route: /api/proxy/connect/[provider]?user_id=UUID
//
// The frontend resolves user_uuid client-side (from the session it already has)
// and passes it here as a query parameter. We forward it to the backend connect
// endpoint, capture the OAuth redirect URL from the 302 Location header,
// and return it as JSON so the client can navigate there.
//
// WHY: window.location.href to the backend domain drops the session cookie
// (SameSite restriction). This proxy avoids that entirely.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: _provider } = await params;

  // user_uuid is resolved client-side and passed as a query param
  const userUuid = request.nextUrl.searchParams.get('user_uuid');

  if (!userUuid) {
    return NextResponse.json(
      { success: false, message: 'Missing user_uuid. Please refresh and try again.' },
      { status: 400 }
    );
  }

  // External backend removed — return a harmless local URL so the UI remains unchanged.
  // The client expects `{ success: true, url }` so we provide `#` which keeps the user
  // on the same page while preserving the UI flow.
  const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

  try {
    const url = new URL(`${ADSENSE_API}/api/connect/${encodeURIComponent(_provider)}`);
    if (userUuid) url.searchParams.set('user_uuid', userUuid);

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        // forward cookies so backend can read session if needed
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    });

    // If backend redirected to OAuth provider, capture Location
    const location = upstream.headers.get('location');
    if (location) {
      return NextResponse.json({ success: true, url: location });
    }

    // If backend returned JSON or other response, try to forward it
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }

    return NextResponse.json({ success: false, message: text || 'Unexpected response from backend' }, { status: upstream.status });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Network error while initiating connect' }, { status: 500 });
  }
}
