// ─────────────────────────────────────────────────────────────────────────────
// Public homepage data — server-side only.
// Calls the backend directly (no auth needed, nothing to forward) for the
// logged-out landing page: all websites + all creators with YouTube videos.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.ADSENSE_BACKEND_URL ?? 'http://localhost:5000';

export interface PublicWebsite {
  id: string;
  websiteName: string;
  websiteLink: string;
  imageUrl: string | null;
  businessCategories: string[];
  trafficTier: string;
}

export interface PublicVideo {
  title: string;
  views: number;
  likes: number;
  published_at: string | null;
  thumbnail: string | null;
  url: string | null;
}

export interface PublicCreator {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  whatTheyDo: string | null;
  channelName: string;
  channelUrl: string | null;
  subscribers: number;
  totalViews: number;
  videos: PublicVideo[];
}

export async function getPublicWebsites(): Promise<PublicWebsite[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/websites`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getPublicCreators(): Promise<PublicCreator[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/creators/public`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.success && Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export interface HotDealItem {
  id: string;
  itemType: 'youtube' | 'website';
  creatorId: number | null;
  slotType: string | null;
  durationBand: string | null;
  adType: string | null;
  websiteId: string | null;
  categoryId: string | null;
  systemPrice: number;
  dealPrice: number;
}

export interface HotDeal {
  id: string;
  title: string;
  description: string | null;
  businessCategory: string;
  coverImageUrl: string | null;
  status: string;
  items: HotDealItem[];
  totalPrice: number;
}

export async function getPublicHotDeals(): Promise<HotDeal[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/hot-deals`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.success && Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}
