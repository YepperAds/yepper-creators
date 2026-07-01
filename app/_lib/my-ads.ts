// Combines the two kinds of ads a signed-in user can have running —
// their own posted YouTube ad videos, and their imported/website ads that
// are actively showing on a website *they* own — into one list. Used by
// both the dashboard's "My ads" sidebar box (RightRail) and its "View all"
// destination (AdPostsList), so the two always agree on what counts as
// "your ads" instead of the sidebar counting website ads a YouTube-only
// list can never show.

export interface OwnWebsite {
  id: string | number;
  websiteName: string;
  imageUrl: string | null;
}

export interface MyAd {
  id: string;
  kind: 'website' | 'youtube';
  title: string;
  image: string | null;
  video: string | null;
  trackingCode?: string;
  views: number;
  clicks: number;
  likes?: number;
}

export async function fetchDashboardAds(): Promise<{ websites: OwnWebsite[]; ads: MyAd[] }> {
  const sessRes = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
  const sessJson = await sessRes.json().catch(() => ({}));
  const userId = sessJson?.data?.user?.id ?? sessJson?.data?.user?._id;
  if (!userId) return { websites: [], ads: [] };

  const [wRes, aRes, activeRes] = await Promise.all([
    fetch(`/api/proxy/api/websites/${userId}`, { credentials: 'include', cache: 'no-store' }),
    fetch(`/api/social/ad-posts?user_uuid=${userId}`, { credentials: 'include', cache: 'no-store' }),
    fetch('/api/proxy/api/ad-categories/active-ads', { credentials: 'include', cache: 'no-store' }),
  ]);

  const wJson = await wRes.json().catch(() => ({}));
  const websites: OwnWebsite[] = Array.isArray(wJson) ? wJson : (wJson?.data ?? []);
  const ownWebsiteIds = new Set(websites.map((w) => String(w.id)));

  const aJson = await aRes.json().catch(() => ({}));
  const adPosts: Array<Record<string, unknown>> = Array.isArray(aJson?.data) ? aJson.data : [];

  const activeJson = await activeRes.json().catch(() => ({}));
  const activeAds: Array<Record<string, unknown>> = Array.isArray(activeJson?.activeAds) ? activeJson.activeAds : [];

  const websiteAds: MyAd[] = activeAds
    .filter((ad) => Array.isArray(ad.websiteSelections) && (ad.websiteSelections as Array<Record<string, unknown>>).some(
      (s) => ownWebsiteIds.has(String(s.websiteId)) && s.approved && !s.isRejected && s.status === 'active',
    ))
    .map((ad) => ({
      id: `web-${ad.id}`,
      kind: 'website' as const,
      title: (ad.businessName as string) || 'Ad',
      image: (ad.imageUrl as string) || null,
      video: (ad.videoUrl as string) || null,
      views: Number(ad.views) || 0,
      clicks: Number(ad.clicks) || 0,
    }));

  const youtubeAds: MyAd[] = adPosts.map((p) => ({
    id: `yt-${p.id}`,
    kind: 'youtube' as const,
    title: p.title as string,
    image: (p.thumbnail_url as string) || null,
    video: (p.video_url as string) || null,
    trackingCode: p.tracking_code as string | undefined,
    views: Number(p.views) || 0,
    clicks: 0,
    likes: Number(p.likes) || 0,
  }));

  return { websites, ads: [...youtubeAds, ...websiteAds] };
}
