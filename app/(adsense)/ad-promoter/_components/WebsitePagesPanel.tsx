'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { Plus, X, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { websiteAPI } from '@/app/_lib/adsense-api';

// Registers the real pages/URLs of a site (label + path, e.g. "Home" → "/",
// "Blog" → "/blog") so ad spaces (see AddNewCategory.tsx / codeDisplay.tsx)
// can target one of them by path instead of always showing everywhere. The
// site-wide script matches a category's target_path against
// location.pathname itself — this list is the only thing an owner has to
// keep accurate; nothing else needs re-pasting when pages are added later.
export default function WebsitePagesPanel({ website, onPagesChange }) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState(website?.pages || []);
  const [label, setLabel] = useState('');
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addRow = () => {
    const l = label.trim();
    const raw = path.trim();
    if (!l || !raw) { setError('Give the page both a label and a path.'); return; }

    // The script compares this against location.pathname, which is never a
    // full URL — so a pasted "https://example.com/sign-in" has to be reduced
    // to "/sign-in" (via URL parsing, not string-prepending) or the mismatch
    // check silently fails to match on every real page load.
    let p;
    if (/^https?:\/\//i.test(raw)) {
      try { p = new URL(raw).pathname || '/'; }
      catch { setError("That doesn't look like a valid URL."); return; }
    } else {
      p = raw.startsWith('/') ? raw : `/${raw}`;
    }
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

    if (pages.some((pg) => pg.path === p)) { setError('That path is already registered.'); return; }
    setPages([...pages, { label: l, path: p }]);
    setLabel(''); setPath(''); setError('');
  };

  const removeRow = (path) => setPages(pages.filter((p) => p.path !== path));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const res = await websiteAPI.updatePages(website._id || website.id, pages);
      onPagesChange?.((res.data as any)?.pages || pages);
    } catch (e: any) {
      setError(e?.response?.message || 'Failed to save pages.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <FileText className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-100">Website Pages</p>
            <p className="text-xs text-zinc-500">
              {pages.length} page{pages.length !== 1 ? 's' : ''} registered — lets ad spaces target one specific page
            </p>
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="border-t border-zinc-700 p-5 space-y-4">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Register the real pages of your site (label + path, e.g. "Home" → <code className="text-zinc-400">/</code>,
            "Blog" → <code className="text-zinc-400">/blog</code>). When you add or duplicate an ad space, you'll be able
            to pick one of these instead of "every page" — no code change needed to scope it there.
          </p>

          {pages.length > 0 && (
            <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
              {pages.map((p) => (
                <div key={p.path} className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-950">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-200">{p.label}</span>
                    <span className="text-xs text-zinc-600 ml-2 font-mono">{p.path}</span>
                  </div>
                  <button
                    onClick={() => removeRow(p.path)}
                    className="shrink-0 p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-950"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label, e.g. Home"
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-600"
            />
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="Path, e.g. /blog (full URL is fine too)"
              onKeyDown={(e) => { if (e.key === 'Enter') addRow(); }}
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-blue-600 font-mono"
            />
            <button
              onClick={addRow}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Pages'}
          </button>
        </div>
      )}
    </div>
  );
}
