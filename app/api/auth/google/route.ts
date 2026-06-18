import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = req.nextUrl.origin;

  if (!clientId) {
    return NextResponse.json(
      { success: false, message: 'Google OAuth client ID is not configured.' },
      { status: 500 },
    );
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('access_type', 'online');
  authUrl.searchParams.set('prompt', 'select_account');

  // Google echoes `state` back unchanged on the callback — this is the only
  // way to carry a "return to" path through the OAuth round trip. Only allow
  // same-site relative paths (single leading slash) to avoid open redirects.
  const from = req.nextUrl.searchParams.get('from');
  if (from && from.startsWith('/') && !from.startsWith('//')) {
    authUrl.searchParams.set('state', from);
  }

  return NextResponse.redirect(authUrl.toString());
}
