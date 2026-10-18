import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

async function forward(request: NextRequest, method: 'GET' | 'POST') {
  try {
    const upstream = await fetch(`${BACKEND_URL}/api/social/tiktok/profile`, {
      method,
      headers: {
        Accept: 'application/json',
        cookie: request.headers.get('cookie') ?? '',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: await request.text() } : {}),
      cache: 'no-store',
    });
    const payload = await upstream.json().catch(() => ({ success: false, message: 'Unexpected backend response' }));
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json({ success: false, message: 'Network error while accessing TikTok profile' }, { status: 500 });
  }
}

export function GET(request: NextRequest) {
  return forward(request, 'GET');
}

export function POST(request: NextRequest) {
  return forward(request, 'POST');
}