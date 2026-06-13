import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

// Stream the multipart video upload directly to the backend without buffering it in memory.
export async function POST(req: NextRequest, { params }: { params: any }) {
  const resolvedParams = await params;
  const provider      = resolvedParams.provider;
  const cookieHeader  = req.headers.get('cookie') ?? '';
  const contentType   = req.headers.get('content-type') ?? '';

  try {
    const upstream = await fetch(
      `${ADSENSE_API}/api/social/post-ad/${encodeURIComponent(provider)}`,
      {
        method:  'POST',
        headers: { 'Content-Type': contentType, 'cookie': cookieHeader },
        // @ts-ignore — readable stream body with duplex streaming
        body:    req.body,
        duplex:  'half',
      } as RequestInit,
    );

    const text        = await upstream.text();
    const jsonContent = upstream.headers.get('content-type')?.includes('application/json');
    if (jsonContent) {
      return NextResponse.json(JSON.parse(text), { status: upstream.status });
    }
    return NextResponse.json({ success: upstream.ok }, { status: upstream.status });
  } catch (err) {
    console.error('[proxy] post-ad error:', err);
    return NextResponse.json({ success: false, message: 'Upload proxy error' }, { status: 500 });
  }
}
