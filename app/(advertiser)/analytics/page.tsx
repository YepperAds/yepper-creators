'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, AUTH_ENDPOINTS, SOCIAL_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';
import Link from 'next/link';
import {
  ArrowPathIcon,
  EyeIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  UsersIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SocialAccount {
  provider: 'youtube' | 'instagram' | 'facebook';
  handle: string;
  followers: number;
  avatar: string;
}

interface SocialStatsResponse {
  success: boolean;
  data: SocialAccount[];
}

interface VideoStat {
  title: string;
  thumbnail?: string;
  views: number;
  likes: number;
  comments: number;
  url?: string;
}

interface VideoStatsResponse {
  success: boolean;
  data: VideoStat[];
}

interface InsightDay {
  date: string;       // "YYYY-MM-DD"
  views?: number;
  likes?: number;
  followers?: number;
  impressions?: number;
  reach?: number;
}

interface InsightsResponse {
  success: boolean;
  data: InsightDay[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform config
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_META = {
  youtube:   { label: 'YouTube',   color: '#FF0000', statLabel: 'Subscribers' },
  instagram: { label: 'Instagram', color: '#E1306C', statLabel: 'Followers'   },
  facebook:  { label: 'Facebook',  color: '#1877F2', statLabel: 'Followers'   },
} as const;

type Provider = keyof typeof PLATFORM_META;

const PROVIDER_ICONS: Record<Provider, React.ReactNode> = {
  youtube: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.498 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  instagram: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  ),
  facebook: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function normaliseArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') return Object.values(raw) as T[];
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini sparkline SVG built from InsightDay data
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ data, color, field }: { data: InsightDay[]; color: string; field: 'views' | 'likes' | 'followers' | 'reach' }) {
  if (data.length < 2) return <div className="h-16 flex items-center justify-center text-xs text-(--color-muted)">No chart data</div>;

  const values = data.map(d => d[field] ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const W = 280, H = 64;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / (max - min || 1)) * (H - 8) - 4;
    return `${x},${y}`;
  }).join(' ');

  const firstPt = points.split(' ')[0];
  const lastPt = points.split(' ').at(-1)!;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${field}-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <polygon
        points={`0,${H} ${points} ${W},${H}`}
        fill={`url(#grad-${field}-${color.replace('#','')})`}
      />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Start / end dots */}
      {[firstPt, lastPt].map((pt, i) => {
        const [x, y] = pt.split(',').map(Number);
        return <circle key={`dot-${i}`} cx={x} cy={y} r="2.5" fill={color} />;
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-account analytics panel
// ─────────────────────────────────────────────────────────────────────────────

function AccountAnalyticsPanel({ account, userUuid }: { account: SocialAccount; userUuid: string }) {
  // Normalise provider to lowercase key so backend casing differences don't crash
  const providerKey = (account.provider ?? '').toLowerCase() as Provider;
  const meta = PLATFORM_META[providerKey];
  const icon = PROVIDER_ICONS[providerKey];
  const hasInsights = providerKey === 'youtube' || providerKey === 'instagram';

  // ── All hooks MUST come before any conditional return (Rules of Hooks) ───
  const [posts, setPosts] = useState<VideoStat[]>([]);
  const [insights, setInsights] = useState<InsightDay[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [activeChart, setActiveChart] = useState<'views' | 'likes' | 'followers' | 'reach'>('views');

  useEffect(() => {
    if (!meta) return; // guard inside effect — safe, not a hook call
    // Fetch recent posts
    api.get<VideoStatsResponse>(SOCIAL_ENDPOINTS.videoStats(providerKey, userUuid)).then(res => {
      setLoadingPosts(false);
      if (res.ok) setPosts(normaliseArray<VideoStat>(res.data?.data));
    });
    // Fetch 28-day insights (where available)
    if (hasInsights) {
      api.get<InsightsResponse>(SOCIAL_ENDPOINTS.insights(providerKey, userUuid)).then(res => {
        setLoadingInsights(false);
        if (res.ok) setInsights(normaliseArray<InsightDay>(res.data?.data));
      });
    } else {
        setTimeout(() => setLoadingInsights(false), 0);
    }
  }, [providerKey, userUuid, hasInsights, meta]);

  // Unknown provider — skip rendering gracefully (hooks already called above)
  if (!meta) return null;

  // Aggregate totals from posts
  const totalViews    = posts.reduce((s, p) => s + (p.views    ?? 0), 0);
  const totalLikes    = posts.reduce((s, p) => s + (p.likes    ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments ?? 0), 0);

  const CHART_TABS = [
    { key: 'views' as const,     label: 'Views'     },
    { key: 'likes' as const,     label: 'Likes'     },
    { key: 'followers' as const, label: 'Followers' },
    { key: 'reach' as const,     label: 'Reach'     },
  ];

  return (
    <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-2) overflow-hidden">

      {/* ── Account header ── */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-(--color-border)">
        <div className="relative shrink-0">
          {account.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={account.avatar} alt={account.handle} className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: meta.color }} />
            : <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-(--color-surface-3) font-bold text-lg" style={{ borderColor: meta.color, color: meta.color }}>{account.handle[0].toUpperCase()}</div>
          }
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-(--color-surface-2)" style={{ backgroundColor: meta.color, color: '#fff' }}>
            <span className="scale-[0.65]">{icon}</span>
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-(--color-white) truncate">@{account.handle}</p>
          <p className="text-xs text-(--color-muted) mt-0.5" style={{ color: meta.color }}>{meta.label}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-(--color-muted)">
          <UsersIcon className="w-3.5 h-3.5" />
          <span className="font-semibold text-(--color-white)">{fmt(account.followers)}</span>
          {meta.statLabel}
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Stat pills ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <EyeIcon className="w-4 h-4" />,              label: 'Total Views',    val: totalViews    },
            { icon: <HeartIcon className="w-4 h-4" />,            label: 'Total Likes',    val: totalLikes    },
            { icon: <ChatBubbleLeftIcon className="w-4 h-4" />,   label: 'Total Comments', val: totalComments },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-(--color-surface-3) px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-(--color-muted) text-xs">{s.icon}{s.label}</div>
              {loadingPosts
                ? <div className="h-5 w-12 rounded bg-(--color-border) animate-pulse" />
                : <p className="text-lg font-bold text-(--color-white)">{fmt(s.val)}</p>}
            </div>
          ))}
        </div>

        {/* ── 28-day chart ── */}
        {hasInsights && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-(--color-muted) uppercase tracking-wider">28-day insights</p>
              <div className="flex gap-1">
                {CHART_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveChart(t.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeChart === t.key ? 'text-white' : 'text-(--color-muted) hover:text-(--color-white)'}`}
                    style={activeChart === t.key ? { backgroundColor: meta.color } : {}}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingInsights
              ? <div className="h-16 rounded-xl bg-(--color-surface-3) animate-pulse" />
              : insights.length > 0
                ? <Sparkline data={insights} color={meta.color} field={activeChart} />
                : <p className="text-xs text-(--color-muted) text-center py-4">No insight data available for this period.</p>
            }

            {/* X-axis labels */}
            {!loadingInsights && insights.length > 0 && (
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-(--color-muted)">{insights[0]?.date}</span>
                <span className="text-[10px] text-(--color-muted)">{insights.at(-1)?.date}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Recent posts ── */}
        <div>
          <p className="text-xs font-semibold text-(--color-muted) uppercase tracking-wider mb-3">Recent posts</p>
          {loadingPosts
            ? <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-(--color-surface-3) animate-pulse" />)}</div>
            : posts.length === 0
              ? <p className="text-xs text-(--color-muted) text-center py-3">No recent posts found.</p>
              : (
                <div className="space-y-2">
                  {posts.map((post, i) => (
                    <a key={i} href={post.url ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-(--color-surface-3) hover:bg-(--color-surface-1) transition-colors group">
                      {post.thumbnail
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={post.thumbnail} alt={post.title} className="w-12 h-9 object-cover rounded-lg shrink-0" />
                        : <div className="w-12 h-9 rounded-lg bg-(--color-border) shrink-0 flex items-center justify-center opacity-40"><span className="scale-75 opacity-60">{icon}</span></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-(--color-white) truncate group-hover:opacity-80 transition-opacity">{post.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-(--color-muted)"><EyeIcon className="w-3 h-3" />{fmt(post.views)}</span>
                          <span className="flex items-center gap-1 text-xs text-(--color-muted)"><HeartIcon className="w-3 h-3" />{fmt(post.likes)}</span>
                          <span className="flex items-center gap-1 text-xs text-(--color-muted)"><ChatBubbleLeftIcon className="w-3 h-3" />{fmt(post.comments)}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )
          }
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Analytics Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [userUuid, setUserUuid] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Resolve UUID from session
  useEffect(() => {
    api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession).then(res => {
      if (res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = (res.data as any)?.data?.user ?? (res.data as any)?.user;
        const uuid = u?.user_uuid ?? u?.uuid ?? u?.id;
        if (uuid) setUserUuid(String(uuid));
      }
    });
  }, []);

  // Fetch connected accounts once UUID is ready
  const fetchAccounts = useCallback(async () => {
    if (!userUuid) return;
    setLoading(true);
    setError('');
    const res = await api.get<{ success: boolean; data: SocialAccount[] }>(
      SOCIAL_ENDPOINTS.stats(userUuid)
    );
    setLoading(false);
    if (res.ok) {
      const arr = normaliseArray<SocialAccount>(res.data?.data);
      console.log('[Analytics] raw accounts from backend:', JSON.stringify(arr));
      setAccounts(arr);
    } else {
      setError('Failed to load connected accounts.');
    }
  }, [userUuid]);

  useEffect(() => {
    setTimeout(() => fetchAccounts(), 0);
  }, [fetchAccounts]);

  return (
    <div className="flex-1 min-h-full overflow-y-auto px-6 py-8 max-w-5xl w-full mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-(--color-white)">Analytics</h1>
          <p className="text-sm text-(--color-muted) mt-1">
            28-day insights and recent post performance across all connected platforms.
          </p>
        </div>
        <button
          onClick={fetchAccounts}
          disabled={loading || !userUuid}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-(--color-border) bg-(--color-surface-2) text-xs font-medium text-(--color-white) opacity-70 hover:opacity-100 hover:bg-(--color-surface-3) transition-all disabled:pointer-events-none"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl border border-red-900/40 bg-red-950/30 text-sm text-red-400">
          <ExclamationCircleIcon className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {loading && (
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-(--color-border) bg-(--color-surface-2) p-5 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-(--color-surface-3)" />
                <div className="space-y-2">
                  <div className="h-3 w-28 rounded bg-(--color-surface-3)" />
                  <div className="h-2 w-16 rounded bg-(--color-surface-3)" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(j => <div key={j} className="h-16 rounded-xl bg-(--color-surface-3)" />)}
              </div>
              <div className="h-16 rounded-xl bg-(--color-surface-3)" />
            </div>
          ))}
        </div>
      )}

      {/* ── No accounts ── */}
      {!loading && accounts.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <p className="text-sm text-(--color-muted)">No connected accounts found.</p>
          <Link href="/connect-accounts" className="text-xs font-medium text-(--color-subtle) hover:underline">
            Connect your social media accounts →
          </Link>
        </div>
      )}

      {/* ── Account panels ── */}
      {!loading && userUuid && accounts.length > 0 && (
        <div className="space-y-6">
          {accounts.map((account, i) => (
            <AccountAnalyticsPanel
              key={`${(account.provider ?? '').toLowerCase() || i}`}
              account={account}
              userUuid={userUuid}
            />
          ))}
        </div>
      )}

    </div>
  );
}
