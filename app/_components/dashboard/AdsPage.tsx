'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import adsenseApi from '@/app/_lib/adsense-api';
import type { AuthResponse } from '@/app/_types/auth';
import {
  EyeIcon,
  UsersIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  CursorArrowRaysIcon,
  FilmIcon,
  GlobeAltIcon,
  MapPinIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import PageHeader from './PageHeader';
import AudienceMap from '@/app/(adsense)/ad-promoter/_components/AudienceMap';
import DailyBarChart from '@/app/(adsense)/ad-promoter/_components/DailyBarChart';
import { buildDailySeries } from '@/app/_lib/daily-series';

interface WebsiteSelection {
  websiteId: { _id?: string; id?: string; websiteName?: string; websiteLink?: string; imageUrl?: string | null } | string;
  status: string;
  isRejected: boolean;
}

interface WebsiteAd {
  _id: string;
  businessName: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  views?: number;
  clicks?: number;
  createdAt?: string;
  websiteSelections?: WebsiteSelection[];
}

interface AdPost {
  id: number;
  provider: string;
  tracking_code: string;
  video_url: string | null;
  title: string;
  thumbnail_url: string | null;
  views: number;
  likes: number;
  comments: number;
  posted_at: string;
}

interface AdCardItem {
  key: string;
  kind: 'website' | 'youtube';
  title: string;
  subtitle: string;
  image: string | null;
  views: number;
  secondaryLabel: string;
  secondaryValue: number;
  websiteLink?: string;
  websiteId?: string;
  videoUrl?: string | null;
  trackingCode?: string;
  likes?: number;
  comments?: number;
  clicks?: number;
}

function fmt(n: number | undefined | null): string {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function normaliseArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') return Object.values(raw) as T[];
  return [];
}

// Big square tiles, image-first: the point of this page is "browse your ad
// creatives at a glance," so the photo does most of the work and stats sit
// in a scrim at the bottom, Pinterest/Instagram-grid style, not a data table.
function AdTile({ item, onOpen }: { item: AdCardItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group relative aspect-square rounded-2xl overflow-hidden bg-surface-2 border border-border hover:border-coral/40 transition-colors text-left"
    >
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {item.kind === 'youtube' ? <FilmIcon className="w-10 h-10 text-muted" /> : <GlobeAltIcon className="w-10 h-10 text-muted" />}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

      <span className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-bold text-[#fff] uppercase tracking-wide">
        {item.kind === 'youtube' ? <FilmIcon className="w-3 h-3" /> : <GlobeAltIcon className="w-3 h-3" />}
        {item.kind === 'youtube' ? 'YouTube' : 'Website'}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-base font-bold text-[#fff] leading-snug line-clamp-2 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">{item.title}</p>
        <p className="text-xs text-[#fff]/70 mt-0.5 truncate">{item.subtitle}</p>
        <div className="flex items-center gap-4 mt-2.5 text-sm text-[#fff]/90">
          <span className="flex items-center gap-1"><EyeIcon className="w-4 h-4" />{fmt(item.views)}</span>
          <span className="flex items-center gap-1">
            {item.kind === 'youtube' ? <HeartIcon className="w-4 h-4" /> : <CursorArrowRaysIcon className="w-4 h-4" />}
            {fmt(item.secondaryValue)}
          </span>
        </div>
      </div>
    </button>
  );
}

interface SiteAnalytics {
  totalViews?: number;
  uniqueVisitors?: number;
  byDay?: Array<Record<string, unknown>>;
  mapPoints?: Array<{ lat: number; lon: number; device?: string; city?: string; country?: string; timestamp?: string }>;
}

// The audience shown here is the website's real visitor traffic, the same
// approach as WebsiteAdAudienceSnapshot: there's no per-ad view/click event
// log on the backend, but since the ad only shows on this one site, that
// site's audience *is* the ad's audience.
function useSiteAnalytics(websiteId: string | undefined) {
  const [analytics, setAnalytics] = useState<SiteAnalytics | null>(null);
  const [loading, setLoading] = useState(!!websiteId);

  useEffect(() => {
    if (!websiteId) { setAnalytics(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    adsenseApi.get(`/api/analytics/${websiteId}?range=30`)
      .then((r) => { if (!cancelled) setAnalytics(r.data as SiteAnalytics); })
      .catch(() => { if (!cancelled) setAnalytics(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [websiteId]);

  return { analytics, loading };
}

// Covers almost the whole page: this is the "see everything about this ad"
// view, so it gets the same visual weight as a dedicated page instead of a
// small popover. Wide two-column layout so the audience map gets a real
// column of its own instead of being squeezed under everything else, where
// its corner attribution control was getting clipped.
function AdDetailModal({ item, onClose }: { item: AdCardItem; onClose: () => void }) {
  const { analytics, loading: analyticsLoading } = useSiteAnalytics(item.kind === 'website' ? item.websiteId : undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="relative w-[97vw] max-w-[1600px] h-full max-h-[92vh] rounded-3xl bg-surface-2 border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex items-center justify-center w-9 h-9 rounded-full bg-black/60 text-[#fff] hover:bg-black/80 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="grid lg:grid-cols-2 h-full">
          {/* Left: image, details, stats, performance over time */}
          <div className="h-full overflow-y-auto">
            <div className="relative w-full aspect-[16/9] shrink-0 bg-black">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  {item.kind === 'youtube' ? <FilmIcon className="w-12 h-12 text-muted" /> : <GlobeAltIcon className="w-12 h-12 text-muted" />}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-2 via-transparent to-transparent" />
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background text-[10px] font-bold text-muted uppercase tracking-wide">
                  {item.kind === 'youtube' ? <FilmIcon className="w-3 h-3" /> : <GlobeAltIcon className="w-3 h-3" />}
                  {item.kind === 'youtube' ? 'YouTube' : 'Website'}
                </span>
                <h2 className="text-2xl font-bold text-white mt-3 font-(--font-display)">{item.title}</h2>
                <p className="text-sm text-muted mt-1">{item.subtitle}</p>
                {item.trackingCode && <p className="text-xs font-mono text-emerald-400 mt-1">{item.trackingCode}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-background px-4 py-3">
                  <div className="flex items-center gap-1.5 text-muted text-xs mb-1"><EyeIcon className="w-4 h-4" />Views</div>
                  <p className="text-xl font-bold text-white">{fmt(item.views)}</p>
                </div>
                {item.kind === 'website' ? (
                  <>
                    <div className="rounded-xl bg-background px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted text-xs mb-1"><CursorArrowRaysIcon className="w-4 h-4" />Clicks</div>
                      <p className="text-xl font-bold text-white">{fmt(item.clicks)}</p>
                    </div>
                    <div className="rounded-xl bg-background px-4 py-3">
                      <div className="text-muted text-xs mb-1">CTR</div>
                      <p className="text-xl font-bold text-white">
                        {item.views ? (((item.clicks ?? 0) / item.views) * 100).toFixed(1) : '0.0'}%
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl bg-background px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted text-xs mb-1"><HeartIcon className="w-4 h-4" />Likes</div>
                      <p className="text-xl font-bold text-white">{fmt(item.likes)}</p>
                    </div>
                    <div className="rounded-xl bg-background px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted text-xs mb-1"><ChatBubbleLeftIcon className="w-4 h-4" />Comments</div>
                      <p className="text-xl font-bold text-white">{fmt(item.comments)}</p>
                    </div>
                  </>
                )}
              </div>

              {(item.websiteLink || item.videoUrl) && (
                <a
                  href={item.websiteLink ?? item.videoUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-coral-text hover:opacity-80 transition-opacity"
                >
                  View live →
                </a>
              )}

              {item.kind === 'website' && analytics?.byDay && analytics.byDay.length > 0 && (
                <div className="rounded-xl bg-background p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Site traffic, last 30 days</p>
                  <DailyBarChart series={buildDailySeries(analytics.byDay, 30, 'count')} height={96} />
                </div>
              )}
            </div>
          </div>

          {/* Right: audience map, its own full-height column so the corner
              attribution control has room to render in full. */}
          <div className="h-full overflow-y-auto border-t lg:border-t-0 lg:border-l border-border bg-background/40 p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1">Where your audience is</p>

            {item.kind !== 'website' ? (
              <div className="mt-4 rounded-xl border border-dashed border-border p-8 flex flex-col items-center gap-2 text-center">
                <MapPinIcon className="w-8 h-8 text-muted opacity-40" />
                <p className="text-sm text-muted">Audience location isn&apos;t available for social ads yet.</p>
              </div>
            ) : analyticsLoading ? (
              <div className="mt-4 h-[420px] rounded-xl bg-surface-3 animate-pulse" />
            ) : !analytics?.mapPoints?.length ? (
              <div className="mt-4 rounded-xl border border-dashed border-border p-8 flex flex-col items-center gap-2 text-center">
                <MapPinIcon className="w-8 h-8 text-muted opacity-40" />
                <p className="text-sm text-muted">No visitor location data yet for the site this ad runs on.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mt-3 mb-4">
                  <div className="rounded-xl bg-background px-4 py-3">
                    <div className="flex items-center gap-1.5 text-muted text-[11px] mb-1"><EyeIcon className="w-3.5 h-3.5" />Views (30d)</div>
                    <p className="text-lg font-bold text-white">{fmt(analytics.totalViews)}</p>
                  </div>
                  <div className="rounded-xl bg-background px-4 py-3">
                    <div className="flex items-center gap-1.5 text-muted text-[11px] mb-1"><UsersIcon className="w-3.5 h-3.5" />Unique visitors</div>
                    <p className="text-lg font-bold text-white">{fmt(analytics.uniqueVisitors)}</p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-border">
                  <AudienceMap points={analytics.mapPoints} height={420} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdsPage({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<AdCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openItem, setOpenItem] = useState<AdCardItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sessRes = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);
      const u = sessRes.ok ? ((sessRes.data as any)?.data?.user ?? (sessRes.data as any)?.user) : null;
      const uuid = u?.id ?? u?.user_uuid ?? u?.uuid;

      const [postsRes, webRes] = await Promise.all([
        uuid ? api.get<{ success: boolean; data: AdPost[] }>(`/api/social/ad-posts?user_uuid=${uuid}`) : Promise.resolve(null),
        adsenseApi.get<{ success: boolean; ads?: WebsiteAd[] }>('/api/web-advertise/my-ads'),
      ]);

      const posts = postsRes?.ok ? normaliseArray<AdPost>(postsRes.data?.data) : [];
      const webAds = (webRes.data?.ads ?? []).filter((ad) =>
        ad.websiteSelections?.some((s) => s.status === 'active' && !s.isRejected),
      );

      const youtubeItems: AdCardItem[] = posts.map((p) => ({
        key: `yt-${p.id}`,
        kind: 'youtube',
        title: p.title,
        subtitle: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
        image: p.thumbnail_url,
        views: p.views,
        secondaryLabel: 'Likes',
        secondaryValue: p.likes,
        likes: p.likes,
        comments: p.comments,
        trackingCode: p.tracking_code,
        videoUrl: p.video_url,
      }));

      const websiteItems: AdCardItem[] = webAds.map((ad) => {
        const activeSelection = ad.websiteSelections?.find((s) => s.status === 'active' && !s.isRejected);
        const site = activeSelection && typeof activeSelection.websiteId === 'object' ? activeSelection.websiteId : null;
        return {
          key: `web-${ad._id}`,
          kind: 'website',
          title: ad.businessName,
          subtitle: site?.websiteName ?? 'Website ad',
          image: site?.imageUrl ?? ad.imageUrl ?? null,
          views: ad.views ?? 0,
          secondaryLabel: 'Clicks',
          secondaryValue: ad.clicks ?? 0,
          clicks: ad.clicks ?? 0,
          websiteLink: site?.websiteLink,
          websiteId: site?._id ?? site?.id,
        };
      });

      setItems([...youtubeItems, ...websiteItems]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader title="Ads" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-1 py-4">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-square rounded-2xl bg-surface-2 animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm font-semibold text-white">No ads running yet</p>
            <p className="text-xs text-muted mt-1">Ads you post or place will show up here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {items.map((item) => (
              <AdTile key={item.key} item={item} onOpen={() => setOpenItem(item)} />
            ))}
          </div>
        )}
      </div>

      {openItem && <AdDetailModal item={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
