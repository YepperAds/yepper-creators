import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token ?? null;

  if (!token) {
    return NextResponse.json({ success: false, message: 'Missing token' }, { status: 400 });
  }

  const userId = 'local-user-1';

  const res = NextResponse.json({
    success: true,
    data: { user: { user_uuid: userId, id: userId, name: 'Local User' } },
  });

  // Set a simple HTTP-only session cookie for local development
  res.cookies.set('yepper_session', userId, { httpOnly: true, path: '/' });
  return res;
}
