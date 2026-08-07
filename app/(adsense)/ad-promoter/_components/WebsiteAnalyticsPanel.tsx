'use client';

import { useEffect, useState } from 'react';
import {
  RefreshCw,
  Eye,
  Users,
  TrendingUp,
  BarChart2,
  MapPin,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Gift,
} from 'lucide-react';
import api from '@/app/_lib/adsense-api';
import { buildDailySeries } from '@/app/_lib/daily-series';
import AudienceMap from './AudienceMap';
import DailyBarChart from './DailyBarChart';

// Visitor-traffic analytics for a single website the user owns, extracted
// from the per-website "Analytics" tab (see ad-promoter/pages/website/[websiteId]/page.tsx)
// so it can be shown as its own tab on the dashboard's main Analytics page
// instead of buried inside the website drill-down. WebsiteDetails itself
// still fetches this same data internally (it feeds AddNewCategory's
// traffic-based pricing); this component is a second, independent fetch
// for display purposes only.
export default function WebsiteAnalyticsPanel({ websiteId }: { websiteId: string }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState(30);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const r = await api.get(`/api/analytics/${websiteId}?range=${analyticsRange}`);
      setAnalytics(r.data as any);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId, analyticsRange]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Website Analytics</h2>
          <p className="text-sm text-muted mt-1">Real visitor data collected by your Yepper script</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setAnalyticsRange(d)}
              className={`px-4 py-2 text-sm border border-border font-medium transition-colors ${analyticsRange === d ? 'bg-white text-background' : 'bg-surface-1 text-white hover:bg-surface-2'}`}>
              {d}d
            </button>
          ))}
          <button onClick={fetchAnalytics} className="px-4 py-2 text-sm border border-border bg-surface-1 hover:bg-surface-2 text-white flex items-center gap-1.5 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {analyticsLoading ? (
        <div className="flex items-center justify-center h-60">
          <div className="text-center">
            <div className="animate-spin w-7 h-7 border-2 border-border border-t-white rounded-full mx-auto mb-3" />
            <p className="text-muted text-sm">Loading analytics…</p>
          </div>
        </div>
      ) : !analytics ? (
        <div className="border border-dashed border-border p-16 text-center">
          <BarChart2 size={40} className="mx-auto mb-4 text-muted" />
          <p className="text-base font-semibold text-white mb-2">No data yet</p>
          <p className="text-sm text-muted max-w-sm mx-auto">Install your Yepper script on your website and visitor data will appear here automatically.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Views', value: analytics.totalViews?.toLocaleString() || '0', icon: Eye },
              { label: 'Unique Visitors', value: analytics.uniqueVisitors?.toLocaleString() || '0', icon: Users },
              { label: 'Monthly Traffic', value: analytics.monthlyTraffic?.toLocaleString() || '0', icon: TrendingUp },
              { label: 'Traffic Tier', value: analytics.trafficTier ? analytics.trafficTier.charAt(0).toUpperCase() + analytics.trafficTier.slice(1) : 'Starter', icon: BarChart2 },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="border border-border p-5 bg-surface-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
                  <Icon size={14} className="text-muted" />
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Daily chart */}
          {analytics.byDay?.length > 0 && (
            <div className="border border-border p-6 bg-surface-1">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Views per Day</p>
              <DailyBarChart series={buildDailySeries(analytics.byDay, analyticsRange, 'count')} height={112} />
            </div>
          )}

          {/* Map + countries */}
          <div className="grid grid-cols-1 gap-5">
            <div className="border border-border">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <MapPin size={12} className="text-muted" />
                <span className="text-sm font-semibold text-white">Visitor Locations</span>
                <span className="ml-auto text-xs text-muted">{analytics.mapPoints?.length || 0} points</span>
              </div>
              <AudienceMap points={analytics.mapPoints ?? []} height={360} />
              <div className="px-4 py-2 border-t border-border flex gap-4 text-xs text-muted">
                {[['#34d399', 'Desktop'], ['#60a5fa', 'Mobile'], ['#c084fc', 'Tablet']].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />{l}</span>
                ))}
              </div>
            </div>
            <div className="border border-border">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Globe size={12} className="text-muted" />
                <span className="text-sm font-semibold text-white">Top Countries</span>
              </div>
              <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
                {analytics.byCountry?.length > 0 ? analytics.byCountry.map((c: any, i: any) => {
                  const pct = analytics.totalViews > 0 ? Math.round((c.count / analytics.totalViews) * 100) : 0;
                  return (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="text-white font-medium">{c.country}</span>
                        <span className="text-muted">{c.count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-surface-3 h-1"><div className="h-1 bg-white" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                }) : <div className="px-4 py-8 text-center text-sm text-muted">No country data yet</div>}
              </div>
            </div>
          </div>

          {/* Devices + referrers + pages */}
          <div className="grid grid-cols-1 gap-5">
            <div className="border border-border">
              <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Devices</div>
              <div className="divide-y divide-border">
                {analytics.byDevice?.length > 0 ? analytics.byDevice.map((d: any, i: any) => {
                  const Icon = d.device === 'mobile' ? Smartphone : d.device === 'tablet' ? Tablet : Monitor;
                  const pct = analytics.totalViews > 0 ? Math.round((d.count / analytics.totalViews) * 100) : 0;
                  return (
                    <div key={i} className="px-4 py-3 flex items-center gap-3">
                      <Icon size={14} className="text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize text-white">{d.device}</span>
                          <span className="text-muted">{pct}%</span>
                        </div>
                        <div className="w-full bg-surface-3 h-1"><div className="h-1 bg-white" style={{ width: `${pct}%` }} /></div>
                      </div>
                    </div>
                  );
                }) : <div className="px-4 py-8 text-center text-sm text-muted">No device data</div>}
              </div>
            </div>
            <div className="border border-border">
              <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Top Referrers</div>
              <div className="divide-y divide-border max-h-56 overflow-y-auto">
                {analytics.topReferrers?.length > 0 ? analytics.topReferrers.map((r: any, i: any) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-white truncate flex-1">{r.referrer || '(direct)'}</span>
                    <span className="text-xs text-muted shrink-0">{r.count}</span>
                  </div>
                )) : <div className="px-4 py-8 text-center text-sm text-muted">No referrer data</div>}
              </div>
            </div>
            <div className="border border-border">
              <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Top Pages</div>
              <div className="divide-y divide-border max-h-56 overflow-y-auto">
                {analytics.topPages?.length > 0 ? analytics.topPages.map((p: any, i: any) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-white truncate flex-1">{p.path}</span>
                    <span className="text-xs text-muted shrink-0">{p.count}</span>
                  </div>
                )) : <div className="px-4 py-8 text-center text-sm text-muted">No page data</div>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Granted Traffic section */}
      {analytics?.grantDisplay && (() => {
        const gd = analytics.grantDisplay;
        const TIER_COLORS: Record<string, string> = { elite: '#fff', premium: '#f97316', standard: '#8b5cf6', basic: '#10b981', starter: '#3b82f6', unverified: '#f59e0b' };
        const tierColor = TIER_COLORS[gd.trafficTier] || '#888';
        const hoursLeft = gd.grantWindowExpiresAt
          ? Math.max(0, Math.ceil((new Date(gd.grantWindowExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))
          : 0;
        return (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Gift size={16} className="text-white" />
                Your Stated Traffic
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Numbers you provided via your analytics boost, shown separately from script-counted data
                {hoursLeft > 0 && <span className="text-amber-400 ml-2">· Visible for {hoursLeft}h more</span>}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 mb-4">
              {[
                { label: 'Monthly Visitors', value: gd.grantedTraffic?.toLocaleString() ?? '-', sub: 'as stated by you' },
                { label: 'Monthly Views', value: gd.grantedViews?.toLocaleString() ?? '-', sub: 'as stated by you' },
                { label: 'Traffic Tier', value: gd.trafficTier, sub: 'applied to your ad spaces', color: tierColor, cap: true },
              ].map(({ label, value, sub, color, cap }) => (
                <div key={label} className="border border-border p-5 bg-surface-1">
                  <p className="text-xs font-medium text-muted uppercase mb-2">{label}</p>
                  <p className={`text-2xl font-bold ${cap ? 'capitalize' : ''}`} style={color ? { color } : {}}>{value}</p>
                  <p className="text-xs text-muted mt-1">{sub}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted border border-border bg-surface-1 p-3">
              <span className="font-medium text-subtle">Note:</span> These numbers reflect what you reported and are used to set your tier. They do not change what the Yepper script counted from real visitors.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
