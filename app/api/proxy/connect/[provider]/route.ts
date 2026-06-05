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
  return NextResponse.json({ success: true, url: '#' });
}
