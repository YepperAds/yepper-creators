import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = req.cookies.get('yepper_session')?.value;

  // If there's no active session, return empty (no connected accounts)
  if (!session) {
    return NextResponse.json({ success: true, data: [] });
  }

  // Return a small set of mock connected accounts for demonstration
  return NextResponse.json({
    success: true,
    data: [
      {
        provider: 'youtube',
        handle: 'local_channel',
        followers: 12345,
        avatar: '',
      },
    ],
  });
}
