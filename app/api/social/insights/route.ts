import { NextResponse } from 'next/server';

export async function GET() {
  // Return a simple 28-day mock chart
  const days = Array.from({ length: 28 }, (_, i) => ({ day: i + 1, value: Math.floor(Math.random() * 100) }));
  return NextResponse.json({ success: true, data: days });
}
