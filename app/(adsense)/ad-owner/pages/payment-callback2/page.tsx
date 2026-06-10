'use client';
// @ts-nocheck

// PaymentCallback2.js — Flutterwave version
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Text, Heading, Container } from '@/app/(adsense)/components/components';
import { FlaskConical } from 'lucide-react';
import api from '@/app/_lib/adsense-api';

const PaymentCallback2 = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your payment...');
  const [sandboxMode, setSandboxMode] = useState(false);

  // Fetch sandbox mode on mount
  useEffect(() => {
    api.get('/api/web-advertise/payment/debug-config')
      .then(res => setSandboxMode(!!(res.data as any).sandboxMode))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const verifyPayment = async () => {
      // Flutterwave redirects with ?transaction_id=...&tx_ref=...&status=...
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
        setMessage('No payment reference found in the callback URL. Please contact support.');
        return;
      }

      try {
        setMessage('Verifying payment with server...');

        const response = await api.post(
          '/api/web-advertise/payment/verify-callback',
          { transaction_id, tx_ref },
          { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
        );

        if ((response.data as any).success) {
          setStatus('success');
          setMessage((response.data as any).message || 'Payment successful! Your ad is now live.');
          setTimeout(() => router.push('/'), 3000);
        } else {
          setStatus('failed');
          setMessage((response.data as any).message || 'Payment verification failed');
        }
      } catch (err: unknown) {
        setStatus('error');

        if (error.code === 'ECONNABORTED') {
          setMessage('Verification timed out. Please check your payment status in the dashboard.');
        } else if ((error as any).response) {
          const statusCode = (error as any).response.status;
          const errorData  = (error as any).(response.data as any);

          switch (statusCode) {
            case 401:
              setMessage('Authentication expired. Redirecting to login...');
              setTimeout(() => router.push('/login'), 2000);
              break;
            case 409:
              setMessage('Payment already processed successfully.');
              setStatus('success');
              setTimeout(() => router.push('/'), 3000);
              break;
            case 404:
              setMessage('Payment record not found. Please contact support.');
              break;
            case 500:
              setMessage('Server error during verification. Please try again or contact support.');
              break;
            default:
              setMessage(errorData?.message || errorData?.error || `Server error (${statusCode})`);
          }
        } else {
          setMessage('Network error — unable to reach the payment verification server. Please check your connection.');
        }
      }
    };

    const timer = setTimeout(verifyPayment, 500);
    return () => clearTimeout(timer);
  }, [searchParams, router]);

  const getTitle = () => {
    switch (status) {
      case 'verifying': return 'Verifying Payment...';
      case 'success':   return 'Payment Successful!';
      case 'failed':
      case 'error':     return 'Payment Failed';
      default:          return 'Processing...';
    }
  };

  const getTitleColor = () => {
    switch (status) {
      case 'verifying': return 'text-muted';
      case 'success':   return 'text-success';
      case 'failed':
      case 'error':     return 'text-error';
      default:          return 'text-muted';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Container>
        <div className="max-w-md mx-auto text-center">

          {/* Sandbox banner */}
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

            {(status === 'failed' || status === 'error') && (
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
};

export default PaymentCallback2;