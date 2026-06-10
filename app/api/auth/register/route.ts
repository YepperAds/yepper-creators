// ─────────────────────────────────────────────────────────────────────────────
// Next.js API Route: POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
// Proxies registration to backend-adsense. No cookie is set here —
// the user must verify their email first, then log in normally.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5001';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  let upstream: Response;
  try {
    upstream = await fetch(`${ADSENSE_API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Auth server unreachable. Please try again.' },
      { status: 503 },
    );
  }

  const json = await upstream.json();
  return NextResponse.json(json, { status: upstream.status });
}
