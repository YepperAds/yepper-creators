'use client';
// @ts-nocheck

import React, { useState } from 'react';
import {
  Copy, Check, Plus, Code, MousePointer,
  Trash2, X, ChevronDown, ChevronRight, Mail, Files,
} from 'lucide-react';
import { categoryAPI } from '@/app/_lib/adsense-api';

// Only Floating and Modal are truly position-independent (position:fixed,
// appended straight to <body> — they never depend on the page's DOM
// structure). Header/Overlay/Mobile Interstitial/Bottom/proFooter used to be
// "auto" too via a querySelector('header')/querySelector('footer') guess,
// but that guess can land wrong (or not match the page's structure at all),
// with no way for the owner to override it — so everything except these two
// now goes through the iframe / Precise-Placement track instead.
const AUTO_RELIABLE = ['floating', 'modalpic'];

// Floating/Modal categories the owner explicitly set to "specific pages
// only" (see AddNewCategory.tsx's placement-mode toggle) skip the site-wide
// bundle (SiteScriptController excludes 'manual' from it) and instead get a
// <div data-yepper-space="id"> placeholder here — a real markup element, so
// it's paste-safe in JSX exactly like the iframe. The site-wide script (which
// only ever needs installing once) already scans for these divs on every
// route change and renders whichever category they reference there, complete
// with correct position:fixed/overlay CSS — no per-space script, no iframe,
// and no "which HTML file is this" question for SPA/component-based sites,
// since the div lives inside that page's own component and is discovered
// (and torn down again on navigation, along with everything else in that
// component) by the one script already running globally.
const isPageScoped = (cat) =>
  AUTO_RELIABLE.includes((cat.spaceType || '').toLowerCase()) &&
  (cat.placementMode || 'auto') === 'manual';

// ── Script tag — two flavors ─────────────────────────────────────────────────
// A raw `<script src="...">` line only means anything inside an actual HTML
// document. A .js/.jsx/.tsx file has no "just paste this line anywhere" spot —
// it's source code, not markup, so the tag needs to be *injected* by real code
// instead: created in a lifecycle hook (React's useEffect, Vue's onMounted,
// Angular's ngOnInit — same document.createElement body underneath all of
// them) inside the root layout/component that renders on every page, torn
// back down on cleanup. This is only for the ONE main site-wide script — it's
// installed exactly once, ever, regardless of how many ad spaces exist.
function buildScriptTag(src) {
  return `<script src="${src}" async></script>`;
}

function buildScriptTagJs(src) {
  return [
    `useEffect(() => {`,
    `  const s = document.createElement('script');`,
    `  s.src = '${src}';`,
    `  s.async = true;`,
    `  document.body.appendChild(s);`,
    `  return () => { try { document.body.removeChild(s); } catch (e) {} };`,
    `}, []);`,
  ].join('\n');
}

// ── Placeholder div — for Floating/Modal spaces scoped to specific pages ────
// A real markup element (like the iframe below), not an injection — paste it
// directly in whichever page's JSX/template you want that ad to show on. The
// site-wide script (already installed once, globally) scans for these on
// every route change and renders the referenced category right there, with
// correct position:fixed/overlay CSS built in — no second script to add, no
// "which HTML file" question, and it disappears on its own when the page
// unmounts since the div (and whatever the script appended inside it) leaves
// the DOM together with the rest of that page.
function buildPlaceholderDiv(categoryId) {
  return `<div data-yepper-space="${categoryId}"></div>`;
}

// ── Iframe embed sizing per spaceType ──────────────────────────────────────────
// Standard ad-unit sizes (industry-standard, same ones AdSense/Carbon Ads
// use) keyed by spaceType — picked so the box reads naturally wherever that
// type usually sits (a 728x90 leaderboard for header/in-feed/above-the-fold, a
// narrow 160x600 skyscraper for rails, etc). Owners can resize the iframe
// attributes freely; this is just a sane default. Floating/Modal aren't here —
// they use buildPlaceholderDiv instead, see AUTO_RELIABLE below.
function recommendedEmbedSize(spaceType) {
  const sizes = {
    'sidebar':         { w: 300, h: 250 },
    'left rail':       { w: 160, h: 600 },
    'rightrail':       { w: 160, h: 600 },
    'stickysidebar':   { w: 300, h: 250 },
    'inline content':  { w: 300, h: 250 },
    'in feed':         { w: 728, h: 90 },
    'above the fold':  { w: 728, h: 90 },
    'beneath title':   { w: 728, h: 90 },
    'header':          { w: 728, h: 90 },
    'bottom':          { w: 728, h: 90 },
    'profooter':       { w: 728, h: 90 },
  };
  return sizes[(spaceType || '').toLowerCase()] || { w: 300, h: 250 };
}

// Iframe embed — for spaceTypes the main site script can't reliably auto-place
// (sidebar, in-feed, inline content, etc). The owner drops this exactly where
// they want the ad. Because it's a separate document, a framework's own
// re-renders (React/Vue/etc. own the <iframe> element itself, never its
// contents) can't wipe it out the way they can a script-injected div, and it
// doesn't depend on the main script finding a data-yepper-space placeholder.
//
// The tag itself is IDENTICAL across every framework on purpose — no style="..."
// attribute (the JSX-vs-HTML split that kept breaking React builds: `style` must
// be an object in JSX, a string in HTML, and people paste whichever tab's code
// they grabbed first without checking). `frameBorder="0"` replaces it: HTML
// attribute names are case-insensitive so it's valid HTML as-is, and React
// recognizes the exact spelling `frameBorder` as a known DOM prop, so it's also
// valid JSX with no warnings — one snippet, paste-safe everywhere.
function buildIframeTag(src, w, h) {
  return `<iframe src="${src}" width="${w}" height="${h}" frameBorder="0" loading="lazy" title="Advertisement"></iframe>`;
}

function buildIframeEmbed(src, spaceType) {
  const { w, h } = recommendedEmbedSize(spaceType);
  return buildIframeTag(src, w, h);
}

// ── Copy button ───────────────────────────────────────────────────────────────
const CopyBtn = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-[#fff] transition-all border border-zinc-700 shrink-0"
    >
      {copied
        ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></>
        : <><Copy className="w-3 h-3" /><span>Copy</span></>}
    </button>
  );
};

// ── Code block ────────────────────────────────────────────────────────────────
const CodeBlock = ({ code }) => (
  <div className="bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800">
    <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-red-500 opacity-60" />
        <div className="w-2 h-2 rounded-full bg-yellow-500 opacity-60" />
        <div className="w-2 h-2 rounded-full bg-green-500 opacity-60" />
      </div>
      <CopyBtn text={code} />
    </div>
    <div className="p-3 overflow-x-auto">
      {code.split('\n').map((line: any, i: any) => (
        <div key={i} className="flex min-w-max">
          <span className="text-zinc-700 select-none w-6 text-right pr-2 shrink-0 text-xs font-mono">{i + 1}</span>
          <span className="pl-2 text-xs font-mono whitespace-pre text-zinc-300">{line}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Main integration component ────────────────────────────────────────────────
export const MasterIntegration = ({ website, categories = [], onAddSpace, onDeleteCategory, onSendInvite, onPlacementModeChange, onDuplicated, earningsSummary, scriptInstalled = false }) => {
  const [open, setOpen]           = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Controls the ONE main site-wide script snippet: a raw <script> tag (plain
  // HTML sites) or a lifecycle-hook injection (React/Vue/Angular/Next — a
  // .jsx/.tsx file has nowhere to "just paste a line" the way an .html file
  // does). Every other snippet in this panel (iframe or placeholder div) is
  // real markup, valid in JSX as-is, so this switch has nothing to do there.
  const [siteKind, setSiteKind] = useState<'html' | 'component'>('html');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateLabel, setDuplicateLabel] = useState('');
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  const handleTogglePlacement = async (cat: any) => {
    const next = isPageScoped(cat) ? 'auto' : 'manual';
    setTogglingId(cat._id);
    try {
      await categoryAPI.updatePlacementMode(cat._id, { placementMode: next });
      onPlacementModeChange?.(cat._id, next);
    } catch (e) {
      alert('Failed to update placement — please try again.');
    } finally {
      setTogglingId(null);
    }
  };

  const startDuplicate = (cat: any) => {
    setDuplicatingId(cat._id);
    setDuplicateLabel('');
    setDuplicateError('');
  };

  const submitDuplicate = async (cat: any) => {
    const label = duplicateLabel.trim();
    if (!label) { setDuplicateError('Give this copy a page label, e.g. "Home page".'); return; }
    setDuplicateSubmitting(true);
    setDuplicateError('');
    try {
      await categoryAPI.duplicate(cat._id, { categoryName: `${cat.categoryName || cat.spaceType} — ${label}` });
      setDuplicatingId(null);
      onDuplicated?.();
    } catch (e: any) {
      setDuplicateError(e?.response?.message || 'Failed to duplicate ad space.');
    } finally {
      setDuplicateSubmitting(false);
    }
  };

  const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const extractSrc = (val) => {
    if (!val) return null;
    const match = val.match(/src=["']([^"']+)['"]/);
    return match ? match[1] : val;
  };
  const rawSrc = extractSrc(website?.site_script) || `${BACKEND}/api/p/site/${website?.id}`;

  const mainCode = siteKind === 'component' ? buildScriptTagJs(rawSrc) : buildScriptTag(rawSrc);

  // Spaces the main site script can't reliably auto-place — get an iframe
  // embed instead (see buildIframeEmbed). Floating/Modal are never in here:
  // they're either in the site-wide bundle (auto) or get a placeholder div
  // below (manual) — never an iframe.
  const iframeCategories = categories.filter(
    (cat: any) => !AUTO_RELIABLE.includes((cat.spaceType || '').toLowerCase())
  );

  // Floating/Modal spaces the owner explicitly scoped to specific pages —
  // a data-yepper-space div the already-installed site-wide script finds and
  // renders there (with the right position:fixed/overlay CSS) instead of
  // loading it everywhere.
  const placeholderCategories = categories.filter(isPageScoped);

  const embedCategories = [...iframeCategories, ...placeholderCategories];

  return (
    <div className="mb-8 rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">

      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Code className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-100">Integration Codes</p>
            <p className="text-xs text-zinc-500">
              {categories.length} space{categories.length !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="border-t border-zinc-700">

          {/* Site-type switch — controls every script snippet below (main +
              any page-scoped Floating/Modal ones) */}
          <div className="px-5 pt-5 flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">My site is</span>
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setSiteKind('html')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${siteKind === 'html' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                Plain HTML
              </button>
              <button
                type="button"
                onClick={() => setSiteKind('component')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-zinc-700 ${siteKind === 'component' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                React / Vue / Next / Angular
              </button>
            </div>
          </div>

          {/* Main script */}
          <div className="p-5 space-y-2">
            <CodeBlock code={mainCode} />
            {siteKind === 'component' && (
              <p className="text-xs text-zinc-500 leading-relaxed">
                Paste this inside the root layout/component that renders on every page (e.g. <code className="text-zinc-400">app/layout.tsx</code>,
                <code className="text-zinc-400"> App.vue</code>, <code className="text-zinc-400">app.component.ts</code>) — shown here as
                React's <code className="text-zinc-400">useEffect</code>; Vue/Angular use the same body inside <code className="text-zinc-400">onMounted</code>/<code className="text-zinc-400">ngOnInit</code>.
              </p>
            )}
          </div>

          {/* Ad spaces list */}
          {categories.length === 0 ? (
            <div className="border-t border-zinc-700 px-5 py-8 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <Plus className="w-5 h-5 text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-300 mb-1">No ad spaces yet</p>
                <p className="text-xs text-zinc-600">Add your first ad space to start serving ads on your site.</p>
              </div>
              <button
                onClick={onAddSpace}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-blue-700 text-blue-400 hover:bg-blue-950 hover:border-blue-500 text-xs font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add Ad Space
              </button>
            </div>
          ) : (
            <>
              {/* Spaces list with delete buttons */}
              <div className="border-t border-zinc-700">
                <div className="px-5 py-3 flex items-center justify-between border-b border-zinc-700">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    {categories.length} Ad Space{categories.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={onAddSpace}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-all"
                  >
                    <Plus className="w-3 h-3" /> Add Space
                  </button>
                </div>
                <div className="divide-y divide-zinc-800">
                  {categories.map((cat: any, idx: any) => {
                    const earning = earningsSummary?.categories?.find(e => e.categoryId?.toString() === cat._id?.toString());
                    return (
                      <div key={cat._id}>
                      <div className="px-5 py-3 flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-zinc-200">{cat.categoryName || cat.spaceType}</span>
                            <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded capitalize">{cat.spaceType}</span>
                            {AUTO_RELIABLE.includes((cat.spaceType || '').toLowerCase()) && (
                              <button
                                type="button"
                                onClick={() => handleTogglePlacement(cat)}
                                disabled={togglingId === cat._id}
                                title={isPageScoped(cat)
                                  ? 'Switch back to showing on every page'
                                  : 'Switch to showing only on pages you choose'}
                                className={`text-xs px-1.5 py-0.5 rounded border transition-colors disabled:opacity-50 ${
                                  isPageScoped(cat)
                                    ? 'text-purple-400 bg-purple-950 border-purple-800 hover:bg-purple-900'
                                    : 'text-blue-400 bg-blue-950 border-blue-800 hover:bg-blue-900'
                                }`}
                              >
                                {togglingId === cat._id ? 'updating…' : isPageScoped(cat) ? 'page-specific' : 'auto — every page'}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-600">
                            {earning?.available ? (
                              <span className="text-green-400">RWF {Number(earning.ownerEarns).toLocaleString()}/mo</span>
                            ) : (
                              <span className="italic">earnings pending traffic</span>
                            )}
                            <span>{cat.userCount} user{cat.userCount !== 1 ? 's' : ''}</span>
                            <span className="capitalize">{cat.defaultLanguage || 'English'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => startDuplicate(cat)}
                          title="Duplicate this ad space for another page — gives that page its own independently-sold ads instead of mirroring this one's"
                          className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-blue-950 text-zinc-500 hover:text-blue-400 transition-all border border-zinc-700 hover:border-blue-900 shrink-0"
                        >
                          <Files className="w-3 h-3" />
                          <span>Duplicate</span>
                        </button>
                        {onSendInvite && (
                          <button
                            onClick={() => onSendInvite(cat)}
                            title="Email someone a link to advertise on this space"
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-emerald-950 text-zinc-500 hover:text-emerald-400 transition-all border border-zinc-700 hover:border-emerald-900 shrink-0"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Invite</span>
                          </button>
                        )}
                        {onDeleteCategory && (
                          <button
                            onClick={() => onDeleteCategory(cat)}
                            title="Delete ad space"
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-red-950 text-zinc-500 hover:text-red-400 transition-all border border-zinc-700 hover:border-red-900 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                      {duplicatingId === cat._id && (
                        <div className="px-5 pb-3 -mt-1 flex items-start gap-2">
                          <div className="flex-1">
                            <input
                              autoFocus
                              value={duplicateLabel}
                              onChange={(e) => setDuplicateLabel(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') submitDuplicate(cat); if (e.key === 'Escape') setDuplicatingId(null); }}
                              placeholder='Which page is this copy for? e.g. "Home page"'
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-600"
                            />
                            {duplicateError && <p className="text-xs text-red-400 mt-1">{duplicateError}</p>}
                            {!duplicateError && (
                              <p className="text-xs text-zinc-600 mt-1">
                                Creates a separate ad space with its own tag and its own inventory — advertisers who buy
                                this one won't automatically show up on {cat.categoryName || cat.spaceType} too.
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => submitDuplicate(cat)}
                            disabled={duplicateSubmitting}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 shrink-0"
                          >
                            {duplicateSubmitting ? 'Creating…' : 'Create'}
                          </button>
                          <button
                            onClick={() => setDuplicatingId(null)}
                            className="px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-300 shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Specific-page spaces (accordion) — iframe or script per space */}
              {embedCategories.length > 0 && (
                <div className="border-t border-zinc-700">
                  <button
                    onClick={() => setShowManual(o => !o)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-zinc-100">Specific-Page Spaces</span>
                      <span className="text-xs text-zinc-500 ml-1">— one snippet per space, paste only where it goes</span>
                    </div>
                    {showManual ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                  </button>
                  {showManual && (
                    <div className="px-5 pb-5 space-y-4">
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Each space below gets its own tag, tied to its own inventory — pasting the <em>same</em> tag on two
                        different pages shows the same currently-sold ad on both at once. If a second page needs its own,
                        separately-sold ad, use <strong className="text-zinc-300">Duplicate</strong> on the space above
                        instead of copying this tag twice.
                      </p>
                      <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
                        {iframeCategories.map((cat: any, idx: any) => {
                          const embedSrc = `${BACKEND}/api/p/embed/${cat._id}`;
                          return (
                            <div key={cat._id} className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500 font-mono">{idx + 1}.</span>
                                <span className="text-xs font-semibold text-zinc-300">{cat.categoryName || cat.spaceType}</span>
                                <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded ml-auto">{cat.spaceType}</span>
                              </div>
                              <p className="text-xs text-zinc-500 leading-relaxed">
                                An <strong className="text-zinc-300">iframe</strong> — drop it exactly where you want the ad box
                                to sit in your page's markup (works as-is in JSX too, no conversion needed).
                              </p>
                              <CodeBlock code={buildIframeEmbed(embedSrc, cat.spaceType)} />
                            </div>
                          );
                        })}
                        {placeholderCategories.map((cat: any, idx: any) => (
                          <div key={cat._id} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-500 font-mono">{iframeCategories.length + idx + 1}.</span>
                              <span className="text-xs font-semibold text-zinc-300">{cat.categoryName || cat.spaceType}</span>
                              <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded ml-auto">{cat.spaceType}</span>
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed">
                              A placeholder, not a script — no second script tag needed anywhere. Drop this
                              <code className="text-zinc-400"> &lt;div&gt;</code> directly in whichever page's markup/JSX you want this
                              ad to show ({cat.spaceType?.toLowerCase() === 'floating' ? 'it floats itself into the corner' : 'it opens itself as a popup'}
                              automatically). The main script above — installed once, site-wide — finds it there and renders the ad,
                              and it goes away on its own when you navigate off that page.
                            </p>
                            <CodeBlock code={buildPlaceholderDiv(cat._id)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const CodeDisplay = () => null;
export default CodeDisplay;
