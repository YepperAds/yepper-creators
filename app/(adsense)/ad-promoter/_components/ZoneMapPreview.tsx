'use client';
// @ts-nocheck

import React from 'react';

// The 8 geometric zones the injected script actually checks a space's div
// against (see detectZone in SiteScriptController.js / AdScriptController.js
// and ZONE_DEFAULT_TYPE in AdDisplayController.js). Percentages here are the
// exact same thresholds the real detector uses, not approximations.
const ZONES = [
  { key: 'header',         label: 'Header',         color: '#ef4444', heightPct: 5 },
  { key: 'above-the-fold', label: 'Above The Fold',  color: '#f97316', heightPct: 10 },
  { key: 'beneath-title',  label: 'Beneath Title',   color: '#eab308', heightPct: 10 },
  { key: 'left',           label: 'Left Rail',       color: '#3b82f6' },
  { key: 'center',         label: 'Inline Content',  color: '#9ca3af' },
  { key: 'right',          label: 'Right Rail',      color: '#22c55e' },
  { key: 'pro-footer',     label: 'Pro Footer',      color: '#a855f7', heightPct: 12 },
  { key: 'footer',         label: 'Footer',          color: '#ec4899', heightPct: 10 },
];
const byKey = (k: string) => ZONES.find((z) => z.key === k);
const inactiveColor = '#3f3f46';
const inactiveCenter = '#27272a';

const ZoneMapPreview = ({ zone }: { zone?: string | null }) => {
  if (!zone) return null;
  const active = byKey(zone);

  return (
    <div className="flex items-center gap-2">
      <div className="w-44 h-28 border border-zinc-700 overflow-hidden shrink-0 flex flex-col bg-zinc-900">
        {['header', 'above-the-fold', 'beneath-title'].map((key) => {
          const z = byKey(key);
          return (
            <div key={key} className="w-full" style={{ height: `${z.heightPct}%`, background: zone === key ? z.color : inactiveColor }} />
          );
        })}
        <div className="flex-1 flex">
          {['left', 'center', 'right'].map((key) => {
            const z = byKey(key);
            const base = key === 'center' ? inactiveCenter : inactiveColor;
            return (
              <div
                key={key}
                className={`h-full ${key === 'center' ? 'flex-1' : 'w-[25%]'}`}
                style={{ background: zone === key ? z.color : base }}
              />
            );
          })}
        </div>
        {['pro-footer', 'footer'].map((key) => {
          const z = byKey(key);
          return (
            <div key={key} className="w-full" style={{ height: `${z.heightPct}%`, background: zone === key ? z.color : inactiveColor }} />
          );
        })}
      </div>
      <span className="text-xs text-zinc-500">
        Last seen in: <span className="font-semibold text-zinc-900">{active?.label || zone}</span> zone
        <span className="block text-[10px] text-zinc-600">as of your site's last visitor</span>
      </span>
    </div>
  );
};

export default ZoneMapPreview;
