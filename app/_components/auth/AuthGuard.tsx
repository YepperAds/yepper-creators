'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';

// ─────────────────────────────────────────────────────────────────────────────
// AuthGuard — redirects authenticated users away from public auth pages.
// Wrap auth pages (login, etc.) with this so logged-in creators can't access them.
// ─────────────────────────────────────────────────────────────────────────────

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function check() {
      const result = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);

      if (result.ok && result.data?.success && result.data.data?.user) {
        const user = result.data.data.user;
        // Onboarding not done (for Creators: check username and what_they_do)
        if (!user.username || !user.what_they_do) {
          router.replace('/onboarding');
        } else {
          // Fully onboarded → go to dashboard
          router.replace('/explore');
        }
      } else {
        // Not logged in → show the auth page
        setChecked(true);
      }
    }

    check();
  }, [router]);

  if (!checked) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
