import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('yepper_session')?.value;
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? '').trim();
  const what_they_do = String(body.what_they_do ?? '').trim();
  const avatar = body.avatar && typeof body.avatar === 'string' ? body.avatar : undefined;

  if (!token) return NextResponse.json({ success: false, message: 'No active session' }, { status: 401 });
  if (!username || !what_they_do) return NextResponse.json({ success: false, message: 'username and what_they_do required' }, { status: 400 });

  try {
    const res = await fetch(`${ADSENSE_API}/api/auth/complete-profile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, what_they_do, ...(avatar ? { avatar } : {}) }),
      cache: 'no-store',
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ success: false, message: json?.message ?? 'Failed to update profile' }, { status: res.status });

    return NextResponse.json({ success: true, data: json.data });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Network error' }, { status: 500 });
  }
}
