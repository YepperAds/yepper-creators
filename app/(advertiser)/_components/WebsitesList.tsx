'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowPathIcon,
  GlobeAltIcon,
  ChartBarIcon,
  PlusCircleIcon,
  XMarkIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import WebsiteDetails from '@/app/(adsense)/ad-promoter/pages/website/[websiteId]/page';
import PanelHeader from '@/app/_components/dashboard/PanelHeader';

interface Website {
  id:          string | number;
  websiteName: string;
  websiteLink: string;
  imageUrl:    string | null;
}

// Extracted from the standalone /connect-website route so the dashboard's
// in-place "Your websites" panel can reuse the exact same list + disconnect
// flow. `addWebsiteHref` lets the dashboard point "Add Website" at the
// in-panel route (/?panel=add-website) instead of the standalone page.
// "View Details" expands a website's full details (tabs, ad spaces,
// analytics) inline in place of its card row, rather than navigating away.
export default function WebsitesList({
  addWebsiteHref = '/ad-promoter/pages/add-website',
  initialExpandedId,
}: {
  addWebsiteHref?: string;
  initialExpandedId?: string | number;
} = {}) {
  const router = useRouter();
  const [websites,           setWebsites]           = useState<Website[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');
  const [disconnecting,      setDisconnecting]      = useState<Website | null>(null);
  const [confirmText,        setConfirmText]        = useState('');
  const [disconnectLoading,  setDisconnectLoading]  = useState(false);
  const [expandedId,         setExpandedId]         = useState<string | null>(
    initialExpandedId != null ? String(initialExpandedId) : null,
  );
  // Stored image_url can point at a dead/wrong-content URL (a site's SPA
  // catch-all 200ing a path that was never really deployed, a favicon that
  // moved, etc.) — auto-detection on the site's own script prevents new bad
  // saves, but doesn't retroactively fix whatever's already stored. This
  // catches the actual broken-image failure client-side and falls back to
  // the globe icon instead of showing a broken image forever.
  const [brokenLogoIds, setBrokenLogoIds] = useState<Set<string>>(new Set());
  const markLogoBroken = (id: string | number) =>
    setBrokenLogoIds((prev) => new Set(prev).add(String(id)));

  // Website IDs with at least one currently-active (approved, not rejected,
  // status:'active') paid ad on any of their ad spaces — the domain edit is
  // locked for these, since changing it would immediately break that ad's
  // placement (SiteScriptController's referer check compares against the
  // new domain right away).
  const [activeAdWebsiteIds, setActiveAdWebsiteIds] = useState<Set<string>>(new Set());

  const fetchActiveAdWebsiteIds = useCallback(async () => {
    try {
      const res  = await fetch('/api/proxy/api/ad-categories/active-ads', { credentials: 'include', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      const activeAds: Array<{ websiteSelections?: Array<{ websiteId: string; approved?: boolean; isRejected?: boolean; status?: string }> }> =
        json?.activeAds ?? [];
      const ids = new Set<string>();
      activeAds.forEach((ad) => {
        (ad.websiteSelections ?? []).forEach((s) => {
          if (s.approved && !s.isRejected && s.status === 'active') ids.add(String(s.websiteId));
        });
      });
      setActiveAdWebsiteIds(ids);
    } catch {
      // Non-critical: worst case the domain edit stays available a beat
      // longer than it should, the backend still enforces the real check.
    }
  }, []);

  // ── Inline edit: website name (always allowed) ──────────────────────────
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft,     setNameDraft]     = useState('');
  const [nameSaving,    setNameSaving]    = useState(false);

  const startEditName = (site: Website) => {
    setEditingNameId(String(site.id));
    setNameDraft(site.websiteName);
  };
  const saveName = async (site: Website) => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === site.websiteName) { setEditingNameId(null); return; }
    setNameSaving(true);
    try {
      const res  = await fetch(`/api/proxy/api/websites/${site.id}/name`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteName: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json?.message ?? 'Failed to update website name.'); return; }
      setWebsites((prev) => prev.map((w) => (w.id === site.id ? { ...w, websiteName: trimmed } : w)));
      setEditingNameId(null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setNameSaving(false);
    }
  };

  // ── Inline edit: website domain (blocked while ads are active) ──────────
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [domainDraft,     setDomainDraft]     = useState('');
  const [domainSaving,    setDomainSaving]    = useState(false);

  const startEditDomain = (site: Website) => {
    setEditingDomainId(String(site.id));
    setDomainDraft(site.websiteLink);
  };
  const saveDomain = async (site: Website) => {
    const trimmed = domainDraft.trim();
    if (!trimmed || trimmed === site.websiteLink) { setEditingDomainId(null); return; }
    setDomainSaving(true);
    try {
      const res  = await fetch(`/api/proxy/api/websites/${site.id}/domain`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteLink: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json?.message ?? 'Failed to update website domain.'); return; }
      setWebsites((prev) => prev.map((w) => (w.id === site.id ? { ...w, websiteLink: trimmed } : w)));
      setEditingDomainId(null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDomainSaving(false);
    }
  };

  const fetchWebsites = useCallback(async () => {
    setLoading(true);
    setError('');
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      const sessRes  = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store', signal: abort.signal });
      const sessJson = await sessRes.json().catch(() => ({}));
      const userId   = sessJson?.data?.user?.id ?? sessJson?.data?.user?._id;
      if (!userId) { setWebsites([]); return; }

      const res  = await fetch(`/api/proxy/api/websites/${userId}`, { credentials: 'include', cache: 'no-store', signal: abort.signal });
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json) ? json : (json?.data ?? json?.websites ?? []);
      setWebsites(list);
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      setError(name === 'AbortError' ? 'Request timed out. Please refresh.' : 'Failed to load websites.');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWebsites(); fetchActiveAdWebsiteIds(); }, [fetchWebsites, fetchActiveAdWebsiteIds]);

  // Mirrors expand/collapse into the URL (?websiteId=) so RightRail can
  // read it and hide itself while a site's details are open: those tabs
  // (Ad Spaces, Integration Codes, ...) want the full width, not a sidebar
  // eating a third of it.
  const expandSite = (id: string) => {
    setExpandedId(id);
    router.replace(`/?panel=websites&websiteId=${id}`, { scroll: false });
  };
  const collapseSite = () => {
    setExpandedId(null);
    router.replace('/?panel=websites', { scroll: false });
  };

  // With only one website, "View Details" is a pointless extra click: go
  // straight to it as soon as the list loads.
  useEffect(() => {
    if (websites.length === 1 && expandedId === null) {
      expandSite(String(websites[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websites]);

  async function handleDisconnectConfirm() {
    if (!disconnecting || confirmText.toLowerCase() !== 'disconnect') return;
    setDisconnectLoading(true);
    setError('');
    try {
      const res  = await fetch(`/api/proxy/api/websites/${disconnecting.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        setError(json.message ?? 'Failed to remove website.');
        return;
      }
      setWebsites(prev => prev.filter(w => w.id !== disconnecting.id));
      setDisconnecting(null);
      setConfirmText('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDisconnectLoading(false);
    }
  }

  return (
    <div>

      {/* ── Disconnect confirmation modal ── */}
      {disconnecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[color:var(--color-surface-1)] border border-[color:var(--color-border)] rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[color:var(--color-white)]">Confirm Disconnect</h3>
              <button
                onClick={() => { setDisconnecting(null); setConfirmText(''); }}
                className="p-1 rounded-full hover:bg-[color:var(--color-surface-2)]"
              >
                <XMarkIcon className="w-6 h-6 text-[color:var(--color-muted)]" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]">
              {disconnecting.imageUrl && !brokenLogoIds.has(String(disconnecting.id)) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={disconnecting.imageUrl}
                  alt="icon"
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                  onError={() => markLogoBroken(disconnecting.id)}
                />
              ) : (
                <div className="w-8 h-8 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] flex items-center justify-center shrink-0">
                  <GlobeAltIcon className="w-4 h-4 text-[color:var(--color-muted)]" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--color-white)] truncate">{disconnecting.websiteName}</p>
                <p className="text-xs text-[color:var(--color-muted)] truncate">{disconnecting.websiteLink}</p>
              </div>
            </div>

            <p className="text-sm text-red-400 leading-relaxed">
              Type <span className="font-bold text-red-300">disconnect</span> to remove this website from your Yepper account.
              All associated ad categories and earnings data will be permanently lost.
            </p>

            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="disconnect"
              className="mt-4 w-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded-xl px-4 py-3 text-sm text-[color:var(--color-white)] placeholder:text-[color:var(--color-muted)] outline-none focus:border-red-500/50 transition-colors"
            />

            <button
              onClick={handleDisconnectConfirm}
              disabled={confirmText.toLowerCase() !== 'disconnect' || disconnectLoading}
              className="mt-4 w-full py-3 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              {disconnectLoading
                ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Removing…</>
                : <><TrashIcon className="w-4 h-4" /> Confirm Disconnect</>}
            </button>
          </div>
        </div>
      )}

      <PanelHeader
        title="Connected Websites"
        subtitle="Manage websites on your Yepper account."
        align="left"
        action={
          <Link
            href={addWebsiteHref}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-background hover:opacity-90 transition-colors shrink-0"
          >
            <PlusCircleIcon className="w-4 h-4" />
            Add Website
          </Link>
        }
      />

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <XMarkIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[color:var(--color-surface-1)] border border-[color:var(--color-border)] rounded-2xl overflow-hidden animate-pulse">
              <div className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[color:var(--color-surface-2)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-[color:var(--color-surface-2)]" />
                  <div className="h-2 w-48 rounded bg-[color:var(--color-surface-2)]" />
                </div>
              </div>
              <div className="h-10 bg-[color:var(--color-surface-2)]" />
            </div>
          ))}
        </div>
      ) : websites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[color:var(--color-border)] rounded-2xl">
          <GlobeAltIcon className="w-12 h-12 text-[color:var(--color-muted)] mb-4" />
          <p className="text-base font-semibold text-[color:var(--color-white)] mb-1">No websites connected yet</p>
          <p className="text-sm text-[color:var(--color-muted)] mb-6 max-w-xs">
            Connect your website to start serving ads and tracking traffic through Yepper.
          </p>
          <Link
            href={addWebsiteHref}
            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-colors"
          >
            <PlusCircleIcon className="w-4 h-4" />
            Connect a Website
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {websites.map((site) => {
            const isExpanded = expandedId === String(site.id);
            return (
              <div
                key={site.id}
                className="bg-[color:var(--color-surface-1)] border border-[color:var(--color-border)] rounded-2xl overflow-hidden"
              >
                <div className="p-5 flex items-center justify-between gap-4 border-b border-[color:var(--color-border)]">
                  <div className="flex items-center gap-3 min-w-0">
                    {site.imageUrl && !brokenLogoIds.has(String(site.id)) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={site.imageUrl}
                        alt="icon"
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                        onError={() => markLogoBroken(site.id)}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] flex items-center justify-center shrink-0">
                        <GlobeAltIcon className="w-5 h-5 text-[color:var(--color-muted)]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      {editingNameId === String(site.id) ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveName(site); if (e.key === 'Escape') setEditingNameId(null); }}
                            className="min-w-0 flex-1 bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded-lg px-2 py-1 text-sm font-bold text-[color:var(--color-white)] outline-none focus:border-white/30"
                          />
                          <button onClick={() => saveName(site)} disabled={nameSaving} title="Save" className="shrink-0 p-1 rounded-md hover:bg-[color:var(--color-surface-2)] text-emerald-400 disabled:opacity-40">
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingNameId(null)} title="Cancel" className="shrink-0 p-1 rounded-md hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          <p className="text-sm font-bold text-[color:var(--color-white)] truncate">{site.websiteName}</p>
                          <button
                            onClick={() => startEditName(site)}
                            title="Edit name"
                            className="shrink-0 p-0.5 rounded text-[color:var(--color-muted)] hover:text-[color:var(--color-white)] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <PencilIcon className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {editingDomainId === String(site.id) ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <input
                            autoFocus
                            value={domainDraft}
                            onChange={(e) => setDomainDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveDomain(site); if (e.key === 'Escape') setEditingDomainId(null); }}
                            className="min-w-0 flex-1 bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] rounded-lg px-2 py-1 text-xs text-[color:var(--color-white)] outline-none focus:border-white/30"
                          />
                          <button onClick={() => saveDomain(site)} disabled={domainSaving} title="Save" className="shrink-0 p-1 rounded-md hover:bg-[color:var(--color-surface-2)] text-emerald-400 disabled:opacity-40">
                            <CheckIcon className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingDomainId(null)} title="Cancel" className="shrink-0 p-1 rounded-md hover:bg-[color:var(--color-surface-2)] text-[color:var(--color-muted)]">
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group mt-0.5">
                          <p className="text-xs text-[color:var(--color-muted)] truncate">{site.websiteLink}</p>
                          {activeAdWebsiteIds.has(String(site.id)) ? (
                            <span title="Domain locked — this site has active ads running" className="shrink-0 text-[color:var(--color-muted)]">
                              <LockClosedIcon className="w-3 h-3" />
                            </span>
                          ) : (
                            <button
                              onClick={() => startEditDomain(site)}
                              title="Edit domain"
                              className="shrink-0 p-0.5 rounded text-[color:var(--color-muted)] hover:text-[color:var(--color-white)] opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <PencilIcon className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <>
                    <WebsiteDetails
                      websiteId={String(site.id)}
                      embedded
                      onBack={collapseSite}
                    />
                    {/* Disconnect button temporarily hidden — user asked to
                        pull it out of the frontend for now. */}
                  </>
                ) : (
                  <button
                    onClick={() => expandSite(String(site.id))}
                    className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-[color:var(--color-white)] hover:bg-[color:var(--color-surface-2)] transition-colors"
                  >
                    <ChartBarIcon className="w-4 h-4" /> View Details
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
