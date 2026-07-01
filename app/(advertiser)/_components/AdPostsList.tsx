'use client';

import { useCallback, useEffect, useState } from 'react';
import { FilmIcon, GlobeAltIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { fetchDashboardAds, type MyAd } from '@/app/_lib/my-ads';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Everything the "My ads" sidebar box counts — the user's own posted
// YouTube ad videos, and their imported ads actively showing on a website
// they own — via the same fetchDashboardAds() the sidebar uses, so "View
// all" never lands on a narrower list than what it promised to expand.
export default function AdPostsList() {
  const [ads, setAds]         = useState<MyAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { ads } = await fetchDashboardAds();
      setAds(ads);
    } catch {
      setError('Failed to load your ads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-(--color-white)">Your ads</h1>
        <p className="mt-1 text-sm text-(--color-muted)">Ads running on your websites and videos you've posted through Yepper.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-(--color-surface-1) border border-(--color-border) animate-pulse" />
          ))}
        </div>
      ) : ads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-(--color-border) rounded-2xl">
          <PhotoIcon className="w-12 h-12 text-(--color-muted) mb-4" />
          <p className="text-base font-semibold text-(--color-white) mb-1">No ads yet</p>
          <p className="text-sm text-(--color-muted) max-w-xs">Use "Add ad" to post a YouTube ad, or connect a website to start running ads on it.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ads.map((ad) => (
            <div key={ad.id} className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl p-4 flex gap-4">
              <div className="relative w-28 h-16 rounded-lg bg-(--color-surface-2) overflow-hidden shrink-0">
                {ad.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.image} alt={ad.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-(--color-muted)">
                    {ad.kind === 'youtube' ? <FilmIcon className="w-5 h-5" /> : <GlobeAltIcon className="w-5 h-5" />}
                  </div>
                )}
                <span className="absolute top-1 left-1 flex items-center justify-center w-4 h-4 rounded-full bg-black/70">
                  {ad.kind === 'youtube' ? <FilmIcon className="w-2.5 h-2.5 text-(--color-white)" /> : <GlobeAltIcon className="w-2.5 h-2.5 text-(--color-white)" />}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-(--color-white) truncate">{ad.title}</p>
                {ad.trackingCode && (
                  <p className="text-xs text-(--color-muted) mt-0.5 font-mono">{ad.trackingCode}</p>
                )}
                <p className="text-xs text-(--color-muted) mt-1">
                  {ad.kind === 'youtube'
                    ? `${formatCount(ad.views)} views · ${formatCount(ad.likes ?? 0)} likes`
                    : `${formatCount(ad.views)} views · ${formatCount(ad.clicks)} clicks`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
