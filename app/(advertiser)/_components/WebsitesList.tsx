'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  GlobeAltIcon,
  ChartBarIcon,
  PlusCircleIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as SolidCheck } from '@heroicons/react/24/solid';
import WebsiteDetails from '@/app/(adsense)/ad-promoter/pages/website/[websiteId]/page';

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
  const [websites,           setWebsites]           = useState<Website[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');
  const [disconnecting,      setDisconnecting]      = useState<Website | null>(null);
  const [confirmText,        setConfirmText]        = useState('');
  const [disconnectLoading,  setDisconnectLoading]  = useState(false);
  const [expandedId,         setExpandedId]         = useState<string | null>(
    initialExpandedId != null ? String(initialExpandedId) : null,
  );

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

  useEffect(() => { fetchWebsites(); }, [fetchWebsites]);

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
    <div className="mx-auto max-w-2xl px-6 py-10">

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
              {disconnecting.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={disconnecting.imageUrl} alt="icon" className="w-8 h-8 rounded-lg object-cover shrink-0" />
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

      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-white)]">Connected Websites</h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">Manage websites on your Yepper account.</p>
        </div>
        <Link
          href={addWebsiteHref}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-100 transition-colors shrink-0"
        >
          <PlusCircleIcon className="w-4 h-4" />
          Add Website
        </Link>
      </div>

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
            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-100 transition-colors"
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
                    {site.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={site.imageUrl} alt="icon" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] flex items-center justify-center shrink-0">
                        <GlobeAltIcon className="w-5 h-5 text-[color:var(--color-muted)]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[color:var(--color-white)] truncate">{site.websiteName}</p>
                      <p className="text-xs text-[color:var(--color-muted)] mt-0.5 truncate">{site.websiteLink}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 shrink-0">
                    <SolidCheck className="w-3.5 h-3.5" /> Active
                  </span>
                </div>

                {isExpanded ? (
                  <WebsiteDetails
                    websiteId={String(site.id)}
                    embedded
                    onBack={() => setExpandedId(null)}
                  />
                ) : (
                  <div className="flex divide-x divide-[color:var(--color-border)]">
                    <button
                      onClick={() => setExpandedId(String(site.id))}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold text-[color:var(--color-white)] hover:bg-[color:var(--color-surface-2)] transition-colors"
                    >
                      <ChartBarIcon className="w-4 h-4" /> View Details
                    </button>
                    <button
                      onClick={() => { setDisconnecting(site); setConfirmText(''); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold text-red-400 hover:bg-red-500/5 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" /> Disconnect
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
