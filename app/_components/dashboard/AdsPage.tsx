'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import adsenseApi from '@/app/_lib/adsense-api';
import type { AuthResponse } from '@/app/_types/auth';
import {
  EyeIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  CursorArrowRaysIcon,
  FilmIcon,
  GlobeAltIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import PageHeader from './PageHeader';

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

      <span className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white uppercase tracking-wide">
        {item.kind === 'youtube' ? <FilmIcon className="w-3 h-3" /> : <GlobeAltIcon className="w-3 h-3" />}
        {item.kind === 'youtube' ? 'YouTube' : 'Website'}
      </span>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-base font-bold text-white leading-snug line-clamp-2 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">{item.title}</p>
        <p className="text-xs text-white/70 mt-0.5 truncate">{item.subtitle}</p>
        <div className="flex items-center gap-4 mt-2.5 text-sm text-white/90">
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

// Covers almost the whole page: this is the "see everything about this ad"
// view, so it gets the same visual weight as a dedicated page instead of a
// small popover.
function AdDetailModal({ item, onClose }: { item: AdCardItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-8" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="relative w-full max-w-4xl h-full max-h-[88vh] rounded-3xl bg-surface-2 border border-border overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <div className="relative w-full aspect-[16/7] shrink-0 bg-black">
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

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
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
