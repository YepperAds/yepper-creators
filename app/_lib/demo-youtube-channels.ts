import type { PublicCreator } from './public-home';

const demoChannels = [
  {
    name: 'Rocky Entertainment',
    avatar: 'https://yt3.googleusercontent.com/IAszSeN436Bi60JUU92N0Wy3AiITa3fP0_0a9PiLuwWg-VNMo0IZtSBVy9pWHSibDNq_PZb17Q=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_610_000,
    videoId: '4r-YI5zzQ00',
  },
  {
    name: 'Chita magic',
    avatar: 'https://yt3.googleusercontent.com/WIdnM4yqNE7K9XMKxZi2-9sEBLxASpQENoW3k8fOsUgHn7IB0_WwoMvsbfPSl07mwiMHwz_KaA=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 848_000,
    videoId: 'kRbscHPx21U',
  },
  {
    name: 'MIE Empire',
    avatar: 'https://yt3.googleusercontent.com/H5evud0AJD-cnp0flAV6KdIxL72LEoqzckV3TvqHLFOnSo-GvD9nKETh44CTQOkhLQUkw7oLsw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_060_000,
    videoId: '11ct3se_8eU',
  },
  {
    name: 'Ines',
    avatar: 'https://yt3.googleusercontent.com/tpWgyhOpKBxRjHlOl503eP-7_0iZ4s8QtiK2cs8S8kK5uDD4mTahrKP1mT7NObnBwBGTFfDmdXs=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_120,
    videoId: '7DfcxJNI4OM',
  },
  {
    name: 'Quick Homes Rwanda',
    avatar: 'https://yt3.googleusercontent.com/0B_2ZpyWKLSubE46Q5QBD3JSzGiRHgSORPqLa1qGM7AczVQ5Fc8LfvtJq5j-oAjFX1yMId8maZw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 22_700,
    videoId: 'ykukG1pQNI0',
  },
  {
    name: 'IGIHE',
    avatar: 'https://yt3.googleusercontent.com/U7chg_gmHUCANEacfwjOz_phryvkf54S6Xlyo4Y_WOmAnV71bi_MAxk1JKgGZmD_VwhHxWHKGw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 868_000,
    videoId: '1Bg0jjVfhbc',
  },
  {
    name: 'Rwanda updates',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_mNjM-2kgtYT3BniAkfng0k1eCpZuZ3TN-RfuPK31nsOXo=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 822_000,
    videoId: 'DfdGvujDpzc',
  },
  {
    name: 'THE QUICKTIMES NEWS',
    avatar: 'https://yt3.googleusercontent.com/AP8GKnzGXfrlMxB_BDGZSaFE3_PPb2TC927tITJtaK-5Qn0OdIJeWUQYtv1wpx1bkdgm5TD1xw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 333_000,
    videoId: 'Iq69IX5G52g',
  },
  {
    name: 'cheymuv',
    avatar: 'https://yt3.googleusercontent.com/nX_QmvccL9jpcXxqeJE0uEoSnZoMDHoHw-I7Bg4m6C3GP9p9tWMVtKRxtDwbU_hd4AldHutU-Q=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 131_000,
    videoId: 'lLiU9HDEwEY',
  },
  {
    name: 'Benitha & Kelly',
    avatar: 'https://yt3.googleusercontent.com/LX0--E7RqyUKBzT4k3WJGs1L3h99HTWKO3arzAReEgqqIBk885XjgEDF2zGFlqK6r8_3joBIVg=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 2_860,
    videoId: 'WzcIXpcNVKY',
  },
  {
    name: 'Benie',
    avatar: 'https://yt3.googleusercontent.com/ZWy0FsfHrXF4pJnpQDw5T0kcK26nRi6t4Xw3vvHjYLpupR68LHFDbZymNW4z6TEpo57Nmaqf=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 3_650,
    videoId: 'tXwSqBNJztM',
  },
  {
    name: 'Darina Kayumba',
    avatar: 'https://yt3.googleusercontent.com/HZ9iB996-X1S4Ff_zctHO2K5ZPmgboUZvc2wVJZRHXVP7s3dl0moy8JdSaFSrzDhGXKJ5GYw=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 50_600,
    videoId: 'vGh1i_1Fb1I',
  },
  {
    name: 'The New Times Rwanda',
    avatar: 'https://yt3.googleusercontent.com/33dN6_xF6f8Q6_a_RelTOKAomfvEcXP70iCfuOE54HLv0Kt59tP6PyRSrmEmiyExHU2qQIdv=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 176_000,
    videoId: 'ED6lAZfrN1o',
  },
  {
    name: 'Kigali Today',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_lTjQJCTI2odV4R__tFwUpGEAoPDesGoz16YSOG9pvKOT8=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 1_200_000,
    videoId: 'i_SLLoQhtd4',
  },
  {
    name: 'B&B Kigali 89.7FM',
    avatar: 'https://yt3.googleusercontent.com/vgkVbbIY6GdH18OS5Nc6HKzkhHeraadHdqbzRF1642ByAokFxHSTcS0IyWZhVous7okk3gGP5u0=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 773_000,
    videoId: 'oiOYAWkrQQM',
  },
  {
    name: 'TV1 Rwanda',
    avatar: 'https://yt3.googleusercontent.com/zSAlAYsqNs-8TQixdXE28xJZZ2r8FhbGsW11cCjJX2yhnZSvaOWjDCvi1_EMVQ40n2ERu9OVoQ=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 736_000,
    videoId: 'k59FGHg_7sQ',
  },
  {
    name: '102.3 KISS FM',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_ka7nhlPSSSEBt76l2G9uH3PXVL3L9ioh9ynf_J1FdXn00=s160-c-k-c0x00ffffff-no-rj',
    subscribers: 164_000,
    videoId: 'SvfmABD8QM8',
  },
] as const;

export const DEMO_YOUTUBE_CHANNELS: PublicCreator[] = demoChannels.map((channel, index) => ({
  id: `demo-youtube-${index + 1}`,
  provider: 'youtube',
  isDemo: true,
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
