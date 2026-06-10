import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  const clear = { path: '/', maxAge: 0 };
  res.cookies.set('yepper_session', '', { ...clear, httpOnly: true });
  res.cookies.set('yepper_token',   '', { ...clear, httpOnly: false });
  return res;
}
