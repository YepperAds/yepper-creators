'use client';

import { useEffect, useRef, useState } from 'react';
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

// Backend day-count endpoints only return days that actually had traffic —
// with a sparse or short history that's 2-3 entries, which a `flex-1` bar
// chart renders as a couple of giant blocks rather than a real chart. This
// fills in every day across the selected range (as 0) so the chart always
// has one thin bar per day, whatever the underlying data density.
function buildDailySeries(byDay: Array<Record<string, unknown>>, rangeDays: number, countKey: string): { date: string; value: number }[] {
  const map = new Map(byDay.map((d) => [String(d.date), Number(d[countKey]) || 0]));
  const series: { date: string; value: number }[] = [];
  const today = new Date();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, value: map.get(key) ?? 0 });
  }
  return series;
}

// Visitor-traffic analytics for a single website the user owns — extracted
// from the per-website "Analytics" tab (see ad-promoter/pages/website/[websiteId]/page.tsx)
// so it can be shown as its own tab on the dashboard's main Analytics page
// instead of buried inside the website drill-down. WebsiteDetails itself
// still fetches this same data internally (it feeds AddNewCategory's
// traffic-based pricing) — this component is a second, independent fetch
// for display purposes only.
export default function WebsiteAnalyticsPanel({ websiteId, websiteLink }: { websiteId: string; websiteLink?: string | null }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState(30);
  const [gscData, setGscData] = useState<any>(null);
  const [gscLoading, setGscLoading] = useState(false);
  const [gscConnecting, setGscConnecting] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);

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

  const fetchGscData = async () => {
    setGscLoading(true);
    try {
      const r = await api.get(`/api/analytics/gsc/data/${websiteId}`);
      setGscData(r.data as any);
    } catch (err) {
      console.error('Failed to fetch GSC data', err);
    } finally {
      setGscLoading(false);
    }
  };

  const handleConnectGsc = async () => {
    setGscConnecting(true);
    try {
      const r = await api.get(`/api/analytics/gsc/connect/${websiteId}`);
      window.location.href = (r.data as any).url;
    } catch {
      setGscConnecting(false);
    }
  };

  const handleDisconnectGsc = async () => {
    if (!window.confirm('Disconnect Google Search Console from this website?')) return;
    try {
      await api.delete(`/api/analytics/gsc/disconnect/${websiteId}`);
      setGscData(null);
    } catch {}
  };

  useEffect(() => {
    fetchAnalytics();
    fetchGscData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId, analyticsRange]);

  // Visitor-location map — loads Leaflet from a CDN on first use, same as
  // the original per-website tab.
  useEffect(() => {
    if (!analytics?.mapPoints?.length) return;
    const init = () => {
      const container = mapRef.current;
      if (!container || !(window as any).L) return;
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
      const map = (window as any).L.map(container, { zoomControl: true }).setView([20, 0], 2);
      // CARTO's free dark basemap — no API key needed, and reads as part of
      // the dashboard's dark UI instead of a bright OSM tile punched into it.
      (window as any).L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);
      analytics.mapPoints.forEach((pt: any) => {
        const c = pt.device === 'mobile' ? '#60a5fa' : pt.device === 'tablet' ? '#c084fc' : '#34d399';
        (window as any).L.circleMarker([pt.lat, pt.lon], { radius: 6, fillColor: c, color: '#0b0f14', weight: 1.5, opacity: 1, fillOpacity: 0.9 })
          .bindPopup(`<strong>${pt.city}, ${pt.country}</strong><br/>${pt.device}<br/>${new Date(pt.timestamp).toLocaleString()}`).addTo(map);
      });
      leafletMapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    };
    if (!(window as any).L) {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = init;
      document.head.appendChild(s);
    } else {
      init();
    }
    return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } };
  }, [analytics]);

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
              className={`px-4 py-2 text-sm border border-border font-medium transition-colors ${analyticsRange === d ? 'bg-white text-black' : 'bg-surface-1 text-white hover:bg-surface-2'}`}>
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
          {analytics.byDay?.length > 0 && (() => {
            const series = buildDailySeries(analytics.byDay, analyticsRange, 'count');
            const max = Math.max(...series.map((d) => d.value), 1);
            return (
              <div className="border border-border p-6 bg-surface-1">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Views per Day</p>
                <div className="flex items-end gap-px h-28">
                  {series.map((d, i) => (
                    <div key={i} className="flex-1 h-full group relative flex flex-col justify-end">
                      <div style={{ height: `${(d.value / max) * 100}%` }} className="w-full bg-white hover:bg-zinc-400 transition-colors min-h-[2px] rounded-t-sm" />
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-[#fff] px-1 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">{d.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted">
                  <span>{series[0]?.date}</span>
                  <span>{series[series.length - 1]?.date}</span>
                </div>
              </div>
            );
          })()}

          {/* Map + countries */}
          <div className="grid grid-cols-1 gap-5">
            <div className="border border-border">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <MapPin size={12} className="text-muted" />
                <span className="text-sm font-semibold text-white">Visitor Locations</span>
                <span className="ml-auto text-xs text-muted">{analytics.mapPoints?.length || 0} points</span>
              </div>
              <div ref={mapRef} style={{ height: '360px', width: '100%' }} />
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
                Numbers you provided via your analytics boost — shown separately from script-counted data
                {hoursLeft > 0 && <span className="text-amber-400 ml-2">· Visible for {hoursLeft}h more</span>}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 mb-4">
              {[
                { label: 'Monthly Visitors', value: gd.grantedTraffic?.toLocaleString() ?? '—', sub: 'as stated by you' },
                { label: 'Monthly Views', value: gd.grantedViews?.toLocaleString() ?? '—', sub: 'as stated by you' },
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
              <span className="font-medium text-subtle">Note:</span> These numbers reflect what you reported and are used to set your tier. They do not change what the Yepper script counted from real visitors, nor what Google Search Console reports.
            </p>
          </div>
        );
      })()}

      {/* Google Search Console */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21.35 11.1h-9.17v2.73h5.51c-.33 1.81-1.87 3.14-3.77 3.14a5.02 5.02 0 01-5.03-5.02 5.02 5.02 0 015.03-5.02c1.22 0 2.33.44 3.19 1.16l2.02-2.02A8.46 8.46 0 0014.51 4c-4.69 0-8.5 3.8-8.5 8.5s3.81 8.5 8.5 8.5c4.91 0 8.17-3.45 8.17-8.3 0-.56-.06-1.1-.17-1.6h-1.16z" fill="#4285F4"/></svg>
              Organic Traffic (Search Console)
            </h2>
            <p className="text-xs text-muted mt-0.5">Real clicks & impressions from Google Search — last 28 days</p>
          </div>
          {gscData?.connected && (
            <button onClick={handleDisconnectGsc} className="text-xs text-muted hover:text-red-400 transition-colors underline">Disconnect</button>
          )}
        </div>

        {gscLoading ? (
          <div className="border border-border p-8 flex items-center justify-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-border border-t-white rounded-full" />
            <span className="text-sm text-muted">Loading Search Console data…</span>
          </div>
        ) : !gscData?.connected ? (
          <div className="border border-dashed border-border p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-2 border border-border flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 48 48" fill="none"><path d="M43.6 20.2H24v7.3H35.2c-.9 4.8-5 8.4-11.2 8.4A13.4 13.4 0 0110.6 24a13.4 13.4 0 0113.4-13.4c3.2 0 6.2 1.2 8.5 3.1l5.4-5.4A22.5 22.5 0 0024 2C11.9 2 2 11.9 2 24s9.9 22 22 22c13.1 0 21.8-9.2 21.8-22.1 0-1.5-.2-2.9-.4-4.3l-1.8.6z" fill="#4285F4"/></svg>
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Connect Google Search Console</h3>
            <p className="text-sm text-muted mb-6 max-w-sm mx-auto">See how many people find your site through Google — clicks, impressions, CTR, and top queries.</p>
            <button
              onClick={handleConnectGsc}
              disabled={gscConnecting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-60"
            >
              {gscConnecting
                ? <><div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />Connecting…</>
                : 'Connect with Google'}
            </button>
            <p className="text-xs text-muted mt-3">Your website must be verified in Google Search Console first.</p>
          </div>
        ) : gscData.connected && !gscData.siteMatched ? (
          <div className="border border-amber-400/30 bg-amber-400/5 p-6 text-center">
            <p className="text-sm font-semibold text-amber-300 mb-1">Connected — but no matching property found</p>
            <p className="text-xs text-amber-400/80 mb-4">Make sure <strong>{websiteLink}</strong> is verified in your Google Search Console account.</p>
            <button onClick={handleConnectGsc} className="text-xs underline text-amber-400 hover:text-amber-300">Reconnect</button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Total Clicks', value: gscData.summary?.clicks?.toLocaleString() ?? '0', sub: 'from Google Search' },
                { label: 'Impressions', value: gscData.summary?.impressions?.toLocaleString() ?? '0', sub: 'times shown' },
                { label: 'Avg. CTR', value: `${gscData.summary?.ctr ?? 0}%`, sub: 'click-through rate' },
                { label: 'Avg. Position', value: gscData.summary?.position ?? '—', sub: 'mean ranking' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="border border-border p-5 bg-surface-1">
                  <p className="text-xs font-medium text-muted uppercase mb-1">{label}</p>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-muted mt-1">{sub}</p>
                </div>
              ))}
            </div>
            {gscData.byDay?.length > 0 && (() => {
              const series = buildDailySeries(gscData.byDay, analyticsRange, 'clicks');
              const max = Math.max(...series.map((d) => d.value), 1);
              return (
                <div className="border border-border p-6 bg-surface-1">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Clicks per Day</p>
                  <div className="flex items-end gap-px h-24">
                    {series.map((d, i) => (
                      <div key={i} className="flex-1 h-full group relative flex flex-col justify-end">
                        <div style={{ height: `${(d.value / max) * 100}%` }} className="w-full bg-blue-500 hover:bg-blue-400 transition-colors min-h-[2px] rounded-t-sm" />
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-[#fff] px-1 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">{d.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted">
                    <span>{series[0]?.date}</span>
                    <span>{series[series.length - 1]?.date}</span>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 gap-5">
              <div className="border border-border">
                <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Top Search Queries</div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {gscData.topQueries?.length > 0 ? gscData.topQueries.map((q: any, i: any) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-white truncate flex-1 mr-2">{q.query}</span>
                        <span className="text-xs text-muted shrink-0">{q.clicks} clicks</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>{q.impressions.toLocaleString()} imp.</span>
                        <span>{q.ctr}% CTR</span>
                        <span>#{q.position}</span>
                      </div>
                    </div>
                  )) : <div className="px-4 py-8 text-center text-sm text-muted">No query data yet</div>}
                </div>
              </div>
              <div className="border border-border">
                <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Top Pages (Organic)</div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {gscData.topPages?.length > 0 ? gscData.topPages.map((p: any, i: any) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-white truncate flex-1 mr-2">{p.page.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                        <span className="text-xs text-muted shrink-0">{p.clicks} clicks</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>{p.impressions.toLocaleString()} imp.</span>
                        <span>{p.ctr}% CTR</span>
                        <span>#{p.position}</span>
                      </div>
                    </div>
                  )) : <div className="px-4 py-8 text-center text-sm text-muted">No page data yet</div>}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted text-right">
              Connected to: {gscData.siteUrl} · {gscData.dateRange?.start} → {gscData.dateRange?.end}
            </p>
          </div>
        )}
      </div>

      <style jsx global>{`
        .leaflet-container {
          background: #0b0f14;
          font-family: inherit;
        }
        .leaflet-control-zoom a {
          background: #171b22 !important;
          color: #e5e7eb !important;
          border-color: #2a303c !important;
        }
        .leaflet-control-zoom a:hover {
          background: #2a303c !important;
        }
        .leaflet-control-attribution {
          background: rgba(11, 15, 20, 0.75) !important;
          color: #9aa3af !important;
        }
        .leaflet-control-attribution a {
          color: #cbd5e1 !important;
        }
        .leaflet-popup-content-wrapper {
          background: #171b22;
          color: #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .leaflet-popup-tip {
          background: #171b22;
        }
        .leaflet-popup-content {
          font-size: 12px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
