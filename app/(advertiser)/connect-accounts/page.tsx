'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, AUTH_ENDPOINTS, SOCIAL_ENDPOINTS } from '@/app/_lib/api';
import { calculateYouTubePrice, YouTubePricingResult } from '@/app/_lib/pricing/youtubePricing';
import type { AuthResponse, User } from '@/app/_types/auth';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  FilmIcon,
  GlobeAltIcon,
  LockClosedIcon,
  PlusCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface DeepAnalysis {
  engagement_score: string;
  predicted_reach: number;
  predicted_likes: number;
  recommendation: string;
  total_views: number;
  ai_review: string;
  growth_trend: 'up' | 'steady' | 'down';
}

interface SocialAccount {
  provider: 'youtube' | 'instagram' | 'facebook' | 'tiktok';
  username: string;
  followers: number;
  avatar: string;
  analysis: DeepAnalysis;
}

interface SocialStatsResponse {
  success: boolean;
  data: SocialAccount[];
}

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

interface WebsiteHandoffResponse {
  success: boolean;
  data: {
    handoff_token: string;
    handoff_url: string;
    creator: {
      id: string;
      username: string;
      full_name: string;
      email: string;
      website_domain?: string | null;
    };
  };
}

const TIER_BADGE: Record<string, string> = {
  Nano:  'bg-zinc-700/60 text-zinc-300',
  Micro: 'bg-blue-500/20 text-blue-300',
  Mid:   'bg-emerald-500/20 text-emerald-300',
  Macro: 'bg-amber-500/20 text-amber-300',
  Mega:  'bg-yellow-500/20 text-yellow-300',
};

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', color: '#FF0000', comingSoon: false, statLabel: 'Subscribers' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', comingSoon: true, statLabel: 'Followers' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2', comingSoon: true, statLabel: 'Followers' },
  { id: 'tiktok', label: 'TikTok', color: '#25F4EE', comingSoon: true, statLabel: 'Followers' },
] as const;

function PlatformIcon({ id }: { id: string }) {
  if (id === 'youtube') {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55A3.016 3.016 0 0 0 .501 6.186C0 8.07 0 12 0 12s0 3.93.501 5.814a3.016 3.016 0 0 0 2.122 2.136C4.495 20.5 12 20.5 12 20.5s7.505 0 9.376-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (id === 'instagram') {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <path d="M17.5 6.5h.01" />
      </svg>
    );
  }
  if (id === 'facebook') {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.063 24 12.073z" />
      </svg>
    );
  }
  return <span className="text-xs font-black">TT</span>;
}

export default function ConnectAccountsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState('');
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [socialUnlocked, setSocialUnlocked] = useState(false);
  const [youtubePricing, setYoutubePricing] = useState<Record<string, YouTubePricingResult>>({});
  const [youtubeVideos, setYoutubeVideos] = useState<Record<string, any[]>>({});

  // ── Post-Ad modal state ──────────────────────────────────────────────────────
  const [adPostCounts, setAdPostCounts] = useState<Record<string, number>>({});

  // ── Post-Ad modal state ──────────────────────────────────────────────────────
  const [postAdProvider, setPostAdProvider]     = useState<string | null>(null);
  const [adFile, setAdFile]                     = useState<File | null>(null);
  const [adTitle, setAdTitle]                   = useState('');
  const [adDescription, setAdDescription]       = useState('');
  const [adPrivacy, setAdPrivacy]               = useState<'public' | 'unlisted'>('public');
  const [adUploading, setAdUploading]           = useState(false);
  const [adUploadProgress, setAdUploadProgress] = useState(0);
  const [adUploadResult, setAdUploadResult]     = useState<{ trackingCode: string; videoUrl: string | null } | null>(null);
  const [adUploadError, setAdUploadError]       = useState('');


  const popupRef = useRef<Window | null>(null);
  const fileRef  = useRef<HTMLInputElement | null>(null);

  const isWebDeveloper = user?.what_they_do === 'Web Developer';
  const socialLocked = isWebDeveloper && !socialUnlocked;

  const formatCount = (n: number | undefined | null): string => {
    if (n === undefined || n === null) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const estimateViewsPerPost = (account: SocialAccount) => {
    const vids = youtubeVideos[account.username] ?? [];
    if (Array.isArray(vids) && vids.length) {
      const viewsArr = vids.map((v: any) => Number(v.views || 0));
      const avg = viewsArr.reduce((s: number, x: number) => s + x, 0) / viewsArr.length;
      return Math.round(avg);
    }

    const TV = Number(account.analysis?.total_views ?? 0);
    const P = Number((account.analysis as any)?.total_posts ?? 0);
    const S = Number(account.followers ?? 0);

    if (TV && P) return Math.round(TV / Math.max(1, P));
    if (S) return Math.round(S * 0.05); // fallback: 5% of subscribers
    return 0;
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const sessionRes = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);
      if (sessionRes.ok && sessionRes.data.data?.user) {
        const u = sessionRes.data.data.user;
        setUser(u);
        // Refresh YouTube stats from the live API before fetching (updates subscribers, total views, total posts)
        await api.post(`/api/social/refresh/youtube`, {}).catch(() => {});
        const socialRes = await api.get<SocialStatsResponse>(`/api/social/stats?user_uuid=${u.id ?? (u as any).user_uuid}`);
        if (socialRes.ok) setAccounts(socialRes.data.data ?? []);

        // Fetch ad post counts per provider
        const adsRes = await api.get<{ success: boolean; data: AdPost[] }>(
          `/api/social/ad-posts?user_uuid=${u.id ?? (u as any).user_uuid}`,
        ).catch(() => null);
        if (adsRes?.ok) {
          const counts: Record<string, number> = {};
          for (const p of (adsRes.data?.data ?? [])) {
            counts[p.provider] = (counts[p.provider] ?? 0) + 1;
          }
          setAdPostCounts(counts);
        }
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openPostAdModal = (provider: string) => {
    setPostAdProvider(provider);
    setAdFile(null);
    setAdTitle('');
    setAdDescription('');
    setAdPrivacy('public');
    setAdUploading(false);
    setAdUploadProgress(0);
    setAdUploadResult(null);
    setAdUploadError('');
  };

  const closePostAdModal = () => {
    if (adUploading) return;
    setPostAdProvider(null);
  };

  const handlePostAd = async () => {
    if (!adFile || !postAdProvider || adUploading) return;
    setAdUploading(true);
    setAdUploadProgress(0);
    setAdUploadError('');
    setAdUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('video',       adFile);
      formData.append('title',       adTitle.trim() || adFile.name.replace(/\.[^.]+$/, ''));
      formData.append('description', adDescription.trim());
      formData.append('privacy',     adPrivacy);

      // Use XMLHttpRequest so we can track upload progress
      const result = await new Promise<{ success: boolean; data?: any; message?: string; code?: string }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setAdUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { resolve({ success: false, message: 'Invalid response' }); }
        };
        xhr.onerror = () => resolve({ success: false, message: 'Network error' });
        xhr.open('POST', `/api/social/post-ad/${postAdProvider}`);
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      if (!result.success) {
        if (result.code === 'reconnect_required') {
          setAdUploadError('YouTube upload not authorized. Please disconnect and reconnect your YouTube account to grant upload permissions.');
        } else {
          setAdUploadError(result.message || 'Upload failed');
        }
      } else {
        setAdUploadResult({ trackingCode: result.data?.trackingCode, videoUrl: result.data?.videoUrl });
        fetchAll();
      }
    } catch {
      setAdUploadError('Upload failed unexpectedly');
    } finally {
      setAdUploading(false);
    }
  };

  // Fetch video stats for YouTube accounts and compute pricing
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      const ytAccounts = accounts.filter(a => a.provider === 'youtube');
      if (!ytAccounts.length) return;

      for (const acc of ytAccounts) {
        try {
          // Use the creator's integer ID — the backend queries social_video_stats.creator_id (INTEGER)
          const identifier = user.id ?? (user as any).user_uuid;
          const res = await api.get(SOCIAL_ENDPOINTS.videoStats('youtube', identifier));
          if (!res.ok) continue;
          const videos = Array.isArray(res.data?.data) ? res.data.data : [];
          setYoutubeVideos(prev => ({ ...prev, [acc.username]: videos }));
          const viewsArr = videos.map((v: any) => Number(v.views || 0));
          const TV = Number(acc.analysis?.total_views ?? 0);
          const P  = Number((acc.analysis as any)?.total_posts ?? 0);
          const MV = viewsArr.length
            ? viewsArr.reduce((s: number, x: number) => s + x, 0) / viewsArr.length
            : (TV && P ? TV / Math.max(1, P) : 0);
          const S = Number(acc.followers || 0);
          const pricing = calculateYouTubePrice(S, TV, MV, viewsArr);
          setYoutubePricing(prev => ({ ...prev, [acc.username]: pricing }));
        } catch (err) {
          console.error('Failed to compute YouTube pricing for', acc.username, err);
        }
      }
    };
    run();
  }, [accounts, user]);

  const handleConnect = async (provider: string) => {
    const platform = PLATFORMS.find((p) => p.id === provider);
    if (platform?.comingSoon || socialLocked) return;
    if (accounts.some((a) => a.provider === provider)) {
      document.getElementById(`acc-${provider}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // user.id is the creator's integer ID (always present in the session response)
    const creatorId = user?.id;
    if (!creatorId) { setError('Session missing. Please refresh and try again.'); return; }

    try {
      const connectUrl = `/api/proxy/connect/${provider}?user_uuid=${creatorId}`;
      const res = await fetch(connectUrl, { credentials: 'include' });
      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text();
        console.error('Expected JSON from connect endpoint but received:', text);
        setError(`Failed to initiate ${provider} connection.`);
        return;
      }

      if (!data.success || !data.url) {
        setError(data.message || `Failed to initiate ${provider} connection.`);
        return;
      }

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top  = window.screenY + (window.outerHeight - height) / 2;
      popupRef.current = window.open(data.url, 'connect_social', `width=${width},height=${height},left=${left},top=${top}`);

      // Listen for the oauth-callback page to postMessage us the result
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type !== 'oauth_callback') return;
        window.removeEventListener('message', onMessage);
        clearInterval(checkPopup);
        if (e.data.error) {
          const msgs: Record<string, string> = {
            config_missing:  'YouTube connection is not configured on this server.',
            token_error:     'Google denied the connection — please try again.',
            channel_missing: 'No YouTube channel found on your Google account.',
            server_error:    'A server error occurred. Please try again later.',
          };
          setError(msgs[e.data.error] || `Connection failed: ${e.data.error}`);
        } else {
          fetchAll();
        }
      };
      window.addEventListener('message', onMessage);

      // Fallback: if popup closes without postMessage (user closed it manually)
      const checkPopup = setInterval(() => {
        if (!popupRef.current || popupRef.current.closed) {
          clearInterval(checkPopup);
          window.removeEventListener('message', onMessage);
          fetchAll();
        }
      }, 1000);
    } catch {
      setError(`Failed to initiate ${provider} connection.`);
    }
  };

  // Website handoff feature removed — only social connections are supported.

  const handleDisconnectExecute = async () => {
    if (confirmText.toLowerCase() !== 'disconnect' || !disconnectingProvider) return;
    setLoading(true);
    try {
      const res = await api.post(`/api/social/disconnect/${disconnectingProvider}`, {});
      if (res.ok) {
        setDisconnectingProvider(null);
        setConfirmText('');
        fetchAll();
      } else {
        setError('Failed to disconnect account.');
      }
    } catch {
      setError('Network error during disconnection.');
    } finally {
      setLoading(false);
    }
  };

  const SocialPanel = (
    <section className={`bg-(--color-surface-1) border border-(--color-border) rounded-2xl p-6 ${socialLocked ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between gap-4 border-b border-(--color-border) pb-4 mb-4">
        <div>
          <h2 className="text-sm font-bold text-(--color-white)">Social Media</h2>
          <p className="text-xs text-(--color-muted) mt-1">Connect available platforms for promotion analytics.</p>
        </div>
        {socialLocked && (
          <button
            onClick={() => setSocialUnlocked(true)}
            className="shrink-0 px-3 py-2 rounded-lg bg-(--color-white) text-black text-xs font-bold"
          >
            Unlock social media
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLATFORMS.map((platform) => {
          const connected = accounts.some((account) => account.provider === platform.id);
          const disabled = loading || platform.comingSoon || socialLocked;
          return (
            <button
              key={platform.id}
              onClick={() => handleConnect(platform.id)}
              disabled={disabled}
              className={`relative flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                connected
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-(--color-surface-2) border-(--color-border) hover:bg-(--color-surface-3)'
              } disabled:cursor-not-allowed`}
            >
              <div className="w-10 h-10 rounded-full bg-(--color-surface-3) border border-(--color-border) flex items-center justify-center" style={{ color: connected ? '#10B981' : platform.color }}>
                {connected ? <CheckCircleIcon className="w-6 h-6" /> : socialLocked ? <LockClosedIcon className="w-5 h-5" /> : <PlatformIcon id={platform.id} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-bold ${connected ? 'text-emerald-400' : 'text-(--color-white)'}`}>{platform.label}</p>
                  {platform.comingSoon && <span className="rounded bg-(--color-surface-3) px-1.5 py-0.5 text-[9px] font-bold uppercase text-(--color-muted)">Coming soon</span>}
                </div>
                <p className="text-[11px] text-(--color-muted)">
                  {connected ? 'View analysis' : platform.comingSoon ? 'API not available for now' : socialLocked ? 'Locked for web developer flow' : `Connect ${platform.label}`}
                </p>
              </div>
              {!connected && !platform.comingSoon && !socialLocked && <PlusCircleIcon className="w-5 h-5 text-(--color-muted)" />}
            </button>
          );
        })}
      </div>
    </section>
  );

  // WebsitePanel removed — only social connections are displayed below.

  return (
    <div className="relative flex-1 max-w-6xl mx-auto px-6 py-10">
      {disconnectingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-(--color-white)">Confirm Disconnect</h3>
              <button onClick={() => setDisconnectingProvider(null)} className="p-1 rounded-full hover:bg-(--color-surface-2)">
                <XMarkIcon className="w-6 h-6 text-(--color-muted)" />
              </button>
            </div>
            <p className="text-sm text-red-400 leading-relaxed">
              Type disconnect to remove {disconnectingProvider.toUpperCase()} from your Yepper profile.
            </p>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="disconnect"
              className="mt-4 w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-3 text-sm text-(--color-white) outline-none"
            />
            <button
              onClick={handleDisconnectExecute}
              disabled={confirmText.toLowerCase() !== 'disconnect' || loading}
              className="mt-4 w-full py-3 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
            >
              Confirm Disconnect
            </button>
          </div>
        </div>
      )}

      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-(--color-white)">Connected Channels</h1>
          <p className="text-sm text-(--color-muted) mt-1">Connect social accounts to view analytics and insights.</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white) disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {SocialPanel}

        <section className="space-y-4">
          {accounts.length === 0 && !loading && (
            <div className="bg-(--color-surface-1) border border-(--color-border) border-dashed rounded-2xl p-12 flex flex-col items-center text-center">
              <GlobeAltIcon className="w-12 h-12 text-(--color-muted) mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-(--color-white)">No Active Analysis</h3>
              <p className="text-xs text-(--color-muted) max-w-sm mt-2">Connect social accounts (e.g. YouTube) to unlock Yepper intelligence.</p>
            </div>
          )}

          {accounts.map((account) => {
            const platform = PLATFORMS.find((item) => item.id === account.provider);
            if (!platform) return null;
            const ytPricing = account.provider === 'youtube' ? (youtubePricing[account.username] ?? null) : null;

            return (
              <div key={account.provider} id={`acc-${account.provider}`} className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b border-(--color-border)">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-(--color-surface-2) border border-(--color-border) flex items-center justify-center" style={{ color: platform.color }}>
                      <PlatformIcon id={platform.id} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-(--color-white)">@{account.username}</h3>
                      <p className="text-xs text-(--color-muted)">
                        {platform.statLabel}: <span className="text-(--color-white) font-bold">{formatCount(account.followers)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openPostAdModal(account.provider)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-surface-3) border border-(--color-border) text-xs font-bold text-(--color-white) hover:bg-(--color-surface-2) transition-colors"
                    >
                      <CloudArrowUpIcon className="w-3.5 h-3.5" />
                      Post Ad
                    </button>
                    <button onClick={() => setDisconnectingProvider(account.provider)} className="text-[10px] font-bold text-red-500/70 hover:text-red-500 uppercase tracking-widest">
                      Disconnect
                    </button>
                  </div>
                </div>
                {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-(--color-border)">
                <div className="p-5 border-r border-(--color-border)">
                  <span className="text-[10px] font-bold text-(--color-muted) uppercase">Subscribers</span>
                  <p className="text-xl font-bold text-(--color-white)">{formatCount(account.followers)}</p>
                </div>
                <div className="p-5 border-r border-(--color-border)">
                  <span className="text-[10px] font-bold text-(--color-muted) uppercase">Total Views</span>
                  <p className="text-xl font-bold text-(--color-white)">{formatCount(account.analysis?.total_views)}</p>
                </div>
                <div className="p-5 border-r border-(--color-border)">
                  <span className="text-[10px] font-bold text-(--color-muted) uppercase">Total Posts</span>
                  <p className="text-xl font-bold text-(--color-white)">{formatCount((account.analysis as any)?.total_posts ?? 0)}</p>
                </div>
                <div className="p-5 border-r border-(--color-border)">
                  <span className="text-[10px] font-bold text-(--color-muted) uppercase">Est. Views/Post</span>
                  <p className="text-xl font-bold text-(--color-white)">{formatCount(estimateViewsPerPost(account))}</p>
                </div>
                <div className="p-5">
                  <span className="text-[10px] font-bold text-(--color-muted) uppercase">Yepper Ads</span>
                  <p className="text-xl font-bold text-emerald-400">{adPostCounts[account.provider] ?? 0}</p>
                </div>
              </div>

              {/* Views calculation + tier pricing */}
              {account.provider === 'youtube' && (
                <div className="p-5 space-y-3">
                  {/* Views-per-video formula */}
                  <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-4">
                    <p className="text-[10px] font-bold text-(--color-muted) uppercase tracking-wide mb-2">Estimated Views Calculation</p>
                    <div className="text-xs text-(--color-muted) space-y-1 font-mono">
                      <div>Total Views (TV) = <span className="text-(--color-white) font-bold">{formatCount(account.analysis?.total_views)}</span></div>
                      <div>Total Posts (P)  = <span className="text-(--color-white) font-bold">{formatCount((account.analysis as any)?.total_posts ?? 0)}</span></div>
                      <div className="pt-1 border-t border-(--color-border) text-[11px]">
                        Est. Views/Video = TV ÷ P = <span className="text-emerald-400 font-bold">{formatCount(estimateViewsPerPost(account))}</span>
                        {!(account.analysis?.total_views) || !((account.analysis as any)?.total_posts)
                          ? <span className="text-amber-400 ml-1">(fallback: subscribers × 5%)</span>
                          : null}
                      </div>
                    </div>
                  </div>

                  {/* Tier pricing table */}
                  {ytPricing && (
                    <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-(--color-border)">
                        <div>
                          <p className="text-[10px] font-bold text-(--color-muted) uppercase tracking-wide">Ad Pricing</p>
                          <p className="text-[11px] text-(--color-muted) mt-0.5">
                            ~{formatCount(ytPricing.estimatedViewsPerVideo)} est. views/video
                          </p>
                        </div>
                        {ytPricing.tier ? (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${TIER_BADGE[ytPricing.tier]}`}>
                            {ytPricing.tier}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-(--color-surface-3) text-(--color-muted)">
                            {ytPricing.eligible ? 'Below 1K views/video' : 'Need ≥1K subscribers'}
                          </span>
                        )}
                      </div>

                      {ytPricing.rows.length > 0 ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-(--color-border)">
                                  <th className="px-4 py-2 text-left text-[10px] font-bold text-(--color-muted) uppercase">Duration</th>
                                  <th className="px-4 py-2 text-right text-[10px] font-bold text-red-400 uppercase">Video Ad</th>
                                  <th className="px-4 py-2 text-right text-[10px] font-bold text-sky-400 uppercase">Audio Ad</th>
                                  <th className="px-4 py-2 text-right text-[10px] font-bold text-emerald-400 uppercase">Mention</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ytPricing.rows.map(row => (
                                  <tr key={row.duration} className="border-b border-(--color-border) last:border-0">
                                    <td className="px-4 py-2.5 font-mono text-[11px] text-(--color-muted)">{row.duration}</td>
                                    <td className="px-4 py-2.5 text-right font-bold text-(--color-white)">{row.video_ad.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 text-right font-bold text-(--color-white)">{row.audio_ad.toLocaleString()}</td>
                                    <td className="px-4 py-2.5 text-right font-bold text-(--color-white)">{row.mention.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="px-4 py-2 text-[10px] text-(--color-muted) border-t border-(--color-border)">
                            Creator earns 70% · Yepper takes 30% · All prices in RWF
                          </p>
                        </>
                      ) : (
                        <p className="px-4 py-4 text-[11px] text-(--color-muted) text-center">
                          {ytPricing.eligible
                            ? 'Estimated views per video below 1,000 — grow your audience to unlock pricing.'
                            : 'Channel needs ≥1,000 subscribers to unlock ad pricing.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </section>
      </div>

      {/* ── Post Ad Modal ── */}
      {postAdProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-lg p-6">

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-(--color-white)">Post Ad — {postAdProvider.charAt(0).toUpperCase() + postAdProvider.slice(1)}</h3>
                <p className="text-xs text-(--color-muted) mt-0.5">A unique tracking code will be added to your video description automatically.</p>
              </div>
              <button onClick={closePostAdModal} disabled={adUploading} className="p-1 rounded-full hover:bg-(--color-surface-2) disabled:opacity-40">
                <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
              </button>
            </div>

            {adUploadResult ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                  <CheckCircleIcon className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-emerald-400">Video posted successfully!</p>
                  <p className="text-xs text-(--color-muted) mt-1">Tracking code embedded in description</p>
                  <p className="text-base font-mono font-bold text-(--color-white) mt-2">{adUploadResult.trackingCode}</p>
                </div>
                {adUploadResult.videoUrl && (
                  <a href={adUploadResult.videoUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-medium text-blue-400 hover:underline">
                    View on YouTube →
                  </a>
                )}
                <button onClick={closePostAdModal} className="w-full py-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-medium text-(--color-white)">
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File picker */}
                <div>
                  <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Video File *</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => setAdFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={adUploading}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-2) hover:bg-(--color-surface-3) transition-colors text-sm text-(--color-muted) disabled:opacity-50"
                  >
                    <FilmIcon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{adFile ? adFile.name : 'Choose video file…'}</span>
                    {adFile && <span className="ml-auto shrink-0 text-[10px] text-(--color-muted)">{(adFile.size / 1024 / 1024).toFixed(1)} MB</span>}
                  </button>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Title</label>
                  <input
                    value={adTitle}
                    onChange={(e) => setAdTitle(e.target.value)}
                    placeholder="Enter video title…"
                    disabled={adUploading}
                    className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 disabled:opacity-50"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Description / Caption</label>
                  <textarea
                    value={adDescription}
                    onChange={(e) => setAdDescription(e.target.value)}
                    placeholder="Add a description, mentions, hashtags…"
                    rows={3}
                    disabled={adUploading}
                    className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 resize-none disabled:opacity-50"
                  />
                  <p className="text-[10px] text-(--color-muted) mt-1">A tracking code (e.g. <span className="font-mono text-emerald-400">#YPR-YT-001</span>) will be appended automatically.</p>
                </div>

                {/* Privacy */}
                <div>
                  <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Privacy</label>
                  <div className="flex gap-2">
                    {(['public', 'unlisted'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setAdPrivacy(p)}
                        disabled={adUploading}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${adPrivacy === p ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-2) text-(--color-muted) border-(--color-border) hover:text-(--color-white)'} disabled:opacity-50`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {adUploadError && (
                  <p className="text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{adUploadError}</p>
                )}

                {/* Progress bar */}
                {adUploading && (
                  <div>
                    <div className="flex justify-between text-xs text-(--color-muted) mb-1">
                      <span>Uploading to YouTube…</span>
                      <span>{adUploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-(--color-surface-2) overflow-hidden">
                      <div className="h-full rounded-full bg-red-500 transition-all duration-300" style={{ width: `${adUploadProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button onClick={closePostAdModal} disabled={adUploading} className="flex-1 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white) disabled:opacity-40">
                    Cancel
                  </button>
                  <button
                    onClick={handlePostAd}
                    disabled={!adFile || adUploading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
                  >
                    <CloudArrowUpIcon className="w-4 h-4" />
                    {adUploading ? 'Uploading…' : 'Upload & Post'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
