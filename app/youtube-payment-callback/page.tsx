'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getToken } from '@/app/(adsense)/utils/token';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

function YoutubePaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    const verify = async () => {
      const transaction_id = searchParams.get('transaction_id');
      const tx_ref = searchParams.get('tx_ref');
      const flwStatus = searchParams.get('status');

      if (flwStatus === 'cancelled') {
        setStatus('failed');
        setMessage('Payment was cancelled. The slot has been released.');
        return;
      }

      const identifier = transaction_id || tx_ref;
      if (!identifier) {
        setStatus('failed');
        setMessage('No payment reference found. Please contact support.');
        return;
      }

      try {
        const token = getToken();
        const res = await fetch(`${BACKEND_URL}/api/social/youtube/ad-spaces/claim/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ transaction_id, tx_ref }),
        });
        const json = await res.json().catch(() => ({}));

        if (json.success) {
          setStatus('success');
          setMessage(json.message || 'Payment successful — ad slot claimed!');
          setTimeout(() => router.push('/'), 3000);
        } else {
          setStatus('failed');
          setMessage(json.message || 'Payment verification failed.');
        }
      } catch {
        setStatus('failed');
        setMessage('Network error while verifying payment. Please check your dashboard.');
      }
    };

    const timer = setTimeout(verify, 500);
    return () => clearTimeout(timer);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-(--color-bg) flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-(--color-surface-1) border border-(--color-border) rounded-2xl p-8">
        <h1 className={`text-lg font-bold mb-3 ${status === 'success' ? 'text-emerald-400' : status === 'failed' ? 'text-red-400' : 'text-(--color-white)'}`}>
          {status === 'verifying' && 'Verifying Payment…'}
          {status === 'success' && 'Payment Successful!'}
          {status === 'failed' && 'Payment Failed'}
        </h1>
        <p className="text-sm text-(--color-muted) mb-6">{message}</p>
        {status !== 'verifying' && (
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}

export default function YoutubePaymentCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-(--color-muted)">Verifying payment…</div>}>
      <YoutubePaymentCallbackContent />
    </Suspense>
  );
}
