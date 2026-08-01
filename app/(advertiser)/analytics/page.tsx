'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import adsenseApi from '@/app/_lib/adsense-api';
import type { AuthResponse } from '@/app/_types/auth';
import {
  ArrowPathIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import PanelHeader from '@/app/_components/dashboard/PanelHeader';

interface WebsiteSelection {
  websiteId: { _id?: string; id?: string; websiteName?: string } | string;
  status: string;
  isRejected: boolean;
}

interface WebsiteAd {
  _id: string;
  views?: number;
  clicks?: number;
  websiteSelections?: WebsiteSelection[];
}

interface AdPost {
  id: number;
  provider: string;
  views: number;
  likes: number;
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

interface PlatformStat {
  label: string;
  views: number;
  engagement: number; // clicks for website ads, likes for social ads
  engagementLabel: string;
  count: number;
}

// Horizontal bars, one per platform: comparing a handful of named
// categories reads better as labeled bars than a date-axis chart, which is
// what DailyBarChart (see app/_lib/daily-series.ts) is built for instead.
function PlatformBars({ stats, metric }: { stats: PlatformStat[]; metric: 'views' | 'engagement' }) {
  const max = Math.max(...stats.map((s) => s[metric]), 1);
  return (
    <div className="space-y-3">
      {stats.map((s) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-white">{s.label}</span>
            <span className="text-muted">
              {fmt(s[metric])} {metric === 'views' ? 'views' : s.engagementLabel.toLowerCase()} · {s.count} ad{s.count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-background overflow-hidden">
            <div
              className="h-full rounded-full bg-coral transition-all"
              style={{ width: `${(s[metric] / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [webAds, setWebAds] = useState<WebsiteAd[]>([]);
  const [adPosts, setAdPosts] = useState<AdPost[]>([]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setSyncing(true);
    try {
      const sessRes = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);
      const u = sessRes.ok ? ((sessRes.data as any)?.data?.user ?? (sessRes.data as any)?.user) : null;
      const uuid = u?.id ?? u?.user_uuid ?? u?.uuid;

      const [postsRes, webRes] = await Promise.all([
        uuid ? api.get<{ success: boolean; data: AdPost[] }>(`/api/social/ad-posts?user_uuid=${uuid}`) : Promise.resolve(null),
        adsenseApi.get<{ success: boolean; ads?: WebsiteAd[] }>('/api/web-advertise/my-ads'),
      ]);

      setAdPosts(postsRes?.ok ? normaliseArray<AdPost>(postsRes.data?.data) : []);
      setWebAds((webRes.data?.ads ?? []).filter((ad) =>
        ad.websiteSelections?.some((s) => s.status === 'active' && !s.isRejected),
      ));
    } finally {
      setLoading(false);
      if (!quiet) setSyncing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalWebsiteViews  = webAds.reduce((sum, a) => sum + (a.views ?? 0), 0);
  const totalWebsiteClicks = webAds.reduce((sum, a) => sum + (a.clicks ?? 0), 0);
  const totalSocialViews   = adPosts.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const totalSocialLikes   = adPosts.reduce((sum, p) => sum + (p.likes ?? 0), 0);
  const totalViews  = totalWebsiteViews + totalSocialViews;
  const totalAds     = webAds.length + adPosts.length;
  const overallCtr   = totalWebsiteViews > 0 ? ((totalWebsiteClicks / totalWebsiteViews) * 100).toFixed(1) : '0.0';

  // Group by platform: "Website" for website ads, one bucket per social
  // provider (YouTube, Instagram, ...) since that's the coarsest identity
  // the ad-posts data carries today.
  const platformMap = new Map<string, PlatformStat>();
  if (webAds.length > 0) {
    platformMap.set('Website', {
      label: 'Website', views: totalWebsiteViews, engagement: totalWebsiteClicks,
      engagementLabel: 'Clicks', count: webAds.length,
    });
  }
  for (const p of adPosts) {
    const label = p.provider.charAt(0).toUpperCase() + p.provider.slice(1);
    const existing = platformMap.get(label);
    if (existing) {
      existing.views += p.views ?? 0;
      existing.engagement += p.likes ?? 0;
      existing.count += 1;
    } else {
      platformMap.set(label, { label, views: p.views ?? 0, engagement: p.likes ?? 0, engagementLabel: 'Likes', count: 1 });
    }
  }
  const platformStats = Array.from(platformMap.values()).sort((a, b) => b.views - a.views);

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Analytics"
        subtitle="How your ads are performing overall, and platform by platform."
        align="left"
        action={
          <button
            onClick={() => load()}
            disabled={loading || syncing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-2 text-xs font-medium text-white hover:bg-surface-3 transition-all disabled:opacity-40"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${syncing || loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-surface-2 animate-pulse" />)}
        </div>
      ) : totalAds === 0 ? (
        <div className="rounded-2xl border border-border border-dashed bg-surface-1 p-14 flex flex-col items-center gap-3 text-center">
          <MegaphoneIcon className="w-8 h-8 text-muted opacity-40" />
          <p className="text-sm font-semibold text-white">No ads running yet</p>
          <p className="text-xs text-muted">Once you post or place an ad, its performance shows up here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-surface-2 border border-border px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-muted text-xs mb-1"><MegaphoneIcon className="w-3.5 h-3.5" />Ads running</div>
              <p className="text-2xl font-bold text-white">{totalAds}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 border border-border px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-muted text-xs mb-1"><EyeIcon className="w-3.5 h-3.5" />Total views</div>
              <p className="text-2xl font-bold text-white">{fmt(totalViews)}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 border border-border px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-muted text-xs mb-1"><CursorArrowRaysIcon className="w-3.5 h-3.5" />Website clicks</div>
              <p className="text-2xl font-bold text-white">{fmt(totalWebsiteClicks)}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 border border-border px-4 py-3.5">
              <div className="text-muted text-xs mb-1">Website CTR</div>
              <p className="text-2xl font-bold text-white">{overallCtr}%</p>
            </div>
          </div>

          <div className="rounded-2xl bg-surface-2 border border-border p-5">
            <h2 className="text-sm font-bold text-white mb-1">Performance by platform</h2>
            <p className="text-xs text-muted mb-5">Views across every platform you&apos;re advertising on.</p>
            <PlatformBars stats={platformStats} metric="views" />
          </div>

          <div className="rounded-2xl bg-surface-2 border border-border p-5">
            <h2 className="text-sm font-bold text-white mb-1">Engagement by platform</h2>
            <p className="text-xs text-muted mb-5">Clicks (website) and likes (social) per platform.</p>
            <PlatformBars stats={platformStats} metric="engagement" />
          </div>
        </>
      )}
    </div>
  );
}
