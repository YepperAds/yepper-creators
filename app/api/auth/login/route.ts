import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
  }

  const upstream = await fetch(`${ADSENSE_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: 'no-store',
  });

  const data = await upstream.json().catch(() => ({ success: false, message: 'Invalid response from auth server.' }));

  if (!upstream.ok || !data.success) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const res = NextResponse.json({ ...data, redirectTo: '/' });

  if (data.token) {
    const cookieOpts = {
      path:     '/',
      sameSite: 'lax' as const,
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   60 * 60 * 24 * 7,
    };
    // httpOnly cookie — used by Next.js API routes (/api/auth/session, etc.)
    res.cookies.set('yepper_session', data.token, { ...cookieOpts, httpOnly: true });
    // readable cookie — used by client-side axios in adsense utils/api.tsx
    res.cookies.set('yepper_token', data.token, { ...cookieOpts, httpOnly: false });
  }

  return res;
}
