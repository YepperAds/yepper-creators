import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token ?? null;

  if (!token) {
    return NextResponse.json({ success: false, message: 'Missing token' }, { status: 400 });
  }

  // Verify token with the upstream adsense backend to obtain the user
  try {
    const meRes = await fetch(`${ADSENSE_API}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!meRes.ok) {
      // Log minimal info server-side for debugging, avoid exposing details to clients
      try {
        console.warn('[exchange-token] invalid token attempt');
      } catch (e) {
        // ignore
      }
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const meJson = await meRes.json().catch(() => ({}));
    const user = meJson?.user ?? meJson?.data?.user ?? null;

    if (!user) {
      return NextResponse.json({ success: false, message: 'Could not verify token' }, { status: 500 });
    }

    const res = NextResponse.json({ success: true, data: { user } });

    const cookieOpts = { path: '/', sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7 };

    // Set HTTP-only session cookie (used by server routes)
    res.cookies.set('yepper_session', token, { ...cookieOpts, httpOnly: true });
    // Set readable token cookie for client-side utilities
    res.cookies.set('yepper_token', token, { ...cookieOpts, httpOnly: false });

    return res;
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Token exchange failed' }, { status: 500 });
  }
}
