import { NextResponse } from 'next/server';

export async function GET() {
  // Return some mock recent posts/videos
  return NextResponse.json({
    success: true,
    data: [
      {
        title: 'Demo video 1',
        thumbnail: '',
        views: 1234,
        likes: 56,
        comments: 4,
        url: 'https://example.com',
      },
      {
        title: 'Demo video 2',
        thumbnail: '',
        views: 987,
        likes: 12,
        comments: 1,
        url: 'https://example.com',
      },
    ],
  });
}
