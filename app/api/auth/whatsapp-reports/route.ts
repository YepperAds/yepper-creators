import { NextRequest, NextResponse } from 'next/server';

const AUTH_API = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

async function forward(req: NextRequest, method: 'GET' | 'PUT' | 'POST') {
  const token = req.cookies.get('yepper_session')?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: 'No active session.' }, { status: 401 });
  }

  let body: string | undefined;
  if (method === 'PUT') {
    try {
      body = JSON.stringify(await req.json());
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 });
    }
  }

  try {
    const endpoint = method === 'POST' ? '/test' : '';
    const response = await fetch(`${AUTH_API}/api/auth/whatsapp-reports${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error('WhatsApp report settings request failed:', error);
    return NextResponse.json(
      { success: false, message: 'Could not reach the account service. Please try again.' },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest) {
  return forward(req, 'GET');
}

export async function PUT(req: NextRequest) {
  return forward(req, 'PUT');
}

export async function POST(req: NextRequest) {
  return forward(req, 'POST');
}
