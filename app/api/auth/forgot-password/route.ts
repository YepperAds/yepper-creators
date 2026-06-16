import { NextRequest, NextResponse } from 'next/server';
const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const upstream = await fetch(`${ADSENSE_API}/api/password/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), cache: 'no-store',
    });
    const json = await upstream.json();
    return NextResponse.json(json, { status: upstream.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Auth server unreachable.' }, { status: 503 });
  }
}
