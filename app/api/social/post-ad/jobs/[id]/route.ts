import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

async function forward(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers: Record<string, string> = {};
  const cookie = req.headers.get('cookie');
  const authorization = req.headers.get('authorization');
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;

  try {
    const upstream = await fetch(`${ADSENSE_API}/api/social/post-ad/jobs/${encodeURIComponent(id)}`, {
      method: req.method,
      headers,
      cache: 'no-store',
    });
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Post-ad service unavailable' }, { status: 502 });
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return forward(req, context);
}