'use client';
// @ts-nocheck

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// The 8 geometric zones the injected script actually checks a space's div
// against (see detectZone in SiteScriptController.js / AdScriptController.js
// and ZONE_DEFAULT_TYPE in AdDisplayController.js). Percentages here are the
// exact same thresholds the real detector uses, not approximations — this is
// what "the zone map" actually means, not just a stylized diagram.
const ZONES = [
  { key: 'header',         label: 'Header',         color: '#ef4444', heightPct: 5,  note: 'top 0–5% of page height' },
  { key: 'above-the-fold', label: 'Above The Fold',  color: '#f97316', heightPct: 10, note: 'top 5–15%' },
  { key: 'beneath-title',  label: 'Beneath Title',   color: '#eab308', heightPct: 10, note: 'top 15–25%' },
  { key: 'left',           label: 'Left Rail',       color: '#3b82f6', note: 'leftmost 25% of page width, within the 25–78% body band' },
  { key: 'center',         label: 'Inline Content',  color: '#9ca3af', note: 'middle 50% of page width' },
  { key: 'right',          label: 'Right Rail',      color: '#22c55e', note: 'rightmost 25% of page width' },
  { key: 'pro-footer',     label: 'Pro Footer',      color: '#a855f7', heightPct: 12, note: 'bottom 78–90%' },
  { key: 'footer',         label: 'Footer',          color: '#ec4899', heightPct: 10, note: 'bottom 90–100%' },
];
const byKey = (k: string) => ZONES.find((z) => z.key === k);
const inactiveColor = '#3f3f46';
const inactiveCenter = '#27272a';

const ZoneBands = ({ zone, full }: { zone?: string | null; full?: boolean }) => (
  <div className={full ? 'w-full h-full flex flex-col' : 'w-44 h-28 flex flex-col'}>
    {['header', 'above-the-fold', 'beneath-title'].map((key) => {
      const z = byKey(key);
      const isActive = zone === key;
      return (
        <div
          key={key}
          className="w-full flex items-center justify-center relative"
          style={{ height: `${z.heightPct}%`, background: isActive ? z.color : inactiveColor, borderTop: full && key !== 'header' ? '1px solid rgba(0,0,0,0.25)' : undefined }}
        >
          {full && (
            <span className="text-white/90 text-xs font-semibold tracking-wide uppercase">{z.label} <span className="text-white/50 font-normal normal-case">({z.note})</span></span>
          )}
        </div>
      );
    })}
    <div className="flex-1 flex" style={{ borderTop: full ? '1px solid rgba(0,0,0,0.25)' : undefined, borderBottom: full ? '1px solid rgba(0,0,0,0.25)' : undefined }}>
      {['left', 'center', 'right'].map((key) => {
        const z = byKey(key);
        const isActive = zone === key;
        const base = key === 'center' ? inactiveCenter : inactiveColor;
        return (
          <div
            key={key}
            className={`h-full flex items-center justify-center ${key === 'center' ? 'flex-1' : 'w-[25%]'}`}
            style={{ background: isActive ? z.color : base, borderRight: full && key === 'left' ? '1px solid rgba(0,0,0,0.25)' : undefined, borderLeft: full && key === 'right' ? '1px solid rgba(0,0,0,0.25)' : undefined }}
          >
            {full && (
              <span className="text-white/90 text-xs font-semibold tracking-wide uppercase text-center px-2">{z.label}<br /><span className="text-white/50 font-normal normal-case">{z.note}</span></span>
            )}
          </div>
        );
      })}
    </div>
    {['pro-footer', 'footer'].map((key) => {
      const z = byKey(key);
      const isActive = zone === key;
      return (
        <div
          key={key}
          className="w-full flex items-center justify-center"
          style={{ height: `${z.heightPct}%`, background: isActive ? z.color : inactiveColor, borderTop: full ? '1px solid rgba(0,0,0,0.25)' : undefined }}
        >
          {full && (
            <span className="text-white/90 text-xs font-semibold tracking-wide uppercase">{z.label} <span className="text-white/50 font-normal normal-case">({z.note})</span></span>
          )}
        </div>
      );
    })}
  </div>
);

const ZoneMapPreview = ({ zone }: { zone?: string | null }) => {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  if (!zone) return null;
  const active = byKey(zone);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title="Click to see the full-size zone map"
        className="w-44 h-28 rounded-lg border border-zinc-700 overflow-hidden shrink-0 cursor-pointer hover:border-zinc-500 transition-colors"
      >
        <ZoneBands zone={zone} />
      </button>
      <span className="text-xs text-zinc-500">
        Last seen in: <span className="font-semibold text-zinc-900">{active?.label || zone}</span> zone
        <span className="block text-[10px] text-zinc-600">as of your site's last visitor</span>
      </span>

      {expanded && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[300] bg-black">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            title="Close"
            className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute top-4 left-4 z-10 text-white text-sm font-semibold uppercase tracking-wide">
            Last seen in: {active?.label || zone}
          </div>
          <ZoneBands zone={zone} full />
        </div>,
        document.body,
      )}
    </div>
  );
};

export default ZoneMapPreview;
