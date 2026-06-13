import { NextRequest, NextResponse } from 'next/server';

const ADSENSE_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

async function forward(req: NextRequest, params: { path: string[] }) {
  try {
    const path = params?.path?.join('/') ?? '';
    const url = `${ADSENSE_API}/${path}${req.nextUrl.search ?? ''}`;
    if (process.env.NODE_ENV !== 'production') {
      try {
        const cookieToken = req.cookies.get('yepper_session')?.value ?? req.cookies.get('yepper_token')?.value;
        console.log('[proxy] forwarding to:', url, 'method:', req.method, 'tokenPresent:', Boolean(cookieToken));
      } catch (e) {
        // ignore logging failures
      }
    }

    const method = req.method || 'GET';

    // Build headers to forward — preserve most but override Host
    const headers: Record<string, string> = {};
    for (const [k, v] of req.headers) {
      if (k.toLowerCase() === 'host') continue;
      headers[k] = v;
    }

    // Prefer server-side session cookie (yepper_session) or readable token
    const cookieToken = req.cookies.get('yepper_session')?.value ?? req.cookies.get('yepper_token')?.value;
    if (cookieToken) headers['authorization'] = `Bearer ${cookieToken}`;

    // Forward body — use arrayBuffer for all body types so binary (FormData/images) is preserved
    let body: BodyInit | undefined;
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      body = await req.arrayBuffer().catch(() => undefined);
    }

    const res = await fetch(url, {
      method,
      headers,
      body,
      // @ts-ignore — duplex required in Node 18+ when sending a body
      duplex: body !== undefined ? 'half' : undefined,
    });

    const respHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => (respHeaders[k] = v));

    const buffer = await res.arrayBuffer();

    if (!res.ok) {
      console.error('[proxy] upstream responded non-OK', { status: res.status, url });
    }

    return new NextResponse(Buffer.from(buffer), {
      status: res.status,
      headers: respHeaders,
    });
  } catch (err: any) {
    const reason = err?.cause?.message ?? err?.message ?? String(err);
    console.error('[proxy] fetch failed:', reason, '→', url);
    return NextResponse.json(
      { success: false, message: `Proxy error: ${reason}` },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return forward(req, params as { path: string[] });
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return forward(req, params as { path: string[] });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return forward(req, params as { path: string[] });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return forward(req, params as { path: string[] });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return forward(req, params as { path: string[] });
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  // no body expected
  return new NextResponse(null, { status: 204 });
}
