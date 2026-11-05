'use client';

import { useEffect, useState } from 'react';
import { youtubeChannelAPI } from '@/app/_lib/adsense-api';

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

export default function YoutubeChannelPackagePicker({ channelIds }: { channelIds: string[] }) {
  const [packageCode, setPackageCode] = useState<(typeof CHANNEL_PACKAGES)[number]['code']>('social_video');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const channelIdsKey = channelIds.join(',');

  useEffect(() => {
    setSubmitted(false);
    setError('');
  }, [channelIdsKey]);

  if (channelIds.length === 0) return null;
  const selectedPackage = CHANNEL_PACKAGES.find((item) => item.code === packageCode) ?? CHANNEL_PACKAGES[0];

  const submitRequest = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setError('');
    try {
      await youtubeChannelAPI.requestPackage(channelIds, packageCode);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-4" aria-label="YouTube advertising package">
      <h5 className="text-sm font-bold text-white">Choose a package</h5>
      <p className="mt-1 text-xs text-white/55">
        The package price covers all selected channels. Submitting records a request for follow-up; no payment is taken here.
      </p>
      <div className="mt-3 grid gap-2 lg:grid-cols-3">
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
                  setSubmitted(false);
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/55">
          {channelIds.length} channel{channelIds.length === 1 ? '' : 's'} · {formatRwf(selectedPackage.totalRwf)} total
        </p>
        <button
          type="button"
          onClick={submitRequest}
          disabled={submitting || submitted}
          className="rounded-lg bg-coral px-4 py-2 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : submitted ? 'Request sent' : 'Request package'}
        </button>
      </div>
    </section>
  );
}
