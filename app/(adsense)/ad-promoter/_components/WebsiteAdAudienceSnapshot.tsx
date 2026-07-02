'use client';

import { useEffect, useState } from 'react';
import { EyeIcon, UsersIcon } from '@heroicons/react/24/outline';
import api from '@/app/_lib/adsense-api';
import { buildDailySeries } from '@/app/_lib/daily-series';
import AudienceMap from './AudienceMap';
import DailyBarChart from './DailyBarChart';

// A compact "who's seeing this" view for an individual ad, embedded in its
// expanded card on the Analytics page. There's no per-ad view/click event
// log on the backend (views/clicks are bare counters — see
// WebAdvertiseModel), so this reuses the real visitor analytics of the
// website the ad is placed on: since the ad only shows there, that
// website's audience *is* the ad's audience. Real data, just scoped one
// level up from the ad itself rather than fabricated per-ad numbers.
export default function WebsiteAdAudienceSnapshot({ websiteId }: { websiteId: string }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/api/analytics/${websiteId}?range=30`)
      .then((r) => { if (!cancelled) setAnalytics(r.data as any); })
      .catch(() => { if (!cancelled) setAnalytics(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [websiteId]);

  if (loading) {
    return <div className="h-40 rounded-xl bg-(--color-surface-3) animate-pulse" />;
  }

  if (!analytics || !analytics.totalViews) {
    return (
      <p className="text-xs text-(--color-muted) border border-dashed border-(--color-border) rounded-xl p-4 text-center">
        No visitor data yet for the site this ad runs on — install the Yepper script there to see who&apos;s seeing it.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-(--color-muted)">
        Audience — based on this ad&apos;s website's real visitor traffic
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-(--color-surface-3) px-4 py-3">
          <div className="flex items-center gap-1.5 text-(--color-muted) text-[11px] mb-1"><EyeIcon className="w-3.5 h-3.5" />Views (30d)</div>
          <p className="text-lg font-bold text-(--color-white)">{analytics.totalViews.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-(--color-surface-3) px-4 py-3">
          <div className="flex items-center gap-1.5 text-(--color-muted) text-[11px] mb-1"><UsersIcon className="w-3.5 h-3.5" />Unique visitors</div>
          <p className="text-lg font-bold text-(--color-white)">{(analytics.uniqueVisitors ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {analytics.byDay?.length > 0 && (
        <div className="rounded-xl bg-(--color-surface-3) p-4">
          <DailyBarChart series={buildDailySeries(analytics.byDay, 30, 'count')} height={64} />
        </div>
      )}

      {analytics.mapPoints?.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-(--color-border)">
          <AudienceMap points={analytics.mapPoints} height={220} />
        </div>
      )}
    </div>
  );
}
