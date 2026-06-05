'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse, User } from '@/app/_types/auth';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  LockClosedIcon,
  PlusCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { BoltIcon } from '@heroicons/react/24/solid';

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

  const popupRef = useRef<Window | null>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

  const isWebDeveloper = user?.what_they_do === 'Web Developer';
  const socialLocked = isWebDeveloper && !socialUnlocked;

  const formatCount = (n: number | undefined | null): string => {
    if (n === undefined || n === null) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessionRes, socialRes] = await Promise.all([
        api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession),
        api.get<SocialStatsResponse>('/api/social/stats'),
      ]);

      if (sessionRes.ok && sessionRes.data.data?.user) setUser(sessionRes.data.data.user);
      if (socialRes.ok) setAccounts(socialRes.data.data);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleConnect = async (provider: string) => {
    const platform = PLATFORMS.find((p) => p.id === provider);
    if (platform?.comingSoon || socialLocked) return;
    if (accounts.some((a) => a.provider === provider)) {
      document.getElementById(`acc-${provider}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/connect/${provider}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.url) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        popupRef.current = window.open(data.url, 'connect_social', `width=${width},height=${height},left=${left},top=${top}`);
        const checkPopup = setInterval(() => {
          if (!popupRef.current || popupRef.current.closed) {
            clearInterval(checkPopup);
            fetchAll();
          }
        }, 1000);
      }
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
                  <button onClick={() => setDisconnectingProvider(account.provider)} className="text-[10px] font-bold text-red-500/70 hover:text-red-500 uppercase tracking-widest">
                    Disconnect
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4">
                  <div className="p-5 border-r border-(--color-border)">
                    <span className="text-[10px] font-bold text-(--color-muted) uppercase">Engagement</span>
                    <p className="text-xl font-bold text-(--color-white) flex items-center gap-1">
                      {account.analysis.engagement_score}%
                      {parseFloat(account.analysis.engagement_score) > 3 && <BoltIcon className="w-4 h-4 text-emerald-400" />}
                    </p>
                  </div>
                  <div className="p-5 border-r border-(--color-border)">
                    <span className="text-[10px] font-bold text-(--color-muted) uppercase">Est. reach</span>
                    <p className="text-xl font-bold text-(--color-white)">{formatCount(account.analysis.predicted_reach)}</p>
                  </div>
                  <div className="p-5 border-r border-(--color-border)">
                    <span className="text-[10px] font-bold text-(--color-muted) uppercase">Views</span>
                    <p className="text-xl font-bold text-(--color-white)">{formatCount(account.analysis.total_views)}</p>
                  </div>
                  <div className="p-5">
                    <span className="text-[10px] font-bold text-(--color-muted) uppercase">Rank</span>
                    <p className="text-sm font-black uppercase text-blue-400">{account.analysis.recommendation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
