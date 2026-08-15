'use client';
// @ts-nocheck

import React from 'react';

// Small schematic of the 5 geometric zones the injected script checks a
// space's div against (header / left / center / right / footer — see
// AdDisplayController.reportZoneDetected). Highlights whichever zone was
// last detected for this category, so an owner can see at a glance where
// their placeholder div is actually rendering without opening dev tools.
const ZONES = [
  { key: 'header', label: 'Header', color: '#ef4444' },
  { key: 'left',   label: 'Left',   color: '#eab308' },
  { key: 'center', label: 'Center', color: '#9ca3af' },
  { key: 'right',  label: 'Right',  color: '#22c55e' },
  { key: 'footer', label: 'Footer', color: '#ec4899' },
];

const ZoneMapPreview = ({ zone }: { zone?: string | null }) => {
  if (!zone) return null;
  const active = ZONES.find((z) => z.key === zone);

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-11 rounded border border-zinc-700 overflow-hidden shrink-0 flex flex-col bg-zinc-900">
        <div
          className="h-[20%] w-full"
          style={{ background: zone === 'header' ? ZONES[0].color : '#3f3f46' }}
        />
        <div className="flex-1 flex">
          <div className="w-[25%] h-full" style={{ background: zone === 'left' ? ZONES[1].color : '#3f3f46' }} />
          <div className="flex-1 h-full" style={{ background: zone === 'center' ? ZONES[2].color : '#27272a' }} />
          <div className="w-[25%] h-full" style={{ background: zone === 'right' ? ZONES[3].color : '#3f3f46' }} />
        </div>
        <div
          className="h-[18%] w-full"
          style={{ background: zone === 'footer' ? ZONES[4].color : '#3f3f46' }}
        />
      </div>
      <span className="text-xs text-zinc-500">
        Last seen in: <span className="font-semibold text-white">{active?.label || zone}</span> zone
        <span className="block text-[10px] text-zinc-600">as of your site's last visitor</span>
      </span>
    </div>
  );
};

export default ZoneMapPreview;
