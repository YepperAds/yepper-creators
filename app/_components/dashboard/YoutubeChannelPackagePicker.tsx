'use client';

import { useEffect, useState } from 'react';
import { youtubeChannelAPI } from '@/app/_lib/adsense-api';
import type { PublicCreator } from '@/app/_lib/public-home';

const CHANNEL_PACKAGES = [
  {
    code: 'social_video',
    name: 'One video + social media promotion',
    details: 'One ad in a video, promoted across social media.',
    totalRwf: 1_000_000,
    priceDetails: 'One-time package',
  },
  {
    code: 'weekly',
    name: 'Weekly promotion',
    details: 'One ad per video, 5 videos per month at RWF 100,000 per video.',
    totalRwf: 500_000,
    priceDetails: 'RWF 500,000 per month',
  },
  {
    code: 'thirty_days',
    name: '30-day promotion',
    details: 'One ad per video for 30 days at RWF 11,000 per video.',
    totalRwf: 330_000,
    priceDetails: 'RWF 330,000 for 30 days',
  },
] as const;

function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString('en-US')}`;
}

export default function YoutubeChannelPackagePicker({
  channel,
  onClose,
}: {
  channel: PublicCreator | null;
  onClose: () => void;
}) {
  const [packageCode, setPackageCode] = useState<(typeof CHANNEL_PACKAGES)[number]['code']>('social_video');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    setSubmitted(false);
    setError('');
  }, [channel?.id]);

  if (!channel) return null;
  const selectedPackage = CHANNEL_PACKAGES.find((item) => item.code === packageCode) ?? CHANNEL_PACKAGES[0];

  const submitRequest = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError('');
    try {
      await youtubeChannelAPI.requestPackage(channel.id, packageCode);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#111] p-5 text-white shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-label={`${channel.channelName} advertising packages`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-coral-text">YouTube channel</p>
            <h4 className="mt-1 text-xl font-bold">{channel.channelName}</h4>
            <h5 className="mt-4 text-sm font-bold">Choose an advertising package</h5>
            <p className="mt-1 text-xs text-white/55">
              Package pricing is for this channel. This channel is not connected to Yepper checkout yet, so continue to send a request and our team will follow up. No payment is taken here.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close channel packages" className="rounded-full px-3 py-1 text-xl text-white/55 hover:bg-white/10 hover:text-white">×</button>
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
        {CHANNEL_PACKAGES.map((option) => (
          <label
            key={option.code}
            className={`cursor-pointer rounded-lg border p-3 transition-colors ${
              packageCode === option.code ? 'border-coral bg-coral/10' : 'border-white/10 hover:border-white/25'
            }`}
          >
            <span className="flex items-start gap-2">
              <input
                type="radio"
                name="youtube-package"
                value={option.code}
                checked={packageCode === option.code}
                onChange={() => {
                  setPackageCode(option.code);
                  setError('');
                }}
                className="mt-0.5 accent-[#e8472b]"
              />
              <span>
                <span className="block text-xs font-bold text-white">{option.name}</span>
                <span className="mt-1 block text-[11px] leading-4 text-white/55">{option.details}</span>
                <span className="mt-2 block text-xs font-bold text-coral-text">{option.priceDetails}</span>
              </span>
            </span>
          </label>
        ))}
      </div>
        {error && <p role="alert" className="mt-3 text-xs text-coral-text">{error}</p>}
        {submitted && <p role="status" className="mt-3 text-xs text-emerald-400">Your request has been recorded. Our team will follow up.</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">{formatRwf(selectedPackage.totalRwf)} <span className="text-xs font-normal text-white/55">for {channel.channelName}</span></p>
          <button
            type="button"
            onClick={submitRequest}
            disabled={submitting || submitted}
            className="rounded-lg bg-coral px-4 py-2 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : submitted ? 'Request sent' : 'Send request'}
          </button>
        </div>
      </section>
    </div>
  );
}
