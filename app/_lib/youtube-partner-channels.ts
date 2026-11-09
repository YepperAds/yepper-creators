import type { PublicCreator } from './public-home';

const partnerChannels = [
  {
    id: 'partner-youtube-1',
    name: 'Rocky Entertainment',
    avatar: 'https://yt3.googleusercontent.com/IAszSeN436Bi60JUU92N0Wy3AiITa3fP0_0a9PiLuwWg-VNMo0IZtSBVy9pWHSibDNq_PZb17Q=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_610_000,
    videoId: '4r-YI5zzQ00',
  },
  {
    id: 'partner-youtube-2',
    name: 'Chita magic',
    avatar: 'https://yt3.googleusercontent.com/WIdnM4yqNE7K9XMKxZi2-9sEBLxASpQENoW3k8fOsUgHn7IB0_WwoMvsbfPSl07mwiMHwz_KaA=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 848_000,
    videoId: 'kRbscHPx21U',
  },
  {
    id: 'partner-youtube-4',
    name: 'Ines',
    avatar: 'https://yt3.googleusercontent.com/tpWgyhOpKBxRjHlOl503eP-7_0iZ4s8QtiK2cs8S8kK5uDD4mTahrKP1mT7NObnBwBGTFfDmdXs=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_120,
    videoId: '7DfcxJNI4OM',
  },
  {
    id: 'partner-youtube-5',
    name: 'Quick Homes Rwanda',
    avatar: 'https://yt3.googleusercontent.com/0B_2ZpyWKLSubE46Q5QBD3JSzGiRHgSORPqLa1qGM7AczVQ5Fc8LfvtJq5j-oAjFX1yMId8maZw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 22_700,
    videoId: 'ykukG1pQNI0',
  },
  {
    id: 'partner-youtube-7',
    name: 'Rwanda updates',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_mNjM-2kgtYT3BniAkfng0k1eCpZuZ3TN-RfuPK31nsOXo=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 822_000,
    videoId: 'DfdGvujDpzc',
  },
  {
    id: 'partner-youtube-8',
    name: 'THE QUICKTIMES NEWS',
    avatar: 'https://yt3.googleusercontent.com/AP8GKnzGXfrlMxB_BDGZSaFE3_PPb2TC927tITJtaK-5Qn0OdIJeWUQYtv1wpx1bkdgm5TD1xw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 333_000,
    videoId: 'Iq69IX5G52g',
  },
  {
    id: 'partner-youtube-9',
    name: 'cheymuv',
    avatar: 'https://yt3.googleusercontent.com/nX_QmvccL9jpcXxqeJE0uEoSnZoMDHoHw-I7Bg4m6C3GP9p9tWMVtKRxtDwbU_hd4AldHutU-Q=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 131_000,
    videoId: 'lLiU9HDEwEY',
  },
  {
    id: 'partner-youtube-10',
    name: 'Benitha & Kelly',
    avatar: 'https://yt3.googleusercontent.com/LX0--E7RqyUKBzT4k3WJGs1L3h99HTWKO3arzAReEgqqIBk885XjgEDF2zGFlqK6r8_3joBIVg=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 2_860,
    videoId: 'WzcIXpcNVKY',
  },
] as const;

export const YOUTUBE_PARTNER_CHANNELS: PublicCreator[] = partnerChannels.map((channel) => ({
  id: channel.id,
  provider: 'youtube',
  isPartnerChannel: true,
  username: channel.name,
  name: channel.name,
  avatar: channel.avatar,
  whatTheyDo: null,
  channelName: channel.name,
  channelUrl: null,
  subscribers: channel.subscribers,
  totalViews: 0,
  videos: [{
    title: 'Featured video',
    views: 0,
    likes: 0,
    published_at: null,
    thumbnail: `https://img.youtube.com/vi/${channel.videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${channel.videoId}`,
  }],
}));
