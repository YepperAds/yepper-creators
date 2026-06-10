'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useSession } from '@/app/_hooks/useSession';
import { Button, Input, Alert, Heading, Text } from '@/app/(adsense)/components/components';
import api from '@/app/_lib/adsense-api';
import { Ad } from '@/app/(adsense)/types';

interface PaymentResponse {
  success: boolean;
  paymentLink?: string;
  message?: string;
}

interface PaymentModalProps {
  ad: Ad;
  websiteId: string;
  onClose: () => void;
}

const PaymentModal = ({ ad, websiteId, onClose }: PaymentModalProps) => {
  const { user } = useSession();
  const [email, setEmail] = useState('example@gmail.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? user?._id ?? user?.userId;

  const initiatePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!ad?._id || !websiteId) {
        setError('Missing ad or website information');
        setLoading(false);
        return;
      }

      if (!userId) {
        setError('User authentication required. Please log in again.');
        setLoading(false);
        return;
      }

      const websiteSelection =
        ad.websiteStatuses?.find((s: any) => s.websiteId === websiteId) ??
        ad.websiteSelections?.find((s: any) => {
          const id = typeof s.websiteId === 'string' ? s.websiteId : s.websiteId._id;
          return id === websiteId;
        });

      if (!websiteSelection) {
        setError('Website selection not found');
        setLoading(false);
        return;
      }

      const totalPrice =
        websiteSelection.categories?.reduce((sum: number, cat) => sum + (cat.price || 0), 0) ?? 0;

      if (totalPrice <= 0) {
        setError('Invalid payment amount');
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };


      const response = await api.post<PaymentResponse>(
        '/api/web-advertise/initiate-payment',
        { adId: ad._id, websiteId, amount: totalPrice, email: email || undefined, userId },
        { headers }
      );

      if ((response.data as any).success && (response.data as any).paymentLink) {
        window.location.href = (response.data as any).paymentLink;
      } else {
        setError((response.data as any).message ?? 'Payment link generation failed. Please try again.');
      }
    } catch (err: unknown) {
      let errorMessage = 'An error occurred. Please try again.';
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      if (e.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (e.response?.status === 400) {
        errorMessage = e.(response.data as any)?.message ?? 'Invalid request data.';
      } else if (e.response?.data?.message) {
        errorMessage = e.(response.data as any).message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-1 border border-border max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <Heading level={3}>Complete Payment</Heading>
          <button onClick={onClose} disabled={loading} className="p-2 hover:bg-surface-3 border border-border">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <Alert variant="error" className="mb-6">
              {error}
            </Alert>
          )}

          <Input
            type="email"
            label="Email Address"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="mb-6"
          />

          <div className="flex gap-3">
            <Button onClick={initiatePayment} disabled={loading} loading={loading} variant="secondary" className="flex-1">
              Pay Now
            </Button>
            <Button onClick={onClose} disabled={loading} variant="primary" className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
