import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; id: string }> },
) {
  const { provider, id } = await params;
  const headers: Record<string, string> = { 'content-type': req.headers.get('content-type') ?? 'application/json' };
  const cookie = req.headers.get('cookie');
  const authorization = req.headers.get('authorization');
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.authorization = authorization;

  try {
    const upstream = await fetch(
      `${ADSENSE_API}/api/social/post-ad/${encodeURIComponent(provider)}/confirm/${encodeURIComponent(id)}`,
      { method: 'POST', headers, body: await req.text() },
    );
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Post-ad service unavailable' }, { status: 502 });
  }
}