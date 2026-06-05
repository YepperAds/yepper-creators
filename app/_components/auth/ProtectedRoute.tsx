'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';

// ─────────────────────────────────────────────────────────────────────────────
// ProtectedRoute
// Wraps authenticated areas of the dashboard.
//
// KEY BEHAVIOUR:
//   • Only redirects to /login on a CONFIRMED auth failure
//     (i.e., the server explicitly says "not authenticated").
//   • Network errors / timeouts / CORS issues show a retry UI
//     instead of silently signing the user out.
//   • If the creator hasn't completed onboarding, send them to /onboarding.
// ─────────────────────────────────────────────────────────────────────────────

type State = 'checking' | 'authorized' | 'unauthorized' | 'error';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>('checking');

  const check = useCallback(async () => {
    setState('checking');

    const result = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);

    if (result.ok) {
      if (result.data?.success && result.data.data?.user) {
        const user = result.data.data.user;
        // Onboarding incomplete (for Creators: check username and what_they_do)
        if (!user.username || !user.what_they_do) {
          router.replace('/onboarding');
          return;
        }
        setState('authorized');
      } else {
        // Server explicitly says not authenticated
        setState('unauthorized');
        router.replace('/login');
      }
    } else {
      // Network / server error — show retry, don't log out
      setState('error');
    }
  }, [router]);

  useEffect(() => {
    setTimeout(() => check(), 0);
  }, [check]);

  // ── Loading spinner ────────────────────────────────────────────
  if (state === 'checking') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-(--color-background)">
        <div className="w-6 h-6 border-2 border-(--color-border) border-t-(--color-subtle) rounded-full animate-spin" />
      </div>
    );
  }

  // ── Network / server error → retry ────────────────────────────
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

  // ── Authorized ─────────────────────────────────────────────────
  if (state === 'authorized') {
    return <>{children}</>;
  }

  // ── Redirecting to login ───────────────────────────────────────
  return (
    <div className="h-screen w-full flex items-center justify-center bg-(--color-background)">
      <div className="w-6 h-6 border-2 border-(--color-border) border-t-(--color-subtle) rounded-full animate-spin" />
    </div>
  );
}
