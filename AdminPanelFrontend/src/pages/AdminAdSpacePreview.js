// admin/pages/AdminAdSpacePreview.js
//
// Internal design-review tool: shows every ad space type the system supports
// (see backend/models/PricingModel.js SPACE_TYPES), placed where it would
// realistically sit on a real news site, so it's easy to eyeball how each
// one actually looks without needing a live website to check against.
//
// The "Advertise Here" / "Continue" card below is a faithful copy of the
// real empty-slot widget markup (see backend/AdPromoter/controllers/
// SiteScriptController.js's injectStyles / AdDisplayController's
// tierFillerHtml + availableSlotHtml) — same fonts, colors, shadow, radius —
// not a separate mockup design. If that widget's CSS changes, update AdSlot
// here to match so this stays a true preview, not a stale one.
import React, { useState } from 'react';

// Mirrors backend/AdPromoter/utils/adSpaceLayout.js's AD_SPACE_DIMENSIONS.
const AD_DIMS = {
  'Header':          { w: 728,  h: 90,  shape: 'banner' },
  'Above The Fold':  { w: 728,  h: 90,  shape: 'banner' },
  'Beneath Title':   { w: 728,  h: 90,  shape: 'banner' },
  'Pro Footer':      { w: 728,  h: 90,  shape: 'banner' },
  'Footer':          { w: 728,  h: 90,  shape: 'banner' },
  'Sidebar':         { w: 300,  h: 250, shape: 'box' },
  'Sticky Sidebar':  { w: 300,  h: 250, shape: 'box' },
  'Inline Content':  { w: 300,  h: 250, shape: 'box' },
  'Floating':        { w: 340,  h: 360, shape: 'box' },
  'Left Rail':       { w: 160,  h: 600, shape: 'box' },
  'Right Rail':      { w: 160,  h: 600, shape: 'box' },
  'Modal':           { w: 900,  h: 600, shape: 'box' },
  'Pre-roll':        { w: 1280, h: 720, shape: 'box' },
  'Mid-roll':        { w: 1280, h: 720, shape: 'box' },
  'Pause':           { w: 1280, h: 720, shape: 'box' },
};

const CARD = { background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(31,38,135,0.18)', boxSizing: 'border-box' };
const CTA  = { display: 'inline-flex', alignItems: 'center', flexShrink: 0, background: '#000', color: '#fff', padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' };
const TXT  = { fontFamily: 'Arial, Helvetica, sans-serif', color: '#111', fontWeight: 400 };

function AdSlot({ type, accent = '#000' }) {
  const dims = AD_DIMS[type];
  const isBanner = dims.shape === 'banner';
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: dims.w, margin: '0 auto' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {type} &middot; {dims.w}&times;{dims.h}
      </div>
      <div
        style={{
          ...CARD,
          width: '100%',
          aspectRatio: `${dims.w} / ${dims.h}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isBanner ? 'space-between' : 'center',
          flexDirection: isBanner ? 'row' : 'column',
          gap: isBanner ? 16 : 8,
          padding: isBanner ? '0 24px' : '16px',
          textAlign: isBanner ? 'left' : 'center',
        }}
      >
        <span style={{ ...TXT, fontSize: isBanner ? 'clamp(13px,2.2vw,22px)' : 16 }}>Advertise Here</span>
        <a style={{ ...CTA, background: accent }}>Continue</a>
      </div>
    </div>
  );
}

// ── Video placements: Pre-roll / Mid-roll / Pause only make sense inside an
// actual video player, at three different moments of playback, so they're
// grouped as one small "video article" demo rather than three separate
// floating boxes. ──────────────────────────────────────────────────────────
function VideoAdDemo({ accent }) {
  const stages = [
    { type: 'Pre-roll', caption: 'Shown before the video starts playing' },
    { type: 'Mid-roll',  caption: 'Shown at a break partway through' },
    { type: 'Pause',     caption: 'Shown when the viewer pauses' },
  ];
  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 12, padding: 20, background: '#fafafa' }}>
      <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Video placements
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
        {stages.map((s) => (
          <div key={s.type}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#1a1a1a', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#555', fontSize: 40 }}>&#9654;</span>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ ...CARD, width: '82%', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ ...TXT, fontSize: 13 }}>Advertise Here</span>
                  <a style={{ ...CTA, background: accent, padding: '7px 14px', fontSize: 12 }}>Continue</a>
                </div>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#888' }}>{s.type}: {s.caption}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const PARA = 'This is placeholder body text standing in for a real article, just enough copy to show how an inline ad space sits between paragraphs on the page.';

// ── Layout 1: classic broadsheet ─────────────────────────────────────────
function ClassicLayout() {
  const accent = '#111';
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0' }}><AdSlot type="Header" accent={accent} /></div>

      <div style={{ padding: '20px 24px', borderTop: '1px solid #eee', borderBottom: '3px double #222', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 700 }}>The Daily Chronicle</span>
        <span style={{ fontSize: 12, color: '#888' }}>Classic Layout</span>
      </div>

      <div style={{ padding: '20px 24px' }}><AdSlot type="Above The Fold" accent={accent} /></div>

      <div style={{ display: 'flex', gap: 20, padding: '0 24px 24px', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}><AdSlot type="Left Rail" accent={accent} /></div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, lineHeight: 1.25, margin: '0 0 14px' }}>
            City Council Approves New Downtown Development Plan
          </h1>
          <div style={{ margin: '0 0 16px' }}><AdSlot type="Beneath Title" accent={accent} /></div>
          <p style={{ color: '#333', lineHeight: 1.7, margin: '0 0 16px' }}>{PARA} {PARA}</p>
          <div style={{ float: 'right', margin: '0 0 16px 20px' }}><AdSlot type="Inline Content" accent={accent} /></div>
          <p style={{ color: '#333', lineHeight: 1.7, margin: '0 0 16px' }}>{PARA}</p>
          <div style={{ clear: 'both' }} />

          <div style={{ margin: '24px 0' }}><VideoAdDemo accent={accent} /></div>

          <p style={{ color: '#333', lineHeight: 1.7, margin: '0 0 16px' }}>{PARA} {PARA}</p>

          <div style={{ margin: '24px 0', padding: '24px', border: '1px dashed #ccc', borderRadius: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modal (appears as a popup over the page)</p>
            <AdSlot type="Modal" accent={accent} />
          </div>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <AdSlot type="Sticky Sidebar" accent={accent} />
          <AdSlot type="Sidebar" accent={accent} />
        </div>

        <div style={{ flexShrink: 0 }}><AdSlot type="Right Rail" accent={accent} /></div>
      </div>

      <div style={{ borderTop: '1px solid #eee', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AdSlot type="Pro Footer" accent={accent} />
        <AdSlot type="Footer" accent={accent} />
        <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', margin: 0 }}>&copy; The Daily Chronicle &middot; placeholder site footer</p>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ padding: 20, border: '1px dashed #ccc', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Floating (fixed corner overlay)</p>
          <AdSlot type="Floating" accent={accent} />
        </div>
      </div>
    </div>
  );
}

// ── Layout 2: modern portal / magazine grid ──────────────────────────────
function MagazineLayout() {
  const accent = '#E8472B';
  const Card = ({ title }) => (
    <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '4 / 3', background: '#e9e9e9' }} />
      <div style={{ padding: 12 }}>
        <p style={{ margin: 0, fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{title}</p>
      </div>
    </div>
  );

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0' }}><AdSlot type="Header" accent={accent} /></div>

      <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111' }}>
        <span style={{ fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: -0.5 }}>PULSE<span style={{ color: accent }}>.</span></span>
        <div style={{ display: 'flex', gap: 16 }}>
          {['World', 'Business', 'Tech', 'Sport'].map((c) => (
            <span key={c} style={{ color: '#ccc', fontSize: 13, fontFamily: 'Arial, sans-serif' }}>{c}</span>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#888' }}>Magazine Layout</span>
      </div>

      <div style={{ padding: '20px 24px' }}><AdSlot type="Above The Fold" accent={accent} /></div>

      <div style={{ display: 'flex', gap: 20, padding: '0 24px 24px', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}><AdSlot type="Left Rail" accent={accent} /></div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: 'Arial, sans-serif', fontSize: 22, margin: '0 0 14px' }}>Featured: Local Startup Raises Seed Funding</h2>
          <div style={{ margin: '0 0 16px' }}><AdSlot type="Beneath Title" accent={accent} /></div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, margin: '0 0 20px' }}>
            <Card title="Regional Trade Talks Resume This Week" />
            <Card title="New Transit Line Opens Downtown" />
            <Card title="Weekend Weather Outlook" />
          </div>

          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trending</p>
          <div style={{ border: '1px solid #eee', borderRadius: 10, padding: '4px 16px' }}>
            <p style={{ padding: '10px 0', margin: 0, borderBottom: '1px solid #f0f0f0', fontSize: 14 }}>1. Currency exchange rate update</p>
            <div style={{ padding: '16px 0' }}><AdSlot type="Inline Content" accent={accent} /></div>
            <p style={{ padding: '10px 0', margin: 0, fontSize: 14 }}>2. Local team advances to finals</p>
          </div>

          <div style={{ margin: '24px 0' }}><VideoAdDemo accent={accent} /></div>

          <div style={{ margin: '24px 0', padding: '24px', border: '1px dashed #ccc', borderRadius: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modal (appears as a popup over the page)</p>
            <AdSlot type="Modal" accent={accent} />
          </div>
        </div>

        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <AdSlot type="Sticky Sidebar" accent={accent} />
          <AdSlot type="Sidebar" accent={accent} />
        </div>

        <div style={{ flexShrink: 0 }}><AdSlot type="Right Rail" accent={accent} /></div>
      </div>

      <div style={{ borderTop: '1px solid #eee', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, background: '#fafafa' }}>
        <AdSlot type="Pro Footer" accent={accent} />
        <AdSlot type="Footer" accent={accent} />
        <p style={{ textAlign: 'center', fontSize: 12, color: '#aaa', margin: 0 }}>&copy; Pulse &middot; placeholder site footer</p>
      </div>

      <div style={{ padding: '0 24px 24px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ padding: 20, border: '1px dashed #ccc', borderRadius: 12, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#999', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Floating (fixed corner overlay)</p>
          <AdSlot type="Floating" accent={accent} />
        </div>
      </div>
    </div>
  );
}

const LAYOUTS = [
  { key: 'classic',   label: 'Classic Broadsheet', Component: ClassicLayout },
  { key: 'magazine',  label: 'Modern Portal',      Component: MagazineLayout },
];

export default function AdminAdSpacePreview() {
  const [active, setActive] = useState('classic');
  const { Component } = LAYOUTS.find((l) => l.key === active);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>Ad Space Preview</h2>
        <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
          Every ad space type, placed where it would sit on a real site, in the same look the live "Advertise Here" widget actually renders. Switch layout to see how the same slots sit in a different site design.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {LAYOUTS.map((l) => (
          <button
            key={l.key}
            onClick={() => setActive(l.key)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: active === l.key ? '1.5px solid #111' : '1.5px solid #e2e8f0',
              background: active === l.key ? '#111' : '#fff',
              color: active === l.key ? '#fff' : '#555',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <Component />
    </div>
  );
}
