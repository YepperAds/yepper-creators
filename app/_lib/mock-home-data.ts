// ─────────────────────────────────────────────────────────────────────────────
// Placeholder homepage content — only shown when the real network has no
// listings yet, so the marketplace doesn't look empty on day one. Swap or
// remove once there's enough real inventory to fill the grid on its own.
// ─────────────────────────────────────────────────────────────────────────────
import type { PublicWebsite, PublicCreator } from './public-home';

export const MOCK_WEBSITES: PublicWebsite[] = [
  {
    id: 'mock-1',
    websiteName: 'Naija Tech Daily',
    websiteLink: '#',
    imageUrl: 'https://picsum.photos/seed/yepper-tech/640/480',
    businessCategories: ['Technology', 'News'],
    trafficTier: 'premium',
  },
  {
    id: 'mock-2',
    websiteName: 'Fashion Forward',
    websiteLink: '#',
    imageUrl: 'https://picsum.photos/seed/yepper-fashion/640/480',
    businessCategories: ['Fashion', 'Lifestyle'],
    trafficTier: 'elite',
  },
  {
    id: 'mock-3',
    websiteName: 'Sports Daily Africa',
    websiteLink: '#',
    imageUrl: 'https://picsum.photos/seed/yepper-sports/640/480',
    businessCategories: ['Sports'],
    trafficTier: 'standard',
  },
  {
    id: 'mock-4',
    websiteName: 'Money Moves',
    websiteLink: '#',
    imageUrl: 'https://picsum.photos/seed/yepper-finance/640/480',
    businessCategories: ['Finance', 'Business'],
    trafficTier: 'premium',
  },
  {
    id: 'mock-5',
    websiteName: 'Travel Diaries',
    websiteLink: '#',
    imageUrl: 'https://picsum.photos/seed/yepper-travel/640/480',
    businessCategories: ['Travel'],
    trafficTier: 'standard',
  },
  {
    id: 'mock-6',
    websiteName: 'Naija Recipes',
    websiteLink: '#',
    imageUrl: 'https://picsum.photos/seed/yepper-food/640/480',
    businessCategories: ['Food', 'Lifestyle'],
    trafficTier: 'basic',
  },
];

// Real, widely-embeddable public YouTube videos — just for previewing the
// real autoplay-loop card behavior with mock data. Swap for actual creator
// videos once real ones are connected.
const SAMPLE_VIDEO_IDS = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0', 'kJQP7kiw5Fk'];

function mockVideos(seedOffset: number): PublicCreator['videos'] {
  return [0, 1, 2].map((i) => {
    const id = SAMPLE_VIDEO_IDS[(seedOffset + i) % SAMPLE_VIDEO_IDS.length];
    return {
      title: `Episode ${i + 1} — worth a watch`,
      views: 5_000 + ((seedOffset + i) * 37_511) % 200_000,
      likes: 200 + ((seedOffset + i) * 911) % 8_000,
      published_at: null,
      thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

export const MOCK_CREATORS: PublicCreator[] = [
  {
    id: 'mock-c1',
    username: 'rockykim',
    name: 'Rocky Kim',
    avatar: 'https://i.pravatar.cc/150?img=12',
    whatTheyDo: 'Comedy & skits',
    channelName: 'Rocky Kim',
    channelUrl: '#',
    subscribers: 482_000,
    totalViews: 12_400_000,
    videos: mockVideos(0),
  },
  {
    id: 'mock-c2',
    username: 'emelinepenzi',
    name: 'Emeline Penzi',
    avatar: 'https://i.pravatar.cc/150?img=47',
    whatTheyDo: 'Gospel music',
    channelName: 'Emeline Penzi Official',
    channelUrl: '#',
    subscribers: 215_000,
    totalViews: 6_100_000,
    videos: mockVideos(1),
  },
  {
    id: 'mock-c3',
    username: 'belysewb',
    name: 'Belyse wa Byinshi',
    avatar: 'https://i.pravatar.cc/150?img=33',
    whatTheyDo: 'Vlogs & lifestyle',
    channelName: 'Belyse wa Byinshi',
    channelUrl: '#',
    subscribers: 98_000,
    totalViews: 2_800_000,
    videos: mockVideos(2),
  },
  {
    id: 'mock-c4',
    username: 'ndoba',
    name: 'Ndoba',
    avatar: 'https://i.pravatar.cc/150?img=8',
    whatTheyDo: 'Tech reviews',
    channelName: 'Ndoba Tech',
    channelUrl: '#',
    subscribers: 64_000,
    totalViews: 1_900_000,
    videos: mockVideos(3),
  },
];
