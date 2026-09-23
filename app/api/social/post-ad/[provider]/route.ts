import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

// Stream the multipart video upload directly to the backend without buffering it in memory.
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const resolvedParams = await params;
  const provider      = resolvedParams.provider;
  const cookieHeader  = req.headers.get('cookie') ?? '';
  const contentType   = req.headers.get('content-type') ?? '';
  const authorization = req.headers.get('authorization');

  try {
    const upstream = await fetch(
      `${ADSENSE_API}/api/social/post-ad/${encodeURIComponent(provider)}`,
      {
        method:  'POST',
        headers: {
          'Content-Type': contentType,
          'cookie': cookieHeader,
          ...(authorization ? { authorization } : {}),
        },
        body:    req.body,
        duplex:  'half',
      } as RequestInit & { duplex: 'half' },
    );

    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');

    if (!text) {
      return NextResponse.json({ success: upstream.ok }, { status: upstream.status });
    }

    if (isJson || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        const payload = JSON.parse(text);
        return NextResponse.json(payload, { status: upstream.status });
      } catch {
        return NextResponse.json({ success: false, message: text, error: text }, { status: upstream.status });
      }
    }

    return NextResponse.json({ success: upstream.ok, message: text }, { status: upstream.status });
  } catch (err) {
    console.error('[proxy] post-ad error:', err);
    return NextResponse.json({ success: false, message: 'Upload proxy error' }, { status: 500 });
  }
}
