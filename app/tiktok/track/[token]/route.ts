import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const response = await fetch(`${BACKEND_URL}/api/tiktok/track/${encodeURIComponent(token)}`, {
      redirect: 'manual',
      cache: 'no-store',
    });
    const destination = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && destination) {
      return NextResponse.redirect(destination, response.status);
    }
    return new NextResponse(await response.text(), { status: response.status });
  } catch {
    return new NextResponse('Could not open this campaign link.', { status: 502 });
  }
}