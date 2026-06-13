'use client';
// @ts-nocheck

// PaymentCallback.js — Flutterwave version
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Text, Heading, Container } from '@/app/(adsense)/components/components';
import { FlaskConical } from 'lucide-react';
import api from '@/app/_lib/adsense-api';

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [sandboxMode, setSandboxMode] = useState(false);

  useEffect(() => {
    api.get('/api/web-advertise/payment/debug-config')
      .then(res => setSandboxMode(!!(res.data as any).sandboxMode))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const verifyPayment = async () => {
      const transaction_id = searchParams.get('transaction_id');
      const tx_ref        = searchParams.get('tx_ref');
      const flwStatus     = searchParams.get('status');

      if (flwStatus === 'cancelled') {
        setStatus('failed');
        setMessage('Payment was cancelled. Please try again.');
        return;
      }

      const identifier = transaction_id || tx_ref;

      if (!identifier) {
        setStatus('failed');
        setMessage('No payment reference found in the callback URL.');
        return;
      }

      const parsedTransactionId = transaction_id ? String(transaction_id) : null;

      try {
        const transactionIdFromUrl = searchParams.get('transaction_id');
        const response = await api.post('/api/web-advertise/payment/verify', {
          transaction_id: transactionIdFromUrl,
          tx_ref,
        });

        if ((response.data as any).success) {
          setStatus('success');
          setMessage((response.data as any).message || 'Payment successful! Your ad is now live.');
        } else {
          setStatus('failed');
          setMessage((response.data as any).message || 'Payment verification failed.');
        }
      } catch (err: unknown) {
        setStatus('failed');
        setMessage(
          (err as any).response?.data?.message ||
          (err as any).response?.data?.error ||
          'Payment verification failed. Please contact support.'
        );
      }
    };

    verifyPayment();
  }, [searchParams]);

  const getTitle = () => {
    switch (status) {
      case 'verifying': return 'Verifying Payment…';
      case 'success':   return 'Payment Successful!';
      case 'failed':    return 'Payment Failed';
      default:          return 'Processing…';
    }
  };

  const getTitleColor = () => {
    switch (status) {
      case 'verifying': return 'text-muted';
      case 'success':   return 'text-success';
      case 'failed':    return 'text-error';
      default:          return 'text-muted';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Container>
        <div className="max-w-md mx-auto text-center">
          {sandboxMode && (
            <div className="flex items-center gap-2 justify-center bg-amber-50 border border-amber-400 text-amber-800 rounded px-4 py-2 mb-6 text-sm">
              <FlaskConical size={15} className="shrink-0" />
              <span>
                <strong>Sandbox Mode</strong> — this was a test transaction. No real money was charged.
              </span>
            </div>
          )}

          <Heading level={2} className={`mb-4 ${getTitleColor()}`}>
            {getTitle()}
          </Heading>

          <Text variant="muted" className="mb-8">
            {message}
          </Text>

          <div className="space-y-4">
            {status === 'success' && (
              <Button onClick={() => router.push('/')} variant="secondary" size="lg">
                Go to Dashboard
              </Button>
            )}

            {status === 'failed' && (
              <div className="space-y-2">
                <Button onClick={() => router.back()} variant="secondary" size="lg">
                  Try Again
                </Button>
                <Button onClick={() => router.push('/')} variant="outline" size="lg">
                  Back to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

export default function PaymentCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted">Verifying payment…</div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}
