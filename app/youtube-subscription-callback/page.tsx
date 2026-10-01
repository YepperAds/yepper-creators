'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getToken } from '@/app/(adsense)/utils/token';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

function SubscriptionCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('Verifying your subscription payment…');

  useEffect(() => {
    const txRef = searchParams.get('tx_ref');
    const transactionId = searchParams.get('transaction_id');
    if (searchParams.get('status') === 'cancelled') {
      setState('failed');
      setMessage('Checkout was cancelled. Video processing remains on the free manual workflow.');
      return;
    }
    if (!txRef) {
      setState('failed');
      setMessage('No payment reference was returned. Please check your subscription status.');
      return;
    }

    const token = getToken();
    fetch(`${BACKEND_URL}/api/social/youtube/subscription/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tx_ref: txRef, transaction_id: transactionId }),
    })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json.success || !json.active) throw new Error(json.message || 'Payment verification failed');
        setState('success');
        setMessage('Subscription active. Automatic YouTube ad processing is now available.');
      })
      .catch((err: Error) => {
        setState('failed');
        setMessage(err.message || 'Could not verify your payment.');
      });
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--color-bg) p-4">
      <section className="w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-surface-1) p-8 text-center">
        <h1 className={`mb-3 text-lg font-bold ${state === 'success' ? 'text-emerald-400' : state === 'failed' ? 'text-red-400' : 'text-(--color-white)'}`}>
          {state === 'verifying' ? 'Verifying subscription…' : state === 'success' ? 'Subscription active' : 'Subscription not active'}
        </h1>
        <p className="mb-6 text-sm text-(--color-muted)">{message}</p>
        {state !== 'verifying' && (
          <button
            onClick={() => router.push('/')}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white"
          >
            Back to dashboard
          </button>
        )}
      </section>
    </main>
  );
}

export default function YoutubeSubscriptionCallback() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-(--color-muted)">Verifying subscription…</div>}>
      <SubscriptionCallbackContent />
    </Suspense>
  );
}