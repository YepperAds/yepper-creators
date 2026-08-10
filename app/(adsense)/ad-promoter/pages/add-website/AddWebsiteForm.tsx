'use client';
// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, AlertTriangle, Loader,
} from 'lucide-react';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api, { websiteAPI } from '@/app/_lib/adsense-api';
import CategoryCard from '@/app/_components/shared/CategoryCard';

// ── helpers ───────────────────────────────────────────────────────────────────

const normaliseUrl = (raw) => {
  const v = raw.trim();
  if (!v) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
};

// ── Shared step shell: full-screen header when standalone, slim inline pill
// when embedded ── Module scope, not defined inside AddWebsiteForm: a
// component defined inside another component's body gets a brand-new
// identity every render, and React treats a changed component identity as
// "unmount the old one, mount a fresh one" — which was destroying and
// recreating every input inside this shell (losing focus) on every single
// keystroke, since typing a character triggers exactly the re-render that
// redefined this function. Hoisting it out fixes every input across all
// three steps at once, since renderStep1/2/3 all wrap their content in this.
const StepShell = ({ step, label, onBack, embedded, children }: { step: number; label: string; onBack: () => void; embedded: boolean; children: React.ReactNode }) => {
  if (embedded) {
    return (
      <div>
        <div className="flex items-center mb-6">
          <button onClick={onBack} className="flex items-center text-subtle hover:text-white transition-colors text-sm">
            <ArrowLeft size={16} className="mr-1.5" /> Back
          </button>
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="h-16 flex items-center">
            <button onClick={onBack} className="flex items-center text-subtle hover:text-white transition-colors">
              <ArrowLeft size={18} className="mr-2" />
              <span className="font-medium">Back</span>
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-12">
        {children}
      </div>
    </div>
  );
};

// ── component ─────────────────────────────────────────────────────────────────
//
// Extracted from the standalone /ad-promoter/pages/add-website route so the
// dashboard's in-place "Add website" panel can embed the exact same flow.
// Standalone usage (no props) behaves identically to before: back navigates
// via router.back(), success navigates to the new website's detail page.
// Embedded usage (onCreated/onCancel/embedded) stays in place (no router
// navigation, no full-screen header) and lets the caller decide what happens.

const AddWebsiteForm = ({
  onCreated,
  onCancel,
  embedded = false,
}: {
  onCreated?: (websiteId: string) => void;
  onCancel?: () => void;
  embedded?: boolean;
} = {}) => {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: website details. Domain ownership and the site's logo are no
  // longer collected manually here — once the generated script is pasted
  // onto the real site, it self-confirms the hostname matches this domain
  // and auto-detects the site's favicon/icon on its first pageview ping
  // (see SiteScriptController's detectLogo() and analyticsController's
  // domainConfirmed handling). A domain someone doesn't control never gets
  // "verified" and never gets a logo, because the script never runs there.
  const [websiteData, setWebsiteData] = useState({ name: '', url: '' });

  // Step 2: categories
  const [selectedBusinessCategories, setSelectedBusinessCategories] = useState([]);
  const [businessCategories,         setBusinessCategories]         = useState([]);
  const [loadingCategories,          setLoadingCategories]          = useState(true);

  // Step 3: pages (optional) — the same registry WebsitePagesPanel manages
  // later from the website's own detail view, offered right here too so
  // adding pages isn't gated behind "create the site first, then go find
  // this option in a different panel."
  const [pages,     setPages]     = useState<{ label: string; path: string }[]>([]);
  const [pageLabel, setPageLabel] = useState('');
  const [pagePath,  setPagePath]  = useState('');
  const [pageError, setPageError] = useState('');

  const [errors,       setErrors]       = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchBusinessCategories(); }, []);

  const fetchBusinessCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await api.get('/api/business-categories/categories');
      if (response.data.success) {
        setBusinessCategories(response.data.data.categories);
      }
    } catch {
      setErrors({ general: 'Failed to load business categories. Please refresh.' });
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setWebsiteData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleBusinessCategoryToggle = (categoryId) => {
    if (categoryId === 'any') {
      setSelectedBusinessCategories(prev => prev.includes('any') ? [] : ['any']);
    } else {
      setSelectedBusinessCategories(prev => {
        const next = prev.filter(id => id !== 'any');
        return next.includes(categoryId)
          ? next.filter(id => id !== categoryId)
          : [...next, categoryId];
      });
    }
  };

  // Same normalisation as WebsitePagesPanel's addRow: the site-wide script
  // compares this against location.pathname, which is never a full URL, so
  // a pasted "https://example.com/sign-in" has to become "/sign-in". Shared
  // by addPageRow and handleFinalSubmit, since finishing without pressing
  // "Add" first should still pick up whatever's currently typed.
  const parsePendingPage = (): { page: { label: string; path: string } } | { error: string } | null => {
    const l = pageLabel.trim();
    const raw = pagePath.trim();
    if (!l && !raw) return null;
    if (!l || !raw) return { error: 'Give the page both a label and a path.' };
    let p;
    if (/^https?:\/\//i.test(raw)) {
      try { p = new URL(raw).pathname || '/'; }
      catch { return { error: "That doesn't look like a valid URL." }; }
    } else {
      p = raw.startsWith('/') ? raw : `/${raw}`;
    }
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return { page: { label: l, path: p } };
  };

  const addPageRow = () => {
    const result = parsePendingPage();
    if (!result) { setPageError('Give the page both a label and a path.'); return; }
    if ('error' in result) { setPageError(result.error); return; }
    if (pages.some((pg) => pg.path === result.page.path)) { setPageError('That path is already added.'); return; }
    setPages([...pages, result.page]);
    setPageLabel(''); setPagePath(''); setPageError('');
  };
  const removePageRow = (path: string) => setPages(pages.filter((p) => p.path !== path));

  // ── Final submit ─────────────────────────────────────────────────────────────

  const handleFinalSubmit = async () => {
    if (selectedBusinessCategories.length === 0) {
      setErrors({ general: 'Please select at least one business category.' });
      return;
    }
    // Finishing without pressing "Add" first shouldn't drop whatever's
    // currently typed in the page fields — fold it in alongside the rest.
    const pending = parsePendingPage();
    if (pending && 'error' in pending) { setPageError(pending.error); return; }
    const finalPages = pending && !pages.some((pg) => pg.path === pending.page.path)
      ? [...pages, pending.page]
      : pages;

    setIsSubmitting(true);
    setErrors({});
    try {
      const response = await api.post('/api/websites/createWebsiteWithCategories', {
        websiteName:        websiteData.name,
        websiteLink:        websiteData.url,
        monthlyTraffic:     0,
        businessCategories: selectedBusinessCategories,
      });
      const websiteId = response.data.data?.id ?? response.data.data?._id;
      if (finalPages.length > 0) {
        try { await websiteAPI.updatePages(websiteId, finalPages); } catch { /* site is already created; pages can still be added later */ }
      }
      if (onCreated) {
        onCreated(websiteId);
      } else {
        router.push(`/ad-promoter/pages/website/${websiteId}`);
      }
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || err.message || 'Failed to create website' });
      setIsSubmitting(false);
    }
  };

  // ── Step navigation ───────────────────────────────────────────────────────────

  const handleNext = () => {
    setErrors({});

    if (currentStep === 1) {
      const name = websiteData.name.trim();
      const url  = normaliseUrl(websiteData.url);
      if (!name) { setErrors({ general: 'Website name is required.' }); return; }
      if (!url)  { setErrors({ general: 'Website URL is required.' }); return; }
      setWebsiteData(prev => ({ ...prev, url }));
    }

    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => { setErrors({}); setCurrentStep(prev => prev - 1); };
  const handleStep1Back = () => { if (onCancel) onCancel(); else router.back(); };

  // ── STEP 1: Website details ─────────────────────────────────────────────────

  const renderStep1 = () => (
    <StepShell step={1} label="Website Details" onBack={handleStep1Back} embedded={embedded}>
      <div className="max-w-2xl mx-auto">
        <div className="border border-border bg-surface-1 p-8 space-y-8">
          <div>
            <label className="block text-sm font-medium text-subtle mb-2">Website Name</label>
            <input
              type="text" name="name" placeholder="Enter your website name"
              value={websiteData.name} onChange={handleInputChange} required
              className="w-full px-4 py-3 border border-border bg-surface-1 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-subtle mb-2">Website URL</label>
            <input
              type="text" name="url" placeholder="yoursite.com or https://yoursite.com"
              value={websiteData.url} onChange={handleInputChange}
              className="w-full px-4 py-3 border border-border bg-surface-1 focus:outline-none"
            />
            <p className="mt-1 text-xs text-subtle">https:// is added automatically if not included.</p>
          </div>

          {errors.general && (
            <div className="flex items-center gap-2 bg-error/10 border border-red-300 text-error px-4 py-3">
              <AlertTriangle size={16} />
              <span>{errors.general}</span>
            </div>
          )}

          <button
            onClick={handleNext}
            className="w-full bg-black text-[#fff] py-3 hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Continue
          </button>
        </div>
      </div>
    </StepShell>
  );

  // ── STEP 2: Business categories ─────────────────────────────────────────────

  const renderStep2 = () => {
    const isAnySelected = selectedBusinessCategories.includes('any');
    return (
      <StepShell step={2} label="Business Categories" onBack={handleBack} embedded={embedded}>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">What kind of businesses can advertise on your site?</h1>
            <p className="text-subtle">Select the business types for <strong>{websiteData.name}</strong>.</p>
          </div>
        </div>

        {selectedBusinessCategories.length > 0 && (
          <div className="mb-8 p-5 border border-border bg-surface-1">
            <h3 className="font-semibold text-white mb-3">Selected:</h3>
            <div className="flex flex-wrap gap-2">
              {selectedBusinessCategories.map(id => {
                const cat = businessCategories.find(c => c.id === id);
                return <CategoryCard key={id} id={id} label={cat?.name} />;
              })}
            </div>
          </div>
        )}

        {(errors.general || errors.submit) && (
          <div className="mb-6 p-4 border border-red-300 bg-error/10 text-error flex items-center gap-2">
            <AlertTriangle size={16} /> {errors.general || errors.submit}
          </div>
        )}

        {loadingCategories ? (
          <div className="flex items-center justify-center min-h-96"><LoadingSpinner /></div>
        ) : businessCategories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businessCategories.map(category => {
              const isSelected = selectedBusinessCategories.includes(category.id);
              const isDisabled = isAnySelected && category.id !== 'any';
              return (
                <CategoryCard
                  key={category.id}
                  id={category.id}
                  label={category.name}
                  description={category.description}
                  selected={isSelected}
                  onClick={() => !isDisabled && handleBusinessCategoryToggle(category.id)}
                  size="card"
                  className={isDisabled ? 'opacity-40 pointer-events-none' : ''}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4 text-white">No Categories Available</h2>
              <button onClick={fetchBusinessCategories} className="bg-black text-[#fff] px-6 py-2 hover:bg-gray-800">Refresh</button>
            </div>
          </div>
        )}

        <div className="mt-12 flex justify-between items-center">
          <button onClick={handleBack} className="px-8 py-3 border border-border bg-surface-1 text-white hover:bg-surface-3 font-medium">
            Back
          </button>
          <button
            onClick={() => {
              if (selectedBusinessCategories.length === 0) { setErrors({ general: 'Please select at least one business category.' }); return; }
              setErrors({});
              setCurrentStep(3);
            }}
            disabled={selectedBusinessCategories.length === 0}
            className="bg-black text-[#fff] px-8 py-3 hover:bg-gray-800 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Continue
          </button>
        </div>
      </StepShell>
    );
  };

  // ── STEP 3: Website pages (optional) ────────────────────────────────────────
  // The same page registry WebsitePagesPanel manages later, offered here too:
  // ad spaces can target one of these pages instead of "every page", and
  // there's no reason that has to wait until after the site already exists.

  const renderStep3 = () => (
    <StepShell step={3} label="Website Pages" onBack={handleBack} embedded={embedded}>
      <div className="max-w-2xl mx-auto">
        <div className="border border-border bg-surface-1 p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Register your website's pages (optional)</h2>
          </div>

          {pages.length > 0 && (
            <div className="divide-y divide-border border border-border overflow-hidden">
              {pages.map((p) => (
                <div key={p.path} className="flex items-center justify-between gap-2 px-4 py-2.5 bg-surface-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white">{p.label}</span>
                    <span className="text-xs text-subtle ml-2 font-mono">{p.path}</span>
                  </div>
                  <button
                    onClick={() => removePageRow(p.path)}
                    className="shrink-0 px-1.5 text-sm text-subtle hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={pageLabel}
              onChange={(e) => setPageLabel(e.target.value)}
              placeholder="Label, e.g. Home"
              className="flex-1 px-3 py-2 border border-border bg-surface-1 text-sm text-white outline-none focus:border-white/40"
            />
            <input
              value={pagePath}
              onChange={(e) => setPagePath(e.target.value)}
              placeholder="Path, e.g. /blog (full URL is fine too)"
              onKeyDown={(e) => { if (e.key === 'Enter') addPageRow(); }}
              className="flex-1 px-3 py-2 border border-border bg-surface-1 text-sm text-white outline-none focus:border-white/40 font-mono"
            />
            <button
              onClick={addPageRow}
              className="shrink-0 px-4 py-2 border border-border text-sm font-medium text-white hover:bg-surface-2"
            >
              Add
            </button>
          </div>

          {pageError && <p className="text-xs text-error">{pageError}</p>}
          {errors.submit && (
            <div className="flex items-center gap-2 bg-error/10 border border-red-300 text-error px-4 py-3">
              <AlertTriangle size={16} />
              <span>{errors.submit}</span>
            </div>
          )}

          <button
            onClick={handleFinalSubmit}
            disabled={isSubmitting}
            className="w-full bg-black text-[#fff] py-3 hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting
              ? <><Loader size={16} className="animate-spin" /> Creating Website…</>
              : pages.length > 0 || (pageLabel.trim() && pagePath.trim()) ? 'Finish' : 'Skip & Create Website'}
          </button>
        </div>
      </div>
    </StepShell>
  );

  return (
    <>
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </>
  );
};

export default AddWebsiteForm;
