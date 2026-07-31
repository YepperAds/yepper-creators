import { NextRequest, NextResponse } from 'next/server';

// DEV-ONLY login bypass: lets a developer get an authenticated session on
// localhost without going through real Google OAuth (which needs a registered
// redirect URI you usually don't have configured for localhost).
//
// Reuses the exact same backend endpoint the real flow uses
// (/api/auth/google-exchange, see app/api/auth/google/callback/route.ts),
// just with a fixed fake Google identity instead of a real one. Same Creator
// row, same JWT, same cookies, same redirect logic as a real login.
//
// Returns 404 in production. This route (and the button that links to it in
// LoginForm.tsx) should be deleted once you no longer need local testing.

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, message: 'Not available in production' }, { status: 404 });
  }

  const origin = req.nextUrl.origin;

  let exchangeRes: Response;
  try {
    exchangeRes = await fetch(`${ADSENSE_API}/api/auth/google-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleId: 'dev-local-000001',
        email:    'dev@localhost.test',
        name:     'Local Dev',
        avatar:   '',
      }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.redirect(new URL('/login?error=dev_login_unreachable', origin));
  }

  if (!exchangeRes.ok) {
    return NextResponse.redirect(new URL('/login?error=dev_login_failed', origin));
  }

  const data = (await exchangeRes.json().catch(() => ({}))) as { success?: boolean; token?: string; needsProfile?: boolean };
  if (!data.success || !data.token) {
    return NextResponse.redirect(new URL('/login?error=dev_login_failed', origin));
  }

  // No role-selection step: everyone lands on the dashboard regardless of profile state.
  const redirectPath = '/';
  const res = NextResponse.redirect(new URL(redirectPath, origin));

  const cookieOpts = {
    path:     '/',
    sameSite: 'lax' as const,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   60 * 60 * 24 * 7,
  };
  res.cookies.set('yepper_session', data.token, { ...cookieOpts, httpOnly: true });
  res.cookies.set('yepper_token',   data.token, { ...cookieOpts, httpOnly: false });

  return res;
}
