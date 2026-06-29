'use client';

import { useRef, useState } from 'react';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { HotDeal } from '@/app/_lib/public-home';
import { getToken } from '@/app/(adsense)/utils/token';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// Same business-category list advertisers pick from everywhere else in the
// app (see AdSpacesModal.tsx / insert-data/page.tsx) — required here too so
// a Hot Deal purchase carries the same business-identity info as any other ad.
const BUSINESS_CATEGORIES = [
  { id: 'technology',        label: 'Technology' },
  { id: 'food-beverage',     label: 'Food & Beverage' },
  { id: 'real-estate',       label: 'Real Estate' },
  { id: 'automotive',        label: 'Automotive' },
  { id: 'health-wellness',   label: 'Health & Wellness' },
  { id: 'entertainment',     label: 'Entertainment' },
  { id: 'fashion',           label: 'Fashion' },
  { id: 'education',         label: 'Education' },
  { id: 'business-services', label: 'Business Services' },
  { id: 'travel-tourism',    label: 'Travel & Tourism' },
  { id: 'arts-culture',      label: 'Arts & Culture' },
  { id: 'photography',       label: 'Photography' },
  { id: 'gifts-events',      label: 'Gifts & Events' },
  { id: 'government-public', label: 'Government & Public' },
  { id: 'general-retail',    label: 'General Retail' },
  { id: 'other',             label: 'Others' },
] as const;

function itemLabel(item: HotDeal['items'][number]): string {
  if (item.itemType === 'youtube') return `YouTube — ${item.slotType} slot, ${item.durationBand}, ${item.adType === 'lbar' ? 'L-bar' : 'corner badge'}`;
  return 'Website ad space';
}

// One checkout for an entire admin-curated Hot Deal bundle — every item gets
// claimed/booked together at the package's (possibly discounted) total price,
// paid via the same wallet/Flutterwave flow as a single YouTube claim.
export default function HotDealPurchaseModal({
  deal,
  open,
  onClose,
}: {
  deal: HotDeal | null;
  open: boolean;
  onClose: () => void;
}) {
  const [businessName, setBusinessName] = useState('');
  const [businessLink, setBusinessLink] = useState('');
  const [businessLocation, setBusinessLocation] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [businessCategories, setBusinessCategories] = useState<string[]>([]);
  const [businessCategoryOther, setBusinessCategoryOther] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [done, setDone] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!open || !deal) return null;

  const toggleBusinessCategory = (id: string) => {
    setBusinessCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const canSubmit =
    !!pendingFile &&
    !!businessName.trim() &&
    businessCategories.length > 0 &&
    (!businessCategories.includes('other') || businessCategoryOther.trim().length > 0);

  const submit = async () => {
    if (!canSubmit || !pendingFile) return;
    setSubmitting(true);
    setError('');
    setNeedsLogin(false);

    try {
      const formData = new FormData();
      formData.append('image', pendingFile);
      formData.append('businessName', businessName.trim());
      formData.append('businessLink', businessLink.trim());
      formData.append('businessLocation', businessLocation.trim());
      formData.append('adDescription', adDescription.trim());
      formData.append('businessCategories', JSON.stringify(businessCategories));
      formData.append('businessCategoryOther', businessCategoryOther.trim());

      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/api/hot-deals/${deal.id}/purchase`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setNeedsLogin(true);
      } else if (!json.success) {
        setError(json.message || 'Failed to buy this deal');
      } else if (json.allPaid) {
        setDone(true);
      } else if (json.paymentUrl) {
        window.location.href = json.paymentUrl;
      } else {
        setError('Payment could not be started.');
      }
    } catch {
      setError('Failed to buy this deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = '';
          setPendingFile(file);
        }}
      />
      <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-(--color-white)">{deal.title}</h3>
            <p className="text-xs text-(--color-muted) mt-0.5">{deal.items.length} bundled placement{deal.items.length === 1 ? '' : 's'} — pay once, claim them all.</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 rounded-full hover:bg-(--color-surface-2)">
            <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
          </button>
        </div>

        {done ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-6 text-center">
            <p className="text-sm font-bold text-emerald-400">Deal claimed!</p>
            <p className="text-xs text-(--color-muted) mt-1">Every bundled placement is now active.</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white">Close</button>
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-1.5">
              {deal.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2">
                  <span className="text-xs text-(--color-white)">{itemLabel(item)}</span>
                  <span className="text-xs font-bold text-emerald-400">{item.dealPrice.toLocaleString()} RWF</span>
                </div>
              ))}
            </div>

            {needsLogin && (
              <p className="mb-3 text-xs text-amber-400 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                Log in to buy this deal —{' '}
                <a href={`/login?from=${encodeURIComponent(`/?dealId=${deal.id}`)}`} className="underline font-semibold">
                  go to login
                </a>.
              </p>
            )}
            {error && (
              <p className="mb-3 text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{error}</p>
            )}

            <div className="space-y-3">
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Business name *"
                className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-lg px-3 py-2 text-xs text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30"
              />
              <input
                value={businessLink}
                onChange={(e) => setBusinessLink(e.target.value)}
                placeholder="Business link (optional)"
                className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-lg px-3 py-2 text-xs text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30"
              />
              <input
                value={businessLocation}
                onChange={(e) => setBusinessLocation(e.target.value)}
                placeholder="Business location (optional)"
                className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-lg px-3 py-2 text-xs text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30"
              />
              <textarea
                value={adDescription}
                onChange={(e) => setAdDescription(e.target.value)}
                placeholder="Ad description (optional)"
                rows={2}
                className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-lg px-3 py-2 text-xs text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 resize-none"
              />

              <div>
                <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">
                  Business Category <span className="text-red-400">*</span>
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => toggleBusinessCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${businessCategories.includes(cat.id) ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-2) text-(--color-muted) border-(--color-border)'}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {businessCategories.includes('other') && (
                  <input
                    value={businessCategoryOther}
                    onChange={(e) => setBusinessCategoryOther(e.target.value)}
                    placeholder='Describe your "Others" category…'
                    className="mt-2 w-full bg-(--color-surface-2) border border-(--color-border) rounded-lg px-3 py-2 text-xs text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30"
                  />
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Your Ad Creative</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-2) text-xs text-(--color-muted) hover:bg-(--color-surface-3)"
                >
                  <PhotoIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{pendingFile ? pendingFile.name : 'Choose image…'}</span>
                </button>
              </div>

              <div className="rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-(--color-muted) uppercase">Total</span>
                <span className="text-sm font-bold text-emerald-400">{deal.totalPrice.toLocaleString()} RWF</span>
              </div>

              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="w-full py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"
              >
                {submitting ? 'Processing…' : `Pay ${deal.totalPrice.toLocaleString()} RWF & Claim All`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
