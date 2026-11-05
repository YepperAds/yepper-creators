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
  const [step, setStep] = useState<'channel' | 'package'>('channel');
  const [packageCode, setPackageCode] = useState<(typeof CHANNEL_PACKAGES)[number]['code'] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    setStep('channel');
    setPackageCode(null);
    setSubmitted(false);
    setError('');
  }, [channel?.id]);

  if (!channel) return null;
  const selectedPackage = CHANNEL_PACKAGES.find((item) => item.code === packageCode);

  const submitRequest = async () => {
    if (!packageCode || submitting || submitted) return;
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
            <p className="mt-1 text-xs text-white/55">{step === 'channel' ? 'Review this channel, then continue to see advertising packages.' : 'Choose one package for this channel. Your request will be sent to the Yepper team.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close channel packages" className="rounded-full px-3 py-1 text-xl text-white/55 hover:bg-white/10 hover:text-white">×</button>
        </div>
        {step === 'channel' ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {channel.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={channel.avatar} alt={`${channel.channelName} channel`} className="h-20 w-20 rounded-full border border-white/15 object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{channel.channelName}</p>
              <p className="mt-1 text-xs text-white/55">{channel.subscribers.toLocaleString('en-US')} subscribers</p>
              {channel.videos[0]?.url && (
                <a
                  href={channel.videos[0].url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-semibold text-coral-text hover:underline"
                >
                  View featured video
                </a>
              )}
            </div>
            <button type="button" onClick={() => setStep('package')} className="rounded-lg bg-coral px-5 py-2.5 text-sm font-bold text-white">
              Continue to prices
            </button>
          </div>
        ) : (
          <>
            <h5 className="mb-3 text-sm font-bold">Select one package</h5>
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
                      name={`youtube-package-${channel.id}`}
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
            {submitted && <p role="status" className="mt-3 text-xs text-emerald-400">Your request has been recorded. The Yepper team will follow up.</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep('channel')} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 hover:bg-white/5">
                Back
              </button>
              <div className="flex items-center gap-3">
                {selectedPackage && <p className="text-sm font-semibold text-white">{formatRwf(selectedPackage.totalRwf)}</p>}
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={!packageCode || submitting || submitted}
                  className="rounded-lg bg-coral px-4 py-2 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : submitted ? 'Request sent' : 'Request package'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
