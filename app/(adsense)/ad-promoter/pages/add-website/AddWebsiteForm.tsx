'use client';
// @ts-nocheck

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, ArrowLeft, Check, AlertTriangle, Loader, ClipboardCopy, RefreshCw,
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
  const fileInputRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: website details
  const [websiteData, setWebsiteData] = useState({ name: '', url: '' });

  // Step 2: domain verification
  const [verifyLoading,   setVerifyLoading]   = useState(false);
  const [verifyToken,     setVerifyToken]     = useState('');
  const [verifyTxtRecord, setVerifyTxtRecord] = useState('');
  const [verifyTxtHost,   setVerifyTxtHost]   = useState('_yepper-challenge');
  const [verifyDomain,    setVerifyDomain]    = useState('');
  const [verified,        setVerified]        = useState(false);
  const [verifyMsg,       setVerifyMsg]       = useState('');
  const [copied,          setCopied]          = useState(false);

  // Step 3: icon
  const [iconFile,    setIconFile]    = useState(null);
  const [iconPreview, setIconPreview] = useState(null);

  // Step 4: categories
  const [selectedBusinessCategories, setSelectedBusinessCategories] = useState([]);
  const [businessCategories,         setBusinessCategories]         = useState([]);
  const [loadingCategories,          setLoadingCategories]          = useState(true);

  // Step 5: pages (optional) — the same registry WebsitePagesPanel manages
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

  const validateIconFile = (file) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrors(prev => ({ ...prev, icon: 'Only JPEG, PNG, GIF, SVG, or WebP images are allowed.' }));
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, icon: 'Image must be smaller than 5MB.' }));
      return false;
    }
    return true;
  };

  const applyIconFile = (file) => {
    if (!validateIconFile(file)) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setIconFile(file);
      setIconPreview(reader.result);
      setErrors(prev => ({ ...prev, icon: '' }));
    };
    reader.readAsDataURL(file);
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
  // a pasted "https://example.com/sign-in" has to become "/sign-in".
  const addPageRow = () => {
    const l = pageLabel.trim();
    const raw = pagePath.trim();
    if (!l || !raw) { setPageError('Give the page both a label and a path.'); return; }
    let p;
    if (/^https?:\/\//i.test(raw)) {
      try { p = new URL(raw).pathname || '/'; }
      catch { setPageError("That doesn't look like a valid URL."); return; }
    } else {
      p = raw.startsWith('/') ? raw : `/${raw}`;
    }
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    if (pages.some((pg) => pg.path === p)) { setPageError('That path is already added.'); return; }
    setPages([...pages, { label: l, path: p }]);
    setPageLabel(''); setPagePath(''); setPageError('');
  };
  const removePageRow = (path: string) => setPages(pages.filter((p) => p.path !== path));

  // ── Final submit ─────────────────────────────────────────────────────────────

  const handleFinalSubmit = async () => {
    if (selectedBusinessCategories.length === 0) {
      setErrors({ general: 'Please select at least one business category.' });
      return;
    }
    setIsSubmitting(true);
    setErrors({});
    try {
      const response = await api.post('/api/websites/createWebsiteWithCategories', {
        websiteName:        websiteData.name,
        websiteLink:        websiteData.url,
        monthlyTraffic:     0,
        imageUrl:           iconPreview || '',   // base64, backend uploads to Cloudinary
        businessCategories: selectedBusinessCategories,
      });
      const websiteId = response.data.data?.id ?? response.data.data?._id;
      if (pages.length > 0) {
        try { await websiteAPI.updatePages(websiteId, pages); } catch { /* site is already created; pages can still be added later */ }
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

  const handleNext = async () => {
    setErrors({});

    if (currentStep === 1) {
      const name = websiteData.name.trim();
      const url  = normaliseUrl(websiteData.url);
      if (!name) { setErrors({ general: 'Website name is required.' }); return; }
      if (!url)  { setErrors({ general: 'Website URL is required.' }); return; }
      setWebsiteData(prev => ({ ...prev, url }));

      // Initiate domain verification
      setVerifyLoading(true);
      try {
        const res = await api.post('/api/websites/initiate-verification', { websiteLink: url });
        const { verificationToken, txtRecord, txtHost, domain } = res.data;
        setVerifyToken(verificationToken);
        setVerifyTxtRecord(txtRecord);
        setVerifyTxtHost(txtHost ?? '_yepper-challenge');
        setVerifyDomain(domain ?? url);
        setVerified(false);
        setVerifyMsg('');
      } catch (err) {
        setErrors({ general: (err as any)?.response?.message || (err as any)?.message || 'Could not start domain verification. Please try again.' });
        setVerifyLoading(false);
        return;
      }
      setVerifyLoading(false);
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!verified) { setErrors({ general: 'Please verify domain ownership before continuing.' }); return; }
    }

    if (currentStep === 3) {
      if (!iconFile) { setErrors({ icon: 'Please upload a website icon before continuing.' }); return; }
    }

    setCurrentStep(prev => prev + 1);
  };

  const handleVerifyDomain = async () => {
    setVerifyMsg('');
    setVerifyLoading(true);
    try {
      const res  = await api.post('/api/websites/verify-domain', {
        websiteLink:       websiteData.url,
        verificationToken: verifyToken,
      });
      if (res.data.verified) {
        setVerified(true);
        setVerifyMsg('');
      } else {
        setVerifyMsg(res.data.message ?? 'TXT record not detected yet. Wait a few minutes and try again.');
      }
    } catch (err) {
      setVerifyMsg(err.message ?? 'Verification request failed. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleBack = () => { setErrors({}); setVerifyLoading(false); setCurrentStep(prev => prev - 1); };
  const handleStep1Back = () => { if (onCancel) onCancel(); else router.back(); };

  const copyTxt = () => {
    navigator.clipboard.writeText(verifyTxtRecord).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Shared step shell: full-screen header when standalone, slim inline pill when embedded ──

  const StepShell = ({ step, label, onBack, children }: { step: number; label: string; onBack: () => void; children: React.ReactNode }) => {
    if (embedded) {
      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <button onClick={onBack} className="flex items-center text-subtle hover:text-white transition-colors text-sm">
              <ArrowLeft size={16} className="mr-1.5" /> Back
            </button>
            <span className="px-3 py-1 text-xs font-medium bg-black text-[#fff]">Step {step} of 5: {label}</span>
          </div>
          {children}
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background">
          <div className="max-w-6xl mx-auto px-4">
            <div className="h-16 flex items-center justify-between">
              <button onClick={onBack} className="flex items-center text-subtle hover:text-white transition-colors">
                <ArrowLeft size={18} className="mr-2" />
                <span className="font-medium">Back</span>
              </button>
              <span className="px-3 py-1 text-sm font-medium bg-black text-[#fff]">Step {step} of 5: {label}</span>
            </div>
          </div>
        </header>
        <div className="max-w-6xl mx-auto px-4 py-12">
          {children}
        </div>
      </div>
    );
  };

  // ── STEP 1: Website details ─────────────────────────────────────────────────

  const renderStep1 = () => (
    <StepShell step={1} label="Website Details" onBack={handleStep1Back}>
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
            disabled={verifyLoading}
            className="w-full bg-black text-[#fff] py-3 hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {verifyLoading ? <><Loader size={16} className="animate-spin" /> Loading…</> : 'Continue to Domain Verification'}
          </button>
        </div>
      </div>
    </StepShell>
  );

  // ── STEP 2: Domain verification ─────────────────────────────────────────────

  const renderStep2 = () => (
    <StepShell step={2} label="Verify Domain Ownership" onBack={handleBack}>
      <div className="max-w-2xl mx-auto">
        <div className="border border-border bg-surface-1 p-8 space-y-6">

          {verified ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-4">
              <Check size={20} />
              <div>
                <p className="font-semibold">Domain verified!</p>
                <p className="text-sm opacity-80">Ownership of <strong>{verifyDomain}</strong> confirmed.</p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Verify ownership of <span className="text-subtle">{verifyDomain}</span></h2>
                <p className="text-sm text-subtle">
                  Add the TXT record below to your DNS provider (Namecheap, Cloudflare, GoDaddy, etc.).
                  Changes usually propagate within minutes but can take up to 24 hours.
                </p>
              </div>

              {/* DNS record table */}
              <div className="border border-border overflow-hidden text-sm">
                <div className="grid grid-cols-[100px_1fr] divide-y divide-border">
                  <div className="px-4 py-3 font-semibold text-subtle border-r border-border bg-surface-2">Type</div>
                  <div className="px-4 py-3 text-white bg-surface-2">TXT</div>

                  <div className="px-4 py-3 font-semibold text-subtle border-r border-border">Host / Name</div>
                  <div className="px-4 py-3 text-white font-mono">{verifyTxtHost}</div>

                  <div className="px-4 py-3 font-semibold text-subtle border-r border-border bg-surface-2">Value</div>
                  <div className="px-4 py-3 bg-surface-2 flex items-start justify-between gap-3">
                    <span className="text-white font-mono text-xs break-all">{verifyTxtRecord}</span>
                    <button
                      onClick={copyTxt}
                      title="Copy value"
                      className="shrink-0 text-subtle hover:text-white transition-colors"
                    >
                      {copied ? <Check size={16} className="text-emerald-400" /> : <ClipboardCopy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {verifyMsg && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 text-sm">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{verifyMsg}</span>
                </div>
              )}

              <button
                onClick={handleVerifyDomain}
                disabled={verifyLoading}
                className="w-full bg-black text-[#fff] py-3 hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifyLoading
                  ? <><Loader size={16} className="animate-spin" /> Checking DNS…</>
                  : <><RefreshCw size={16} /> Verify DNS Record</>}
              </button>
            </>
          )}

          {errors.general && (
            <div className="flex items-center gap-2 bg-error/10 border border-red-300 text-error px-4 py-3">
              <AlertTriangle size={16} />
              <span>{errors.general}</span>
            </div>
          )}

          <button
            onClick={handleNext}
            disabled={!verified}
            className="w-full bg-black text-[#fff] py-3 hover:bg-gray-800 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to Website Icon
          </button>
        </div>
      </div>
    </StepShell>
  );

  // ── STEP 3: Icon upload ─────────────────────────────────────────────────────

  const renderStep3 = () => (
    <StepShell step={3} label="Website Icon" onBack={handleBack}>
      <div className="max-w-2xl mx-auto">
        <div className="border border-border bg-surface-1 p-8 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Upload a Website Icon</h2>
            <p className="text-subtle text-sm">Required. This icon will appear next to your site in the Yepper network.</p>
          </div>

          <div
            className="border-2 border-dashed border-border bg-surface-1 p-8 cursor-pointer hover:bg-surface-2 transition-all flex flex-col items-center justify-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) applyIconFile(f); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef} type="file"
              accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) applyIconFile(f); }}
              className="hidden"
            />
            {iconPreview ? (
              <div className="flex flex-col items-center gap-3">
                <img src={iconPreview} alt="Icon Preview" className="w-24 h-24 object-contain rounded-lg border border-border" />
                <p className="text-sm text-subtle">Click to change icon</p>
              </div>
            ) : (
              <>
                <Upload className="text-white mb-3" size={32} />
                <p className="text-white font-medium mb-1">Click to upload icon</p>
                <p className="text-sm text-subtle">JPEG, PNG, GIF, SVG, WebP (max 5MB)</p>
              </>
            )}
          </div>

          {errors.icon && (
            <div className="flex items-center gap-2 bg-error/10 border border-red-300 text-error px-4 py-3">
              <AlertTriangle size={16} />
              <span>{errors.icon}</span>
            </div>
          )}

          <button onClick={handleNext} className="w-full bg-black text-[#fff] py-3 hover:bg-gray-800 transition-colors font-medium">
            Continue to Categories
          </button>
        </div>
      </div>
    </StepShell>
  );

  // ── STEP 4: Business categories ─────────────────────────────────────────────

  const renderStep4 = () => {
    const isAnySelected = selectedBusinessCategories.includes('any');
    return (
      <StepShell step={4} label="Business Categories" onBack={handleBack}>
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
              setCurrentStep(5);
            }}
            disabled={selectedBusinessCategories.length === 0}
            className="bg-black text-[#fff] px-8 py-3 hover:bg-gray-800 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Continue to Website Pages
          </button>
        </div>
      </StepShell>
    );
  };

  // ── STEP 5: Website pages (optional) ────────────────────────────────────────
  // The same page registry WebsitePagesPanel manages later, offered here too:
  // ad spaces can target one of these pages instead of "every page", and
  // there's no reason that has to wait until after the site already exists.

  const renderStep5 = () => (
    <StepShell step={5} label="Website Pages" onBack={handleBack}>
      <div className="max-w-2xl mx-auto">
        <div className="border border-border bg-surface-1 p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Register your site's pages (optional)</h2>
            <p className="text-sm text-subtle">
              Add a label + path for each real page (e.g. &quot;Home&quot; &rarr; <code className="text-subtle">/</code>,
              &quot;Blog&quot; &rarr; <code className="text-subtle">/blog</code>) so an ad space can target one specific
              page instead of every page. You can also add these later, but doing it now saves a trip back here.
            </p>
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
              : pages.length > 0 ? 'Create Website & Choose Ad Categories' : 'Skip & Create Website'}
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
      {currentStep === 4 && renderStep4()}
    </>
  );
};

export default AddWebsiteForm;
