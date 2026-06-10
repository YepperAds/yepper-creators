// ─────────────────────────────────────────────────────────────────────────────
// Next.js API Route: GET /api/auth/verify-email?token=…
// ─────────────────────────────────────────────────────────────────────────────
// The email verification link points to the adsense backend directly, which
// redirects to /verify-success?token=JWT after verifying.
// This route handles the Next.js-side of that redirect flow: it reads the
// JWT from the query string, stores it as the session cookie, then sends the
// user to the home page (or wherever they came from).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const autoLogin = req.nextUrl.searchParams.get('auto_login');

  if (!token || autoLogin !== 'true') {
    return NextResponse.redirect(new URL('/login?error=verify_failed', req.nextUrl.origin));
  }

  const res = NextResponse.redirect(new URL('/', req.nextUrl.origin));

  res.cookies.set('yepper_session', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
