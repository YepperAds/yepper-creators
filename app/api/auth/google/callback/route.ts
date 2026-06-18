import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
}

interface GoogleUserInfo {
  sub:      string;
  email:    string;
  name:     string;
  picture?: string;
}

export async function GET(req: NextRequest) {
  const code          = req.nextUrl.searchParams.get('code');
  const clientId      = process.env.GOOGLE_CLIENT_ID;
  const clientSecret  = process.env.GOOGLE_CLIENT_SECRET;
  const origin        = req.nextUrl.origin;

  if (!code)                      return NextResponse.redirect(new URL('/login?error=missing_code', origin));
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL('/login?error=google_config', origin));

  // 1. Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  `${origin}/api/auth/google/callback`,
      grant_type:    'authorization_code',
    }),
  });

  if (!tokenRes.ok) return NextResponse.redirect(new URL('/login?error=token_exchange', origin));

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenData.access_token) return NextResponse.redirect(new URL('/login?error=no_access_token', origin));

  // 2. Fetch Google profile
  const profileRes = await fetch(
    `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(tokenData.access_token)}`,
  );
  if (!profileRes.ok) return NextResponse.redirect(new URL('/login?error=user_info', origin));

  const profile = (await profileRes.json()) as GoogleUserInfo;
  if (!profile.sub || !profile.email) return NextResponse.redirect(new URL('/login?error=invalid_profile', origin));

  // 3. Exchange Google profile for a Yepper JWT
  let jwt: string | null = null;
  let needsProfile = false;
  try {
    const exchangeRes = await fetch(`${ADSENSE_API}/api/auth/google-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        googleId: profile.sub,
        email:    profile.email,
        name:     profile.name,
        avatar:   profile.picture ?? '',
      }),
      cache: 'no-store',
    });

    if (exchangeRes.ok) {
      const data = (await exchangeRes.json()) as { success: boolean; token?: string; needsProfile?: boolean };
      if (data.success && data.token) {
        jwt = data.token;
        needsProfile = Boolean(data.needsProfile);
      }
    }
  } catch { /* handled below */ }

  if (!jwt) return NextResponse.redirect(new URL('/login?error=google_exchange_failed', origin));

  // 4. Set both session cookies and redirect to role selection
  const state = req.nextUrl.searchParams.get('state');
  const from  = state && state.startsWith('/') && !state.startsWith('//') ? state : null;
  const redirectPath = needsProfile ? '/choose-role' : (from || '/choose-role');
  const res = NextResponse.redirect(new URL(redirectPath, origin));

  const cookieOpts = {
    path:     '/',
    sameSite: 'lax' as const,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   60 * 60 * 24 * 7,
  };
  res.cookies.set('yepper_session', jwt, { ...cookieOpts, httpOnly: true });
  res.cookies.set('yepper_token',   jwt, { ...cookieOpts, httpOnly: false });

  return res;
}
