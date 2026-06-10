'use client';

// ─────────────────────────────────────────────────────────────────────────────
// ProtectedRoute — Unified auth guard
// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION from yepper-creators original:
//   [CHANGED] Auth source: now checks /auth/session which reads the JWT cookie
//             from the adsense backend — one source of truth for the whole app.
//   [REMOVED] Creators-specific onboarding redirect (username / what_they_do)
//             — the adsense user model doesn't have these fields. Onboarding
//             can be added back per-section with a section-level check.
//   [KEPT]    Spinner while checking, retry UI on network error, redirect on
//             confirmed auth failure — same UX behaviour as before.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';

type State = 'checking' | 'authorized' | 'unauthorized' | 'error';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>('checking');

  const check = useCallback(async () => {
    setState('checking');

    const result = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);

    if (result.ok) {
      if (result.data?.success && result.data.data?.user) {
        setState('authorized');
      } else {
        // Server explicitly says not authenticated — redirect to login
        setState('unauthorized');
        router.replace('/login');
      }
    } else {
      // Network or server error — don't log out, show retry UI
      setState('error');
    }
  }, [router]);

  useEffect(() => {
    setTimeout(() => check(), 0);
  }, [check]);

  if (state === 'checking') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-(--color-background)">
        <div className="w-6 h-6 border-2 border-(--color-border) border-t-(--color-subtle) rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-(--color-background)">
        <p className="text-sm text-(--color-muted)">Could not reach the server. Check your connection.</p>
        <button
          onClick={check}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-(--color-surface-2) border border-(--color-border) text-(--color-white) hover:bg-(--color-surface-3) transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state === 'authorized') return <>{children}</>;

  // Redirecting state — show spinner while Next.js router navigates
  return (
    <div className="h-screen w-full flex items-center justify-center bg-(--color-background)">
      <div className="w-6 h-6 border-2 border-(--color-border) border-t-(--color-subtle) rounded-full animate-spin" />
    </div>
  );
}
