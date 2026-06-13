'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function OAuthCallbackPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const success  = searchParams.get('success');
    const error    = searchParams.get('error');

    if (typeof window !== 'undefined' && window.opener && window.opener !== window) {
      // We're in a popup — post result to parent then close
      try {
        window.opener.postMessage(
          { type: 'oauth_callback', success: !!success, provider: success ?? null, error: error ?? null },
          window.location.origin,
        );
      } catch {}
      window.close();
    } else {
      // Opened as a normal tab — just redirect
      if (success) {
        router.replace('/connect-accounts');
      } else {
        router.replace(`/connect-accounts?error=${error ?? 'unknown'}`);
      }
    }
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 bg-black">
      <ArrowPathIcon className="w-6 h-6 text-zinc-500 animate-spin" />
      <p className="text-sm text-zinc-500">Completing connection…</p>
    </div>
  );
}
