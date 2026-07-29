'use client';
// @ts-nocheck

import React, { useState } from 'react';
import {
  Copy, Check, Plus, Code, MousePointer,
  Trash2, X, ChevronDown, ChevronRight, Mail, Files,
} from 'lucide-react';
import { categoryAPI } from '@/app/_lib/adsense-api';

// Every space type now uses the same mechanism — a <div data-yepper-space>
// placeholder, checked against a configured target page (see
// WebsitePagesPanel.tsx / AddNewCategory.tsx's page picker). "All Pages"
// (target_path null) means pasting the div once in the root layout; a
// specific page means pasting it just on that page's component — either way,
// the div is what actually places the ad, and the target page is a
// verification check, not a placement mechanism: the site-wide script
// (installed once, globally) matches the div's own page against it, and
// reports a mismatch instead of silently doing nothing or rendering somewhere
// unintended (see reportPageMismatch in SiteScriptController.js). Iframe
// embeds used to be the recommendation for in-flow types (sidebar, header,
// etc.) — existing ones already pasted keep working via /api/p/embed, but new
// spaces all get a div now for the same tracking every other type gets.
const isPageScoped = (cat) => !!cat.targetPath;

// ── Plain <script> tag ──────────────────────────────────────────────────────
// A tag, not code — dropped directly in a page's markup/JSX return, exactly
// where the placeholder div below also gets dropped. React/Vue/Angular all
// mount a <script> written in a template/JSX the same way any other DOM node
// mounts: via a real createElement+insert, which the browser executes
// normally (unlike innerHTML-inserted scripts, which don't run) — no
// lifecycle hook required. Usually goes in the root layout/head so it loads
// once, site-wide (e.g. public/index.html's <head>, or a framework's root
// layout component).
function buildScriptTag(src) {
  return `<script src="${src}" async></script>`;
}

// ── Placeholder div — required for every space ──────────────────────────────
// A real markup element, not an injection — paste it directly in whichever
// page's JSX/template the ad should render on. The site-wide script
// (installed once, globally) scans for these on every route change; if the
// div's page doesn't match the space's configured target page, it
// deliberately does NOT render and reports the mismatch back instead — see
// reportPageMismatch in SiteScriptController.js.
function buildPlaceholderDiv(categoryId) {
  return `<div data-yepper-space="${categoryId}"></div>`;
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
export const MasterIntegration = ({ website, categories = [], onAddSpace, onDeleteCategory, onSendInvite, onTargetPathChange, onDuplicated, earningsSummary, scriptInstalled = false }) => {
  const [open, setOpen]           = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateLabel, setDuplicateLabel] = useState('');
  const [duplicatePagePath, setDuplicatePagePath] = useState('');
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  const websitePages = website?.pages || [];

  const handleTargetPathChange = async (cat: any, targetPath: string | null) => {
    setTogglingId(cat._id);
    try {
      await categoryAPI.updateTargetPath(cat._id, targetPath);
      onTargetPathChange?.(cat._id, targetPath);
    } catch (e) {
      alert('Failed to update target page — please try again.');
    } finally {
      setTogglingId(null);
    }
  };

  const startDuplicate = (cat: any) => {
    setDuplicatingId(cat._id);
    setDuplicateLabel('');
    setDuplicatePagePath('');
    setDuplicateError('');
  };

  const submitDuplicate = async (cat: any) => {
    const usePagePicker = websitePages.length > 0;
    let payload: { pageLabel: string; targetPath: string | null };

    if (usePagePicker) {
      if (!duplicatePagePath) { setDuplicateError('Pick which page this copy is for.'); return; }
      if (duplicatePagePath === '__all__') {
        payload = { pageLabel: 'All Pages', targetPath: null };
      } else {
        const page = websitePages.find((p: any) => p.path === duplicatePagePath);
        payload = { pageLabel: page?.label || duplicatePagePath, targetPath: duplicatePagePath };
      }
    } else {
      const label = duplicateLabel.trim();
      if (!label) { setDuplicateError('Give this copy a page label, e.g. "Home page".'); return; }
      payload = { pageLabel: label, targetPath: null };
    }

    setDuplicateSubmitting(true);
    setDuplicateError('');
    try {
      await categoryAPI.duplicate(cat._id, payload);
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

  const mainCode = buildScriptTag(rawSrc);

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

          {/* Main script */}
          <div className="p-5 space-y-2">
            <CodeBlock code={mainCode} />
            <p className="text-xs text-zinc-500 leading-relaxed">
              A tag, not code — paste it once in your site's root HTML (e.g. <code className="text-zinc-400">public/index.html</code>'s
              <code className="text-zinc-400"> &lt;head&gt;</code>) or your framework's root layout/head
              (<code className="text-zinc-400">app/layout.tsx</code>, <code className="text-zinc-400">App.vue</code>,
              <code className="text-zinc-400"> index.html</code> for Angular) — same tag either way, no hooks or lifecycle code needed.
            </p>
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
                            <select
                              value={cat.targetPath || ''}
                              onChange={(e) => handleTargetPathChange(cat, e.target.value || null)}
                              disabled={togglingId === cat._id}
                              title="Which page this ad shows on"
                              className={`text-xs pl-1.5 pr-1 py-0.5 rounded border bg-zinc-950 disabled:opacity-50 ${
                                isPageScoped(cat)
                                  ? 'text-purple-400 border-purple-800'
                                  : 'text-blue-400 border-blue-800'
                              }`}
                            >
                              <option value="">All Pages — every page</option>
                              {websitePages.map((p: any) => (
                                <option key={p.path} value={p.path}>{p.label}</option>
                              ))}
                              {cat.targetPath && !websitePages.some((p: any) => p.path === cat.targetPath) && (
                                <option value={cat.targetPath}>{cat.targetPath}</option>
                              )}
                            </select>
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
                            {websitePages.length > 0 ? (
                              <select
                                autoFocus
                                value={duplicatePagePath}
                                onChange={(e) => setDuplicatePagePath(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-blue-600"
                              >
                                <option value="" disabled>Which page is this copy for?</option>
                                <option value="__all__">All Pages</option>
                                {websitePages.map((p: any) => (
                                  <option key={p.path} value={p.path}>{p.label} ({p.path})</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                autoFocus
                                value={duplicateLabel}
                                onChange={(e) => setDuplicateLabel(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitDuplicate(cat); if (e.key === 'Escape') setDuplicatingId(null); }}
                                placeholder='Which page is this copy for? e.g. "Home page"'
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-600"
                              />
                            )}
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

              {/* Precise-Placement Spaces (accordion) — one placeholder div per space */}
              {categories.length > 0 && (
                <div className="border-t border-zinc-700">
                  <button
                    onClick={() => setShowManual(o => !o)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-zinc-100">Precise-Placement Spaces</span>
                      <span className="text-xs text-zinc-500 ml-1">— one div per space, paste exactly where it goes</span>
                    </div>
                    {showManual ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                  </button>
                  {showManual && (
                    <div className="px-5 pb-5 space-y-4">
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        Each space below gets its own div, tied to its own inventory — pasting the <em>same</em> div on two
                        different pages shows the same currently-sold ad on both at once. If a second page needs its own,
                        separately-sold ad, use <strong className="text-zinc-300">Duplicate</strong> on the space above
                        instead of copying this div twice.
                      </p>
                      <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
                        {categories.map((cat: any, idx: any) => {
                          const st = (cat.spaceType || '').toLowerCase();
                          const positionsSelf = st === 'floating' || st === 'modalpic';
                          return (
                            <div key={cat._id} className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500 font-mono">{idx + 1}.</span>
                                <span className="text-xs font-semibold text-zinc-300">{cat.categoryName || cat.spaceType}</span>
                                <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded ml-auto">{cat.spaceType}</span>
                              </div>
                              <p className="text-xs text-zinc-500 leading-relaxed">
                                {positionsSelf
                                  ? <>Positions itself automatically ({st === 'floating' ? 'floating corner' : 'popup overlay'}) — the div's
                                      spot in your markup doesn't matter, only which page it's on.</>
                                  : <>Renders right where you paste it — drop this div exactly where you want the ad box to sit in
                                      your page's layout.</>} {cat.targetPath
                                  ? <>Set to the <strong className="text-zinc-300">{cat.targetPath}</strong> page — the dropdown above
                                      is set to that page, and the ad won't show (and you'll get notified) if this div ends up
                                      somewhere else.</>
                                  : <>Set to <strong className="text-zinc-300">All Pages</strong>{positionsSelf ? ' — paste it once in your root layout so it\'s on every page, same as the main script above.' : ' — paste it on every page you want this ad to appear on.'}</>}
                              </p>
                              <CodeBlock code={buildPlaceholderDiv(cat._id)} />
                            </div>
                          );
                        })}
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
