'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';

// ─── Role definitions ────────────────────────────────────────────────────────

const ROLES = [
  {
    id: 'creator',
    label: 'Content Creator',
    tagline: 'Monetise your audience',
    description: 'Connect your social channels, verify your website, and unlock brand deals that match your content.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    accent: '#E8472B',
    accentDim: 'rgba(232,71,43,0.12)',
    border: 'rgba(232,71,43,0.3)',
    href: '/explore',
  },
  {
    id: 'promoter',
    label: 'Ad Promoter',
    tagline: 'Earn from your website',
    description: 'Place ads on your site through Yepper\'s network and get paid every time your audience engages.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    accent: '#1090C8',
    accentDim: 'rgba(16,144,200,0.12)',
    border: 'rgba(16,144,200,0.3)',
    href: '/ad-promoter/pages/websites',
  },
  {
    id: 'advertiser',
    label: 'Advertiser',
    tagline: 'Launch targeted campaigns',
    description: 'Upload your ads, select categories and websites, and reach exactly the audience you want across Africa.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
      </svg>
    ),
    accent: '#22C55E',
    accentDim: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.3)',
    href: '/ad-owner/pages/ads',
  },
] as const;

type RoleId = typeof ROLES[number]['id'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChooseRolePage() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [hovered, setHovered] = useState<RoleId | null>(null);
  const [selecting, setSelecting] = useState<RoleId | null>(null);
  const [mounted, setMounted] = useState(false);

  // Verify session and grab name
  useEffect(() => {
    async function init() {
        let result = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);
            if (!result.ok) {
                await new Promise(r => setTimeout(r, 1500));
                result = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);
            }
            if (!result.ok || !result.data?.success || !result.data.data?.user) {
                router.replace('/login');
                return;
            }
        const name = result.data.data.user.name ?? '';
        setUserName(name.split(' ')[0]);
        setMounted(true);
    }
    init();
  }, [router]);

  function handleSelect(role: typeof ROLES[number]) {
    setSelecting(role.id);
    // Small delay so the press animation registers
    setTimeout(() => router.push(role.href), 220);
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: '#000' }}
    >
      {/* Subtle background grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header */}
      <div
        className="relative z-10 text-center mb-12"
        style={{
          animation: 'fadeUp 0.5s ease both',
        }}
      >
        {/* Logo mark */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: '#E8472B' }}
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="white">
              <path d="M8 1L1 5.5V14h6v-4h2v4h6V5.5L8 1Z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">Yepper</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
          {userName ? `Welcome, ${userName}` : 'Welcome'}
        </h1>
        <p className="text-zinc-400 text-base max-w-xs mx-auto leading-relaxed">
          How do you want to use Yepper?
        </p>
      </div>

      {/* Role cards */}
      <div
        className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl"
        style={{ animation: 'fadeUp 0.5s 0.1s ease both', opacity: 0 }}
      >
        {ROLES.map((role, i) => {
          const isHovered   = hovered === role.id;
          const isSelecting = selecting === role.id;

          return (
            <button
              key={role.id}
              onClick={() => handleSelect(role)}
              onMouseEnter={() => setHovered(role.id)}
              onMouseLeave={() => setHovered(null)}
              disabled={!!selecting}
              style={{
                animationDelay: `${0.15 + i * 0.08}s`,
                animation: 'fadeUp 0.45s ease both',
                opacity: 0,
                background: isHovered ? role.accentDim : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isHovered ? role.border : 'rgba(255,255,255,0.08)'}`,
                transform: isSelecting ? 'scale(0.97)' : isHovered ? 'translateY(-2px)' : 'none',
                transition: 'all 0.18s ease',
                boxShadow: isHovered
                  ? `0 0 0 1px ${role.border}, 0 8px 32px rgba(0,0,0,0.4)`
                  : '0 2px 8px rgba(0,0,0,0.3)',
              }}
              className="relative flex flex-col items-start text-left rounded-2xl p-6 cursor-pointer focus:outline-none"
            >
              {/* Icon */}
              <div
                className="mb-5 p-2.5 rounded-xl"
                style={{
                  background: isHovered ? role.accentDim : 'rgba(255,255,255,0.05)',
                  color: isHovered ? role.accent : '#888',
                  border: `1px solid ${isHovered ? role.border : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.18s ease',
                }}
              >
                {role.icon}
              </div>

              {/* Text */}
              <div className="flex-1">
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-1"
                  style={{ color: isHovered ? role.accent : '#555', transition: 'color 0.18s ease' }}
                >
                  {role.tagline}
                </p>
                <h2 className="text-lg font-bold text-white mb-2 leading-tight">
                  {role.label}
                </h2>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {role.description}
                </p>
              </div>

              {/* Arrow */}
              <div
                className="mt-5 flex items-center gap-1.5 text-xs font-medium"
                style={{
                  color: isHovered ? role.accent : '#444',
                  transition: 'all 0.18s ease',
                }}
              >
                {isSelecting ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Continue</span>
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{
                        transform: isHovered ? 'translateX(2px)' : 'none',
                        transition: 'transform 0.18s ease',
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10m-4-4 4 4-4 4" />
                    </svg>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <p
        className="relative z-10 mt-10 text-xs text-zinc-600"
        style={{ animation: 'fadeUp 0.45s 0.4s ease both', opacity: 0 }}
      >
        You can switch roles at any time from your account settings.
      </p>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}