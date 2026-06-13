'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ExclamationCircleIcon,
  FilmIcon,
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AdPost {
  id: number;
  provider: string;
  tracking_code: string;
  tracking_num: number;
  platform_video_id: string | null;
  video_url: string | null;
  title: string;
  description: string;
  thumbnail_url: string | null;
  status: string;
  views: number;
  likes: number;
  comments: number;
  posted_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform icons (small, used inside cards)
// ─────────────────────────────────────────────────────────────────────────────

type Provider = 'youtube' | 'instagram' | 'facebook';

const PROVIDER_COLOR: Record<string, string> = {
  youtube: '#FF0000', instagram: '#E1306C', facebook: '#1877F2',
};

const PROVIDER_ICONS: Record<Provider, React.ReactNode> = {
  youtube: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.498 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  instagram: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  ),
  facebook: (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function sinceSeconds(ts: number | null): string {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function normaliseArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') return Object.values(raw) as T[];
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Ad campaign card (collapsible, live stats)
// ─────────────────────────────────────────────────────────────────────────────

function AdCampaignCard({ post, open, onToggle }: { post: AdPost; open: boolean; onToggle: () => void }) {
  const color     = PROVIDER_COLOR[post.provider] ?? '#888';
  const provLabel = post.provider.charAt(0).toUpperCase() + post.provider.slice(1);
  const icon      = PROVIDER_ICONS[post.provider as Provider] ?? null;

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-2) overflow-hidden">
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-(--color-surface-3) transition-colors text-left"
      >
        {/* Platform icon */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {icon}
        </div>

        {/* Thumbnail */}
        {post.thumbnail_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={post.thumbnail_url} alt={post.title} className="w-10 h-7 rounded object-cover shrink-0" />
          : <div className="w-10 h-7 rounded bg-(--color-surface-3) shrink-0 flex items-center justify-center">
              <FilmIcon className="w-3.5 h-3.5 text-(--color-muted)" />
            </div>
        }

        {/* Tracking code + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0">{post.tracking_code}</span>
            <span className="text-xs font-medium text-(--color-white) truncate">{post.title}</span>
          </div>
          <p className="text-[10px] text-(--color-muted) mt-0.5">{provLabel} · {timeAgo(post.posted_at)}</p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-[11px] text-(--color-muted) shrink-0">
          <span className="flex items-center gap-1"><EyeIcon className="w-3 h-3" />{fmt(post.views)}</span>
          <span className="flex items-center gap-1"><HeartIcon className="w-3 h-3" />{fmt(post.likes)}</span>
        </div>

        {open
          ? <ChevronUpIcon className="w-4 h-4 text-(--color-muted) ml-1 shrink-0" />
          : <ChevronDownIcon className="w-4 h-4 text-(--color-muted) ml-1 shrink-0" />
        }
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-(--color-border) p-5 space-y-4">
          <div className="flex gap-4">
            <div className="shrink-0">
              {post.thumbnail_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={post.thumbnail_url} alt={post.title} className="w-32 h-[72px] rounded-xl object-cover" />
                : <div className="w-32 h-[72px] rounded-xl bg-(--color-surface-3) flex items-center justify-center">
                    <FilmIcon className="w-6 h-6 text-(--color-muted)" />
                  </div>
              }
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-bold text-(--color-white) leading-snug">{post.title}</p>
              <p className="text-[11px] font-mono text-emerald-400">{post.tracking_code}</p>
              <p className="text-[11px] text-(--color-muted)">{provLabel} · Posted {timeAgo(post.posted_at)}</p>
            </div>
          </div>

          {/* Live stat pills */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <EyeIcon className="w-3.5 h-3.5" />,            label: 'Views',    val: post.views    },
              { icon: <HeartIcon className="w-3.5 h-3.5" />,          label: 'Likes',    val: post.likes    },
              { icon: <ChatBubbleLeftIcon className="w-3.5 h-3.5" />, label: 'Comments', val: post.comments },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-(--color-surface-3) px-4 py-3">
                <div className="flex items-center gap-1.5 text-(--color-muted) text-[11px] mb-1">{s.icon}{s.label}</div>
                <p className="text-lg font-bold text-(--color-white)">{fmt(s.val)}</p>
              </div>
            ))}
          </div>

          {post.video_url && (
            <a
              href={post.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span style={{ color }}>●</span> View on {provLabel} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Analytics Page
// ─────────────────────────────────────────────────────────────────────────────

const SYNC_MS = 30_000;

export default function AnalyticsPage() {
  const [userUuid, setUserUuid] = useState<string | null>(null);
  const [adPosts,  setAdPosts ] = useState<AdPost[]>([]);
  const [loading,  setLoading ] = useState(true);
  const [syncing,  setSyncing ] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [tick,     setTick    ] = useState(0);
  const [error,    setError   ] = useState('');

  const [openAds, setOpenAds] = useState<Set<number>>(new Set());

  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every 10 s to keep "synced X ago" label fresh
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  // Resolve session user ID
  useEffect(() => {
    api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession).then(res => {
      if (res.ok) {
        const u    = (res.data as any)?.data?.user ?? (res.data as any)?.user;
        const uuid = u?.id ?? u?.user_uuid ?? u?.uuid;
        if (uuid) { setUserUuid(String(uuid)); return; }
      }
      setLoading(false); // session unavailable or no UUID — stop the spinner
    }).catch(() => setLoading(false));
  }, []);

  // Fetch ad posts — always live stats from YouTube
  const syncAdPosts = useCallback(async (uid: string, quiet = false) => {
    if (!quiet) setSyncing(true);
    setError('');
    try {
      const res = await api.get<{ success: boolean; data: AdPost[] }>(
        `/api/social/ad-posts?user_uuid=${uid}`,
      );
      if (res.ok) {
        const posts = normaliseArray<AdPost>(res.data?.data);
        setAdPosts(posts);
        setSyncedAt(Date.now());
        setOpenAds(prev => {
          if (prev.size === 0 && posts.length > 0) return new Set([posts[0].id]);
          return prev;
        });
      } else {
        if (!quiet) setError('Failed to fetch ad campaigns.');
      }
    } finally {
      if (!quiet) setSyncing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!userUuid) return;
    setLoading(true);
    syncAdPosts(userUuid).finally(() => setLoading(false));
  }, [userUuid, syncAdPosts]);

  // 30-second auto-sync, paused when tab is hidden
  useEffect(() => {
    if (!userUuid) return;
    syncRef.current = setInterval(() => {
      if (!document.hidden) syncAdPosts(userUuid, true);
    }, SYNC_MS);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [userUuid, syncAdPosts]);

  const toggleAd = (id: number) =>
    setOpenAds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 min-h-full overflow-y-auto px-6 py-8 max-w-4xl w-full mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-(--color-white)">Ad Analytics</h1>
          <p className="text-sm text-(--color-muted) mt-0.5">Videos posted via Yepper — live stats from YouTube.</p>
        </div>
        <button
          onClick={() => { if (userUuid && !syncing) syncAdPosts(userUuid); }}
          disabled={loading || syncing || !userUuid}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-(--color-border) bg-(--color-surface-2) text-xs font-medium text-(--color-white) hover:bg-(--color-surface-3) transition-all disabled:opacity-40"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${syncing || loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-900/40 bg-red-950/30 text-sm text-red-400">
          <ExclamationCircleIcon className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Section header with live dot */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-(--color-white)">Ad Campaigns</h2>
          <p className="text-xs text-(--color-muted) mt-0.5">{adPosts.length} campaign{adPosts.length !== 1 ? 's' : ''} · auto-syncs every 30s</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-(--color-muted)">
          <span className={`w-1.5 h-1.5 rounded-full ${syncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          {syncing ? 'syncing…' : syncedAt ? `synced ${sinceSeconds(syncedAt)}` : '—'}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 rounded-2xl bg-(--color-surface-2) border border-(--color-border) animate-pulse" />
          ))}
        </div>
      ) : adPosts.length === 0 ? (
        <div className="rounded-2xl border border-(--color-border) border-dashed bg-(--color-surface-1) p-14 flex flex-col items-center gap-3 text-center">
          <FilmIcon className="w-8 h-8 text-(--color-muted) opacity-40" />
          <p className="text-sm font-semibold text-(--color-white)">No ad campaigns yet</p>
          <p className="text-xs text-(--color-muted)">Upload your first ad video from a connected channel.</p>
          <Link
            href="/connect-accounts"
            className="mt-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Go to Connected Channels → Post Ad →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {adPosts.map(post => (
            <AdCampaignCard
              key={post.id}
              post={post}
              open={openAds.has(post.id)}
              onToggle={() => toggleAd(post.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
