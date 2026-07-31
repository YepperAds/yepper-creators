'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, AUTH_ENDPOINTS } from '@/app/_lib/api';
import type { AuthResponse } from '@/app/_types/auth';

// ─────────────────────────────────────────────────────────────
// Google OAuth callback page
// ─────────────────────────────────────────────────────────────
// The backend redirects here after Google auth:
//   /auth/callback?token=ONE_TIME_TOKEN
//
// We exchange the token for a session cookie via fetch
// (this avoids third-party cookie blocking issues).
// ─────────────────────────────────────────────────────────────

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setTimeout(() => setError('Google authentication failed. Please try again.'), 0);
      setTimeout(() => router.replace('/login'), 3000);
      return;
    }

    if (!token) {
      setTimeout(() => setError('Invalid callback: no token provided.'), 0);
      setTimeout(() => router.replace('/login'), 3000);
      return;
    }

    async function exchangeToken() {
      const result = await api.post<AuthResponse>(AUTH_ENDPOINTS.exchangeToken, {
        token,
      });

      if (!result.ok) {
        setError(result.error.message ?? 'Authentication failed. Please try again.');
        setTimeout(() => router.replace('/login'), 3000);
        return;
      }

      // Session cookie is now set via fetch; browser won't block it
      router.replace('/');
    }

    exchangeToken();
  }, [searchParams, router]);

  return (
    <div suppressHydrationWarning className="h-screen flex flex-col items-center justify-center bg-black gap-4">
      {error ? (
        <>
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: '#1A0A0A', border: '1px solid #E8472B33' }}>
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"
              stroke="#E8472B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: '#E8472B' }}>{error}</p>
          <p className="text-xs" style={{ color: '#444' }}>Redirecting to sign in…</p>
        </>
      ) : (
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div suppressHydrationWarning className="h-screen flex flex-col items-center justify-center bg-black gap-4">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
