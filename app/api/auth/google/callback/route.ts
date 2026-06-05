import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/_lib/db';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  id_token?: string;
  scope?: string;
  token_type: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = req.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect('/login?error=missing_code');
  }

  if (!clientId || !clientSecret) {
    return NextResponse.redirect('/login?error=google_config_missing');
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect('/login?error=invalid_token_response');
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenData.access_token) {
    return NextResponse.redirect('/login?error=missing_access_token');
  }

  const profileResponse = await fetch(
    `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(tokenData.access_token)}`,
  );

  if (!profileResponse.ok) {
    return NextResponse.redirect('/login?error=invalid_user_info');
  }

  const profile = (await profileResponse.json()) as GoogleUserInfo;

  if (!profile.sub || !profile.email) {
    return NextResponse.redirect('/login?error=invalid_google_profile');
  }

  const displayName = profile.name ?? '';
  const avatar = profile.picture ?? null;

  const result = await query<{
    id: number;
    business_name: string | null;
  }>(
    `INSERT INTO businesses (google_id, email, full_name, avatar, updated_at, created_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (google_id)
     DO UPDATE SET email = EXCLUDED.email,
                   full_name = EXCLUDED.full_name,
                   avatar = EXCLUDED.avatar,
                   updated_at = NOW()
     RETURNING id, business_name;`,
    [profile.sub, profile.email, displayName, avatar],
  );

  const row = result.rows[0];
  const redirectPath = row?.business_name ? '/explore' : '/onboarding';
  const response = NextResponse.redirect(new URL(redirectPath, origin));
  response.cookies.set('yepper_session', String(row.id), {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
