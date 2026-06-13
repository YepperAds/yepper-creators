'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { UsernameCheckResponse } from '@/app/_types/auth';

// ─── Campaign mosaic ──────────────────────────────────────────────────────────

type MediaType = 'image' | 'gif' | 'video';

const BASE: { src: string; alt: string; type: MediaType }[] = [
  { src: '/campaigns/images/ad-1.png', alt: 'Campaign 1', type: 'image' },
  { src: '/campaigns/images/ad-2.png', alt: 'Campaign 2', type: 'image' },
  { src: '/campaigns/images/ad-3.gif', alt: 'Campaign 3', type: 'gif' },
  { src: '/campaigns/images/ad-4.png', alt: 'Campaign 4', type: 'image' },
  { src: '/campaigns/images/ad-5.png', alt: 'Campaign 5', type: 'image' },
  { src: '/campaigns/images/ad-6.png', alt: 'Campaign 6', type: 'image' },
  { src: '/campaigns/videos/ad-7.mp4', alt: 'Campaign 7', type: 'video' },
  { src: '/campaigns/videos/ad-8.mp4', alt: 'Campaign 8', type: 'video' },
];
const CAMPAIGNS = [
  ...BASE.map((c, i) => ({ ...c, id: i + 1 })),
  ...BASE.map((c, i) => ({ ...c, id: i + 9 })),
];

function CampaignTile({ src, alt, type }: { src: string; alt: string; type: MediaType }) {
  return (
    <div className="relative w-full flex-shrink-0 overflow-hidden rounded-[5px] bg-[#111]" style={{ aspectRatio: '4/3' }}>
      {type === 'video' ? (
        <video src={src} autoPlay muted loop playsInline className="w-full h-full object-cover" />
      ) : type === 'gif' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <Image src={src} alt={alt} fill sizes="12vw" className="object-cover" />
      )}
    </div>
  );
}

function ScrollColumn({ items, speed, offsetTop = 0 }: { items: typeof CAMPAIGNS; speed: number; offsetTop?: number }) {
  const doubled = [...items, ...items];
  return (
    <div className="flex-1 overflow-hidden">
      <div style={{ marginTop: `-${offsetTop}px`, animation: `scroll-up ${speed}s linear infinite` }}>
        <div className="flex flex-col gap-2">
          {doubled.map((c, i) => <CampaignTile key={`${c.id}-${i}`} src={c.src} alt={c.alt} type={c.type} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Role options (2 only) ────────────────────────────────────────────────────

const ROLES = [
  {
    value: 'Content Creator',
    label: 'Content Creator',
    description: 'YouTubers, influencers, and social media creators monetizing their audience.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
      </svg>
    ),
  },
  {
    value: 'Web Developer',
    label: 'Web Developer',
    description: 'Website owners and developers who earn revenue by hosting ads on their sites.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
] as const;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function UsernameIndicator({ status, reason }: { status: UsernameStatus; reason: string }) {
  if (status === 'idle') return null;
  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin inline-block" />
        Checking…
      </span>
    );
  }
  if (status === 'available') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Username is available
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-rose-400">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      {reason}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChooseRolePage() {
  const router = useRouter();
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

  const [loading, setLoading]           = useState(true);
  const [user, setUser]                 = useState<{ fullname?: string; name?: string; email?: string; avatar?: string } | null>(null);
  const [username, setUsername]         = useState('');
  const [role, setRole]                 = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameReason, setUsernameReason] = useState('');
  const [error, setError]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [done, setDone]                 = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res  = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        const u    = json?.data?.user;

        if (!u) { router.replace('/login'); return; }

        // Already fully onboarded → skip to explore
        if (u.username && (u.what_they_do || u.whatTheyDo)) {
          router.replace('/explore');
          return;
        }

        setUser(u);
        if (u.username) setUsername(u.username);
      } catch {
        router.replace('/login');
        return;
      }
      setLoading(false);
    }
    loadSession();
  }, [router]);

  useEffect(() => {
    if (!loading) setTimeout(() => usernameRef.current?.focus(), 80);
  }, [loading]);

  const checkUsername = useCallback(async (value: string) => {
    const raw = value.trim().toLowerCase();
    if (!raw) { setUsernameStatus('idle'); setUsernameReason(''); return; }
    setUsernameStatus('checking');
    try {
      const res  = await fetch(`${apiBaseUrl}/auth/creator/check-username?username=${encodeURIComponent(raw)}`);
      const data: UsernameCheckResponse = await res.json();
      setUsernameStatus(data.available ? 'available' : 'taken');
      setUsernameReason(data.reason);
    } catch {
      setUsernameStatus('idle');
    }
  }, [apiBaseUrl]);

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^a-z0-9_.]/gi, '').toLowerCase();
    setUsername(val);
    setError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkUsername(val), 450);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!username.trim())                                    { setError('Please enter a username.'); return; }
    if (usernameStatus === 'checking')                       { setError('Please wait while we check your username.'); return; }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') { setError(usernameReason || 'Username not available.'); return; }
    if (!role)                                               { setError('Please select what best describes you.'); return; }

    setSaving(true);
    try {
      const res  = await fetch('/api/auth/complete-profile', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ username: username.trim().toLowerCase(), what_they_do: role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.message ?? 'Could not complete setup. Please try again.');
        setSaving(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.replace('/explore'), 900);
    } catch {
      setError('Network error. Please check your connection.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const colA = CAMPAIGNS.filter((_, i) => i % 3 === 0);
  const colB = CAMPAIGNS.filter((_, i) => i % 3 === 1);
  const colC = CAMPAIGNS.filter((_, i) => i % 3 === 2);
  const displayName = user?.fullname || user?.name || '';

  return (
    <div className="h-screen overflow-hidden flex bg-black dark">

      {/* ── Left: form panel ── */}
      <div className="relative flex flex-col w-full lg:w-[65%] h-screen overflow-y-auto">

        <div className="absolute top-8 left-8 xl:left-12 z-10 w-32">
          <Image src="/logos/yepper-logo.png" alt="Yepper" width={120} height={32} className="h-10 w-auto object-contain" priority />
        </div>

        <div className="flex flex-1 items-center justify-center px-8 py-24">
          <div className="w-full max-w-[400px]">

            {done ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Welcome to Yepper{username ? `, @${username}` : ''}!</h2>
                  <p className="mt-1.5 text-sm text-zinc-400">Setting up your workspace…</p>
                </div>
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin mt-1" />
              </div>
            ) : (
              <>
                {user?.avatar ? (
                  <div className="mb-6 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={user.avatar} alt={displayName} className="w-10 h-10 rounded-full border border-zinc-700 object-cover" />
                    <div>
                      <p className="text-sm font-medium text-white leading-tight">{displayName}</p>
                      <p className="text-xs text-zinc-500 leading-tight">{user.email}</p>
                    </div>
                  </div>
                ) : null}

                <div className="mb-7">
                  <h1 className="text-2xl font-bold text-white">Set up your profile</h1>
                  <p className="mt-2 text-sm text-zinc-400">Choose a username and tell us what you do.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">

                  {/* Username */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none">@</span>
                      <input
                        ref={usernameRef}
                        type="text"
                        value={username}
                        onChange={handleUsernameChange}
                        placeholder="yourhandle"
                        maxLength={50}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        className={`w-full rounded-lg border bg-zinc-900 pl-8 pr-4 py-3 text-sm text-white placeholder:text-zinc-600
                          outline-none focus:ring-2 focus:ring-white/5 transition-all
                          ${usernameStatus === 'available'
                            ? 'border-emerald-500/50 focus:border-emerald-500/70'
                            : usernameStatus === 'taken' || usernameStatus === 'invalid'
                            ? 'border-rose-500/50 focus:border-rose-500/70'
                            : 'border-zinc-800 focus:border-zinc-600'
                          }`}
                      />
                    </div>
                    <UsernameIndicator status={usernameStatus} reason={usernameReason} />
                  </div>

                  {/* Role cards */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                      What best describes you? <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {ROLES.map((r) => {
                        const selected = role === r.value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => { setRole(r.value); setError(''); }}
                            className={`relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer
                              ${selected
                                ? 'border-white bg-white/8 text-white'
                                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 hover:bg-zinc-800/60'
                              }`}
                          >
                            <div className={`transition-colors ${selected ? 'text-white' : 'text-zinc-500'}`}>
                              {r.icon}
                            </div>
                            <div>
                              <p className={`text-sm font-semibold leading-tight ${selected ? 'text-white' : ''}`}>{r.label}</p>
                              <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{r.description}</p>
                            </div>
                            {selected && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-2.5">
                      <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-sm text-rose-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving || usernameStatus === 'checking'}
                    className="w-full mt-1 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black
                      transition-all hover:bg-zinc-100 active:scale-[0.98]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/25 border-t-black rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Continue to Yepper →"
                    )}
                  </button>

                </form>
              </>
            )}
          </div>
        </div>

        <div className="absolute bottom-6 left-8 xl:left-12">
          <p className="text-[11px]" style={{ color: '#333' }}>© {new Date().getFullYear()} Yepper Inc.</p>
        </div>
      </div>

      {/* ── Right: campaign mosaic ── */}
      <div className="hidden lg:flex flex-1 relative h-screen overflow-hidden" style={{ background: '#0C0C0C' }} aria-hidden="true">
        <div className="absolute top-5 inset-x-0 z-20 flex justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#333' }}>Campaigns powered by Yepper</span>
        </div>
        <div className="flex gap-2 w-full h-full px-3 pt-10">
          <ScrollColumn items={colA} speed={25} />
          <ScrollColumn items={colB} speed={32} offsetTop={80} />
          <ScrollColumn items={colC} speed={28} offsetTop={40} />
        </div>
      </div>

    </div>
  );
}
