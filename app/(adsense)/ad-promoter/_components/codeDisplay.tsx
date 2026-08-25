'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, Plus, Code,
  Trash2, X, ChevronDown, Mail, Files, Link2, Palette, Eye, BookOpen,
} from 'lucide-react';
import { categoryAPI } from '@/app/_lib/adsense-api';
import { getAdSpaceImage } from '@/app/_lib/ad-spaces';
import { getLanguageFlagUrl, getLanguageLabel } from '@/app/_lib/languages';
import ZoneMapPreview from './ZoneMapPreview';
import InstallGuidePanel from './InstallGuidePanel';

// Every space type now uses the same mechanism: a <div data-yepper-space>
// placeholder, checked against a configured target page (see
// WebsitePagesPanel.tsx / AddNewCategory.tsx's page picker). "All Pages"
// (target_path null) means pasting the div once in the root layout; a
// specific page means pasting it just on that page's component; either way,
// the div is what actually places the ad, and the target page is a
// verification check, not a placement mechanism: the site-wide script
// (installed once, globally) matches the div's own page against it, and
// reports a mismatch instead of silently doing nothing or rendering somewhere
// unintended (see reportPageMismatch in SiteScriptController.js). Iframe
// embeds used to be the recommendation for in-flow types (sidebar, header,
// etc.), existing ones already pasted keep working via /api/p/embed, but new
// spaces all get a div now for the same tracking every other type gets.
const isPageScoped = (cat) => !!cat.targetPath;

// ── "Check live placement" link ─────────────────────────────────────────────
// Points straight at the real page the div renders on (its own targetPath,
// or — for an "All Pages" space — the first page the site-wide script has
// actually confirmed the div on, see detectedPages/reportSpaceSeen), with
// ?yepperHighlight=<categoryId> appended. The site-wide script (already
// installed there) recognizes that flag and draws two boxes right on the
// live page: an orange outline around where the div actually is, and (for
// page-flow types) a blue band showing where that type is expected to sit —
// see showZoneHighlight in SiteScriptController.js. A real new tab rather
// than an iframe here on purpose: an iframe would need the owner's own site
// to explicitly allow being framed, a real navigation needs nothing.
function buildLiveCheckUrl(website, cat) {
  const rawDomain = website?.website_link || website?.websiteLink || website?.website_url || website?.domain;
  if (!rawDomain) return null;
  const path = cat.targetPath || (Array.isArray(cat.detectedPages) && cat.detectedPages[0]) || null;
  if (!path) return null;
  const domain = rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`;
  const base = domain.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const sep = normalizedPath.includes('?') ? '&' : '?';
  return `${base}${normalizedPath}${sep}yepperHighlight=${cat._id}`;
}

// ── Plain <script> tag ──────────────────────────────────────────────────────
// A tag, not code, dropped directly in a page's markup/JSX return, exactly
// where the placeholder div below also gets dropped. React/Vue/Angular all
// mount a <script> written in a template/JSX the same way any other DOM node
// mounts: via a real createElement+insert, which the browser executes
// normally (unlike innerHTML-inserted scripts, which don't run), no
// lifecycle hook required. Usually goes in the root layout/head so it loads
// once, site-wide (e.g. public/index.html's <head>, or a framework's root
// layout component).
function buildScriptTag(src) {
  return `<script src="${src}" async></script>`;
}

// ── Placeholder div: required for every space ──────────────────────────────
// A real markup element, not an injection, paste it directly in whichever
// page's JSX/template the ad should render on. The site-wide script
// (installed once, globally) scans for these on every route change; if the
// div's page doesn't match the space's configured target page, it
// deliberately does NOT render and reports the mismatch back instead, see
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
export const MasterIntegration = ({ website, categories = [], onAddSpace, onDeleteCategory, onSendInvite, onSetLanguage, onCustomize, onTargetPathChange, onDuplicated, earningsSummary, scriptInstalled = false }) => {
  const [open, setOpen]           = useState(true);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateLabel, setDuplicateLabel] = useState('');
  const [duplicatePagePath, setDuplicatePagePath] = useState('');
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [displayedTierOverrides, setDisplayedTierOverrides] = useState<Record<string, string | null>>({});
  const [copiedTierKey, setCopiedTierKey] = useState<string | null>(null);
  const [installGuide, setInstallGuide] = useState<{ categoryId: string; scriptSrc: string; label: string } | null>(null);
  const router = useRouter();

  const websitePages = website?.pages || [];

  // "Check live placement" — its own page (see
  // app/(adsense)/ad-promoter/pages/live-placement/[categoryId]) instead of a
  // second tab or a modal here. liveUrl/label are passed through the URL so
  // that page doesn't need to refetch the website/category just to show them;
  // the screenshot itself is fetched there, authenticated, by categoryId.
  const openLivePlacement = (cat: any, liveUrl: string) => {
    const label = cat.categoryName || cat.category_name || 'Ad space';
    router.push(`/ad-promoter/pages/live-placement/${cat._id}?liveUrl=${encodeURIComponent(liveUrl)}&label=${encodeURIComponent(label)}`);
  };

  const handleTargetPathChange = async (cat: any, targetPath: string | null) => {
    setTogglingId(cat._id);
    try {
      await categoryAPI.updateTargetPath(cat._id, targetPath);
      onTargetPathChange?.(cat._id, targetPath);
    } catch (e) {
      alert('Failed to update target page. Please try again.');
    } finally {
      setTogglingId(null);
    }
  };

  // Multi-tier ad spaces: which of the 3 slots shows publicly on the site,
  // changeable any time. Optimistic + reverts on failure, so the picker
  // feels instant instead of waiting on a round-trip.
  const changeDisplayedTier = async (cat: any, tierKey: string | null) => {
    const previous = displayedTierOverrides[cat._id] ?? cat.displayedTierKey ?? null;
    setDisplayedTierOverrides((prev) => ({ ...prev, [cat._id]: tierKey }));
    try {
      await categoryAPI.setDisplayedTier(cat._id, tierKey);
    } catch (e) {
      alert('Failed to change which slot shows on your site. Please try again.');
      setDisplayedTierOverrides((prev) => ({ ...prev, [cat._id]: previous }));
    }
  };

  // Each slot gets its own direct booking link — lets an owner sell a slot
  // that isn't the one currently showing publicly (e.g. show Elite, but
  // still privately sell the cheap slot to someone via this link).
  const copyTierLink = (cat: any, tierKey: string) => {
    const link = `${window.location.origin}/ad-owner/pages/direct-ad?websiteId=${website?.id}&categoryId=${cat._id}&tier=${tierKey}`;
    navigator.clipboard.writeText(link);
    setCopiedTierKey(`${cat._id}:${tierKey}`);
    setTimeout(() => setCopiedTierKey((k) => (k === `${cat._id}:${tierKey}` ? null : k)), 2000);
  };

  const toggleConnect = (categoryId: string) => {
    setConnectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId);
      return next;
    });
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
              A tag, not code, paste it once in your site's root HTML (e.g. <code className="text-zinc-400">public/index.html</code>'s
              <code className="text-zinc-400"> &lt;head&gt;</code>) or your framework's root layout/head
              (<code className="text-zinc-400">app/layout.tsx</code>, <code className="text-zinc-400">App.vue</code>,
              <code className="text-zinc-400"> index.html</code> for Angular), same tag either way, no hooks or lifecycle code needed.
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                  {categories.map((cat: any, idx: any) => {
                    const st = (cat.spaceType || '').toLowerCase();
                    const positionsSelf = st === 'floating' || st === 'modalpic';
                    const thumb = getAdSpaceImage(cat.spaceType, cat.categoryName);
                    const isConnected = connectedIds.has(cat._id);
                    return (
                      <div key={cat._id} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden flex flex-col">
                      {/* Big framed preview image up top, everything else below it —
                          name/description/price were dropped from here since the
                          same info already shows further down the card. Fixed,
                          generous box size (not locked to the real ad space's own
                          aspect ratio — a 728x90 banner scaled to card width comes
                          out as a barely-visible sliver, which isn't what "bigger"
                          means here) so the mockup screen is actually legible. */}
                      {thumb && (
                        <div className="p-3 pb-0">
                          <img
                            src={thumb}
                            alt={`${cat.categoryName || cat.spaceType} placement preview`}
                            className="w-full h-80 object-contain rounded-xl border border-zinc-800 bg-white"
                          />
                        </div>
                      )}

                      {/* Meta: index, space type, page targeting */}
                      <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                        <span
                          className="text-xs text-white bg-zinc-800 px-1.5 py-0.5 rounded capitalize"
                          title="What you originally chose when creating this ad space"
                        >
                          {cat.originalSpaceType || cat.spaceType}
                        </span>
                        {cat.spaceType !== cat.originalSpaceType && (
                          <span
                            className="text-xs text-orange-400 bg-orange-950 border border-orange-900 px-1.5 py-0.5 rounded"
                            title="Auto-corrected based on where this ad space's div actually renders on your page"
                          >
                            → now {cat.spaceType} · RWF {Number(cat.price || 0).toLocaleString()}
                          </span>
                        )}
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
                          <option value="">All Pages (every page)</option>
                          {websitePages.map((p: any) => (
                            <option key={p.path} value={p.path}>{p.label}</option>
                          ))}
                          {cat.targetPath && !websitePages.some((p: any) => p.path === cat.targetPath) && (
                            <option value={cat.targetPath}>{cat.targetPath}</option>
                          )}
                        </select>
                        <span className="text-xs text-zinc-600">{cat.userCount} user{cat.userCount !== 1 ? 's' : ''}</span>
                        {onSetLanguage && (
                          <button
                            onClick={() => onSetLanguage(cat)}
                            title="Set the language this ad space's copy (e.g. 'Ad Space Available') is shown in"
                            className="flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded text-xs font-medium bg-zinc-800 hover:bg-orange-950 text-white hover:text-orange-400 border border-zinc-700 hover:border-orange-900 transition-all"
                          >
                            <img src={getLanguageFlagUrl(cat.defaultLanguage)} alt="" className="w-4 h-3 object-cover rounded-[2px] shrink-0" />
                            {getLanguageLabel(cat.defaultLanguage)}
                          </button>
                        )}
                      </div>

                      {/* Where the script last found this space's div
                          actually rendering — geometric zone check, see
                          AdDisplayController.reportZoneDetected. Only shows
                          once the site's had at least one real visitor. */}
                      {cat.lastDetectedZone && (
                        <div className="px-4 pt-3">
                          <ZoneMapPreview zone={cat.lastDetectedZone} />
                        </div>
                      )}

                      {/* Multi-tier ad spaces only: which of the 3 slots
                          shows publicly on the site, changeable any time.
                          Whichever one isn't showing can still be sold
                          directly via its own copy-link button below. */}
                      {Array.isArray(cat.pricingTiers) && cat.pricingTiers.length > 0 && (() => {
                        const liveKey = displayedTierOverrides[cat._id] !== undefined
                          ? displayedTierOverrides[cat._id]
                          : (cat.displayedTierKey ?? [...cat.pricingTiers].sort((a: any, b: any) => a.price - b.price)[0]?.key);
                        return (
                          <div className="px-4 pt-3">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Showing on your site</p>
                            <div className="flex flex-col gap-1.5">
                              {cat.pricingTiers.map((t: any) => {
                                const isLive = liveKey === t.key;
                                const justCopied = copiedTierKey === `${cat._id}:${t.key}`;
                                return (
                                  <div
                                    key={t.key}
                                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border flex-wrap ${
                                      isLive ? 'bg-orange-950 border-orange-900' : 'bg-zinc-800 border-zinc-700'
                                    }`}
                                  >
                                    <span className="text-xs font-medium text-white">
                                      {t.label} · RWF {Number(t.advertiserPrice ?? t.price).toLocaleString()}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => changeDisplayedTier(cat, t.key)}
                                        disabled={isLive}
                                        title={isLive ? `${t.label} is showing on your site` : `Show the ${t.label} slot publicly instead`}
                                        className={`px-2 py-1 rounded text-[11px] font-semibold text-white transition-all ${
                                          isLive ? 'bg-orange-600 cursor-default' : 'bg-zinc-700 hover:bg-zinc-600'
                                        }`}
                                      >
                                        {isLive ? 'Live' : 'Turn on'}
                                      </button>
                                      <button
                                        onClick={() => copyTierLink(cat, t.key)}
                                        title={`Copy a direct booking link for the ${t.label} slot`}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-white transition-all ${
                                          justCopied ? 'bg-emerald-700' : 'bg-zinc-700 hover:bg-emerald-700'
                                        }`}
                                      >
                                        {justCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                        <span>{justCopied ? 'Copied' : 'Copy link'}</span>
                                      </button>
                                      {onSendInvite && (
                                        <button
                                          onClick={() => onSendInvite(cat, t)}
                                          title={`Email someone a link to book the ${t.label} slot`}
                                          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-white bg-zinc-700 hover:bg-emerald-700 transition-all"
                                        >
                                          <Mail className="w-3 h-3" />
                                          <span>Invite</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="p-4 pt-3 flex flex-wrap gap-2 mt-auto">
                        <button
                          onClick={() => toggleConnect(cat._id)}
                          title="Show the code snippet that places this ad space on your site"
                          className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-all border shrink-0 text-white ${
                            isConnected
                              ? 'bg-orange-700 border-orange-700 hover:bg-orange-600'
                              : 'bg-orange-600 border-orange-600 hover:bg-orange-500'
                          }`}
                        >
                          <Link2 className="w-3 h-3 text-white" />
                          <span>{isConnected ? 'Hide code' : 'Connect it to your website'}</span>
                        </button>
                        <button
                          onClick={() => startDuplicate(cat)}
                          title="Duplicate this ad space for another page, gives that page its own independently-sold ads instead of mirroring this one's"
                          className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-blue-950 text-white hover:text-blue-400 transition-all border border-zinc-700 hover:border-blue-900 shrink-0"
                        >
                          <Files className="w-3 h-3" />
                          <span>Duplicate</span>
                        </button>
                        {(() => {
                          const liveUrl = buildLiveCheckUrl(website, cat);
                          return (
                            <button
                              onClick={() => liveUrl && openLivePlacement(cat, liveUrl)}
                              disabled={!liveUrl}
                              title={liveUrl
                                ? 'Preview your live site right here, with this space\'s actual position circled in orange, and (for page-flow types) where it should sit circled in blue'
                                : 'No confirmed page yet for this space — visit your site once with the ad script installed, then try again'}
                              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-orange-950 text-white hover:text-orange-400 transition-all border border-zinc-700 hover:border-orange-900 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:hover:text-white"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Check live placement</span>
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => {
                            const label = cat.categoryName || cat.category_name || 'Ad space';
                            setInstallGuide({ categoryId: cat._id, scriptSrc: rawSrc, label });
                          }}
                          title="Step-by-step guide for pasting the script and this space's div, for Next.js, plain HTML, WordPress, React, and Wix/Squarespace"
                          className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-emerald-950 text-white hover:text-emerald-400 transition-all border border-zinc-700 hover:border-emerald-900 shrink-0"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Installation guide</span>
                        </button>
                        {onCustomize && (
                          <button
                            onClick={() => onCustomize(cat._id)}
                            title={cat.customization ? 'Edit this ad space\'s custom styling' : 'Customize how this ad space looks'}
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-purple-950 text-white hover:text-purple-400 transition-all border border-zinc-700 hover:border-purple-900 shrink-0"
                          >
                            <Palette className="w-3 h-3" />
                            <span>{cat.customization ? 'Edit Customization' : 'Customize'}</span>
                          </button>
                        )}
                        {/* Tiered spaces get an Invite button per slot, inside
                            each slot's own box above — a single space-wide
                            Invite here would be ambiguous about which slot's
                            price/link it's for, so it's only shown for
                            plain, single-price spaces. */}
                        {onSendInvite && !(Array.isArray(cat.pricingTiers) && cat.pricingTiers.length > 0) && (
                          <button
                            onClick={() => onSendInvite(cat)}
                            title="Email someone a link to advertise on this space"
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-emerald-950 text-white hover:text-emerald-400 transition-all border border-zinc-700 hover:border-emerald-900 shrink-0"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Invite</span>
                          </button>
                        )}
                        {onDeleteCategory && (
                          <button
                            onClick={() => onDeleteCategory(cat)}
                            title="Delete ad space"
                            className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-red-950 text-white hover:text-red-400 transition-all border border-zinc-700 hover:border-red-900 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                      {duplicatingId === cat._id && (
                        <div className="px-4 pb-4 -mt-1 flex items-start gap-2">
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
                            {duplicateError && <p className="text-xs text-red-600 mt-1">{duplicateError}</p>}
                            {!duplicateError && (
                              <p className="text-xs text-zinc-600 mt-1">
                                Creates a separate ad space with its own tag and its own inventory; advertisers who buy
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

                      {/* This space's own placement div, right here instead of
                          in a separate list you'd have to cross-reference by
                          number: the whole point of pairing them is not
                          having to scroll back and forth to match a space to
                          its code. Collapsed by default behind "Connect it to
                          your website" so the list reads as a visual gallery
                          first, code second. */}
                      {isConnected && (
                        <div className="px-4 pb-4 flex flex-col gap-2 border-t border-zinc-200 pt-3">
                          <p className="text-xs text-zinc-600 leading-relaxed">
                            {st !== 'floating' && (positionsSelf
                              ? <>Positions itself automatically (popup overlay), the div's
                                  spot in your markup doesn't matter, only which page it's on. </>
                              : <>Renders right where you paste it, drop this div exactly where you want the ad box to sit in
                                  your page's layout. </>)} {cat.targetPath
                              ? <>Set to the <strong className="text-zinc-900">{cat.targetPath}</strong> page; the dropdown above
                                  is set to that page, and the ad won't show (and you'll get notified) if this div ends up
                                  somewhere else.</>
                              : <>Set to <strong className="text-zinc-900">All Pages</strong>{positionsSelf ? ': paste it once in your root layout so it\'s on every page, same as the main script above.' : ': paste it on every page you want this ad to appear on.'}</>}
                            {' '}Pasting the <em>same</em> div on two different pages shows the same currently-sold ad on
                            both; for a second page's own, separately-sold ad, use <strong className="text-zinc-900">Duplicate</strong> instead.
                          </p>
                          <CodeBlock code={buildPlaceholderDiv(cat._id)} />
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <InstallGuidePanel
        open={!!installGuide}
        onClose={() => setInstallGuide(null)}
        categoryId={installGuide?.categoryId || ''}
        scriptSrc={installGuide?.scriptSrc || ''}
        label={installGuide?.label || ''}
      />
    </div>
  );
};

const CodeDisplay = () => null;
export default CodeDisplay;
