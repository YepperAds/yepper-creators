'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';

// ─────────────────────────────────────────────────────────────
// Root page — checks session and routes accordingly
//   Logged in  → /dashboard
//   Not logged → /login
// ─────────────────────────────────────────────────────────────

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const result = await api.get<AuthResponse>(AUTH_ENDPOINTS.checkSession);

      if (result.ok && result.data.success) {
        router.replace('/explore');
      } else {
        router.replace('/login');
      }
    }

    check();
  }, [router]);

  // Brief loading state while checking session
  return (
    <div className="h-screen flex items-center justify-center bg-black">
      <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );
}
