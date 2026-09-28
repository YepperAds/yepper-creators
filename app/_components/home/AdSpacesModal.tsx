'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { PublicCreator } from '@/app/_lib/public-home';
import { getToken } from '@/app/(adsense)/utils/token';

// The claim upload includes an image file and can land close to the Next.js
// API route proxy's ~4.5MB Vercel body cap, so go straight to the backend
// instead, same as the video upload in PostAdModal.tsx.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const DURATION_BANDS = ['5–15s', '15–30s'] as const;
const CAMPAIGN_PACKAGE_OPTIONS = [
  { value: '1 month', months: 1, days: 30 },
  { value: '3 months', months: 3, days: 90 },
  { value: '6 months', months: 6, days: 180 },
] as const;

interface AdSlot {
  slotType: string;
  label: string;
  status: 'open' | 'claimed';
}

interface AdFormatType {
  type: string;
  label: string;
  description: string;
  sizes: string[];
}

interface PricingRow {
  duration: string;
  corner: number;
  lbar: number;
}

// Lets an advertiser claim one of a creator's three video-placement slots
// (intro / middle / end) by paying the creator's subscriber-tier price for a
// chosen duration, then uploading their creative to it at a size of their
// choosing. Price (and the visual overlay format itself, corner badge vs
// L-bar) follows the creator's own fixed choice (set on their dashboard);
// the advertiser only picks duration + size. Once claimed, the slot is
// automatically offered to the creator next time they post a video through
// Yepper (see PostAdModal.tsx).
export default function AdSpacesModal({
  creator,
  open,
  onClose,
}: {
  creator: PublicCreator | null;
  open: boolean;
  onClose: () => void;
}) {
  const [slots, setSlots]       = useState<AdSlot[]>([]);
  const [adType, setAdType]     = useState('corner');
  const [adTypeLabel, setAdTypeLabel] = useState('');
  const [adTypeDescription, setAdTypeDescription] = useState('');
  const [sizes, setSizes]       = useState<string[]>(['small', 'medium', 'large']);
  const [tier, setTier]         = useState('');
  const [pricingRows, setPricingRows] = useState<PricingRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [claimingSlot, setClaimingSlot] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin]     = useState(false);
  const [claimedJustNow, setClaimedJustNow] = useState<string | null>(null);

  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [campaignSlot, setCampaignSlot] = useState<string | null>(null);
  const [adSize, setAdSize] = useState('medium');
  const [durationBand, setDurationBand] = useState<string>(DURATION_BANDS[1]);
  const [purchaseMode, setPurchaseMode] = useState<'single' | 'campaign'>('single');
  const [packageLength, setPackageLength] = useState<'1 month' | '3 months' | '6 months'>('3 months');
  const [campaignInsertionsByPackage, setCampaignInsertionsByPackage] = useState<Record<'1 month' | '3 months' | '6 months', number>>({
    '1 month': 20,
    '3 months': 60,
    '6 months': 120,
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [postingFrequency, setPostingFrequency] = useState<{ label: string; averageDaysBetweenPosts: number; isEstimated: boolean; hasHistory: boolean; source?: 'measured' | 'stated' | 'none' } | null>(null);
  const [postingEstimate, setPostingEstimate] = useState<{ avgDaysBetweenPosts: number | null; source: 'measured' | 'stated' | 'none'; estimates: Record<number, number> | null } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !creator) return;
    setLoading(true);
    setError('');
    setNeedsLogin(false);
    setClaimedJustNow(null);
    setExpandedSlot(null);
    Promise.all([
      fetch(`/api/social/youtube/ad-spaces/${creator.id}`, { credentials: 'include', cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/social/youtube/ad-formats', { credentials: 'include', cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([spacesJson, formatsJson]) => {
        setSlots(spacesJson?.data?.slots ?? []);
        const type = spacesJson?.data?.adType ?? 'corner';
        setAdType(type);
        setAdTypeLabel(spacesJson?.data?.adTypeLabel ?? '');
        setAdTypeDescription(spacesJson?.data?.adTypeDescription ?? '');
        setTier(spacesJson?.data?.tier ?? '');
        setPricingRows(spacesJson?.data?.pricingRows ?? []);
        setPostingFrequency(spacesJson?.data?.postingFrequency ?? null);
        setPostingEstimate(spacesJson?.data?.postingEstimate ?? null);
        const types: AdFormatType[] = formatsJson?.data?.types ?? [];
        setSizes(types.find((t) => t.type === type)?.sizes ?? ['small', 'medium', 'large']);
      })
      .catch(() => setError('Failed to load ad spaces.'))
      .finally(() => setLoading(false));
  }, [open, creator]);

  if (!open || !creator) return null;

  const startExpand = (slotType: string) => {
    setExpandedSlot(slotType);
    setAdSize('medium');
    setDurationBand(DURATION_BANDS[1]);
    setPendingFile(null);
    setError('');
  };

  const priceForSelection = (): number | null => {
    const row = pricingRows.find((r) => r.duration === durationBand);
    if (!row) return null;
    return (row as any)[adType] ?? null;
  };

  const price = priceForSelection();

  const packageEstimateDays = { '1 month': 30, '3 months': 90, '6 months': 180 } as const;
  const getDefaultInsertionsForPackage = (length: '1 month' | '3 months' | '6 months') => {
    if (!postingEstimate || !postingEstimate.estimates) return 0;
    const days = packageEstimateDays[length];
    return Number(postingEstimate.estimates[days] ?? 0) || 0;
  };

  const selectedPackageInsertions = Math.max(
    1,
    Number(campaignInsertionsByPackage[packageLength] ?? getDefaultInsertionsForPackage(packageLength) ?? 0) || 0,
  );
  const estimatedInsertions = selectedPackageInsertions || 0;

  const campaignTotal = price !== null ? price * estimatedInsertions : null;
  const campaignSlotLabel = campaignSlot ? slots.find((slot) => slot.slotType === campaignSlot)?.label ?? 'Selected slot' : 'Select a slot';
  const selectedCampaignSlotPosition = campaignSlot ? Number.parseInt(campaignSlot.replace('pct', ''), 10) : 0;
  const canSubmit = purchaseMode === 'campaign' ? !!(pendingFile && campaignSlot && campaignTotal !== null && estimatedInsertions > 0) : !!(pendingFile && expandedSlot);

  const submitClaim = async () => {
    if (!pendingFile) return;
    const slotType = purchaseMode === 'campaign' ? campaignSlot : expandedSlot;
    if (!slotType) return;
    setClaimingSlot(slotType);
    setError('');
    setNeedsLogin(false);

    try {
      const formData = new FormData();
      formData.append('image', pendingFile);
      formData.append('slotType', slotType);
      formData.append('adSize', adSize);
      formData.append('durationBand', durationBand);
      if (purchaseMode === 'campaign') {
        formData.append('package_months', String(CAMPAIGN_PACKAGE_OPTIONS.find((option) => option.value === packageLength)?.months ?? 3));
        formData.append('total_insertions', String(Math.max(1, Math.round(estimatedInsertions))));
      }

      // The login cookie is SameSite=Lax and scoped to this site, not the
      // backend's; it won't ride along on this cross-origin request, so
      // send the same JWT explicitly via the non-httpOnly yepper_token cookie.
      const token = getToken();
      const endpoint = purchaseMode === 'campaign'
        ? `${BACKEND_URL}/api/social/youtube/ad-spaces/${creator.id}/campaign/initiate`
        : `${BACKEND_URL}/api/social/youtube/ad-spaces/${creator.id}/claim/initiate`;
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setNeedsLogin(true);
      } else if (!json.success) {
        setError(json.message || (purchaseMode === 'campaign' ? 'Failed to start campaign' : 'Failed to claim ad space'));
      } else if (json.allPaid) {
        setSlots((prev) => prev.map((s) => (s.slotType === slotType ? { ...s, status: 'claimed' } : s)));
        setClaimedJustNow(slotType);
        setExpandedSlot(null);
      } else if (json.paymentUrl) {
        window.location.href = json.paymentUrl;
      } else {
        setError('Payment could not be started.');
      }
    } catch {
      setError(purchaseMode === 'campaign' ? 'Failed to start campaign' : 'Failed to claim ad space');
    } finally {
      setClaimingSlot(null);
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
            <h3 className="text-lg font-bold text-(--color-white)">Collaborate with {creator.channelName || creator.name}</h3>
            <p className="text-xs text-(--color-muted) mt-0.5">Claim a placement slot: your ad gets inserted automatically the next time they post a video.</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1 rounded-full hover:bg-(--color-surface-2)">
            <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
          </button>
        </div>

        {!loading && adTypeLabel && (
          <div className="mb-3 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-3 py-2">
            <p className="text-[10px] font-bold text-(--color-muted) uppercase">This channel's ad format</p>
            <p className="text-xs font-semibold text-(--color-white)">{adTypeLabel}</p>
            <p className="text-[10px] text-(--color-muted) mt-0.5">{adTypeDescription}</p>
          </div>
        )}

        {!loading && postingFrequency && (
          <div className="mb-3 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-3 py-2">
            <p className="text-[10px] font-bold text-(--color-muted) uppercase">Posting frequency</p>
            <p className="text-xs font-semibold text-(--color-white)">{postingFrequency.label}</p>
          </div>
        )}

        {!loading && tier && (
          <div className="mb-3 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-3 py-2 flex items-center justify-between">
            <p className="text-[10px] font-bold text-(--color-muted) uppercase">Pricing tier</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">{tier}</span>
          </div>
        )}

        {needsLogin && (
          <p className="mb-3 text-xs text-amber-400 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            Log in to claim an ad space: <a href="/login" className="underline font-semibold">go to login</a>.
          </p>
        )}
        {error && (
          <p className="mb-3 text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{error}</p>
        )}

        {!loading && (
          <div className="mb-3 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-3 py-2">
            <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-2">Purchase type</p>
            <div className="flex gap-2">
              {(['single', 'campaign'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPurchaseMode(mode);
                    if (mode === 'single') {
                      setCampaignSlot(null);
                      setExpandedSlot(null);
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${purchaseMode === mode ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-1) text-(--color-muted) border-(--color-border)'}`}
                >
                  {mode === 'single' ? 'Single insertion' : 'Campaign (1 / 3 / 6 months)'}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-(--color-surface-2) animate-pulse" />)}
          </div>
        ) : purchaseMode === 'campaign' ? (
          <div className="space-y-3">
            {!postingEstimate || postingEstimate.source === 'none' ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                This creator has no posting pace yet, so campaign purchase is unavailable. Switch to Single insertion.
              </div>
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Package length</p>
                  <div className="space-y-2">
                    {CAMPAIGN_PACKAGE_OPTIONS.map((option) => {
                      const isSelected = packageLength === option.value;
                      const defaultCount = getDefaultInsertionsForPackage(option.value);
                      const value = Number(campaignInsertionsByPackage[option.value] ?? defaultCount) || defaultCount || 0;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPackageLength(option.value)}
                          className={`w-full rounded-xl border px-3 py-2 text-left ${isSelected ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-(--color-border) bg-(--color-surface-1)'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-(--color-white)">{option.value}</span>
                            <span className="text-[10px] text-(--color-muted)">{defaultCount > 0 ? `~${defaultCount} default` : 'No estimate'}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <label className="text-[10px] text-(--color-muted)">Insertions</label>
                            <input
                              type="number"
                              min={1}
                              value={value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const nextValue = Number(e.target.value) || 0;
                                setCampaignInsertionsByPackage((prev) => ({
                                  ...prev,
                                  [option.value]: Math.max(1, nextValue),
                                }));
                                setPackageLength(option.value);
                              }}
                              className="w-24 rounded-md border border-(--color-border) bg-(--color-surface-2) px-2 py-1 text-right text-xs font-semibold text-(--color-white)"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-(--color-muted)">
                    {postingEstimate.source === 'measured'
                      ? `Based on about every ${postingEstimate.avgDaysBetweenPosts} days in recent posts.`
                      : `Based on the creator’s stated pace: ${postingEstimate.avgDaysBetweenPosts === 1 ? 'daily' : postingEstimate.avgDaysBetweenPosts === 3 ? 'every few days' : postingEstimate.avgDaysBetweenPosts === 7 ? 'weekly' : 'irregular'} estimation.`}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Slot position</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => {
                      const disabled = slot.status !== 'open';
                      const isActive = campaignSlot === slot.slotType;
                      return (
                        <button
                          key={slot.slotType}
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && setCampaignSlot(slot.slotType)}
                          className={`min-w-[3.5rem] px-2 py-1.5 rounded-lg border text-xs font-bold ${isActive ? 'bg-(--color-white) text-black border-transparent' : disabled ? 'bg-(--color-surface-1) text-(--color-muted) border-(--color-border) opacity-45' : 'bg-(--color-surface-1) text-(--color-white) border-(--color-border)'}`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Duration</p>
                  <div className="flex gap-2 flex-wrap">
                    {DURATION_BANDS.map((band) => (
                      <button
                        key={band}
                        onClick={() => setDurationBand(band)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border font-mono ${durationBand === band ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-1) text-(--color-muted) border-(--color-border)'}`}
                      >
                        {band}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Size</p>
                  <div className="flex gap-2">
                    {sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setAdSize(size)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border capitalize ${adSize === size ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-1) text-(--color-muted) border-(--color-border)'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) px-3 py-2 space-y-2">
                  <p className="text-[10px] font-bold text-(--color-muted) uppercase">Summary</p>
                  <p className="text-sm font-bold text-emerald-400">
                    {estimatedInsertions.toLocaleString()} insertions × {price?.toLocaleString() ?? '0'} RWF = {campaignTotal?.toLocaleString() ?? '0'} RWF
                  </p>
                  <p className="text-[10px] text-(--color-muted)">
                    {campaignSlotLabel} • {CAMPAIGN_PACKAGE_OPTIONS.find((option) => option.value === packageLength)?.value ?? '3 months'} • {durationBand}
                  </p>
                  <p className="text-[10px] text-(--color-muted)">
                    Estimated campaign length: {selectedCampaignSlotPosition || 45}% of each post, delivered up to ~{estimatedInsertions.toLocaleString()} videos.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Your Ad Image</p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-1) text-xs text-(--color-muted) hover:bg-(--color-surface-3)"
                  >
                    <PhotoIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{pendingFile ? pendingFile.name : 'Choose image…'}</span>
                  </button>
                </div>

                <button
                  onClick={submitClaim}
                  disabled={!canSubmit || claimingSlot === campaignSlot}
                  className="w-full py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"
                >
                  {claimingSlot === campaignSlot ? 'Processing…' : `Pay ${campaignTotal?.toLocaleString() ?? '0'} RWF & Start Campaign`}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div key={slot.slotType} className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-(--color-white) truncate">{slot.label}</p>
                    <p className="text-[10px] text-(--color-muted)">~12s ad placement</p>
                  </div>
                  {slot.status === 'claimed' && (
                    claimedJustNow === slot.slotType ? (
                      <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-emerald-400"><CheckCircleIcon className="w-4 h-4" /> Claimed!</span>
                    ) : (
                      <span className="shrink-0 text-xs font-bold text-(--color-muted)">Claimed</span>
                    )
                  )}
                  {slot.status === 'open' && expandedSlot === slot.slotType && (
                    <button onClick={() => setExpandedSlot(null)} className="shrink-0 text-xs font-medium text-(--color-muted)">Cancel</button>
                  )}
                </div>
                {slot.status === 'open' && expandedSlot !== slot.slotType && (
                  <button
                    onClick={() => startExpand(slot.slotType)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white"
                  >
                    <PhotoIcon className="w-3.5 h-3.5" />
                    Claim this slot
                  </button>
                )}

                {expandedSlot === slot.slotType && (
                  <div className="mt-3 pt-3 border-t border-(--color-border) space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Duration</p>
                      <div className="flex gap-2 flex-wrap">
                        {DURATION_BANDS.map((band) => (
                          <button
                            key={band}
                            onClick={() => setDurationBand(band)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border font-mono ${durationBand === band ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-1) text-(--color-muted) border-(--color-border)'}`}
                          >
                            {band}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Size</p>
                      <div className="flex gap-2">
                        {sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setAdSize(size)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border capitalize ${adSize === size ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-1) text-(--color-muted) border-(--color-border)'}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {price !== null && (
                      <div className="rounded-lg border border-(--color-border) bg-(--color-surface-1) px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-(--color-muted) uppercase">You pay</span>
                        <span className="text-sm font-bold text-emerald-400">{price.toLocaleString()} RWF per insertion</span>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Your Ad Image</p>
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-1) text-xs text-(--color-muted) hover:bg-(--color-surface-3)"
                      >
                        <PhotoIcon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{pendingFile ? pendingFile.name : 'Choose image…'}</span>
                      </button>
                    </div>

                    <button
                      onClick={submitClaim}
                      disabled={!canSubmit || claimingSlot === slot.slotType}
                      className="w-full py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {claimingSlot === slot.slotType ? 'Processing…' : (price !== null ? `Pay ${price.toLocaleString()} RWF & Claim` : 'Pay & Claim')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-[10px] text-(--color-muted)">Note: videos under 5 minutes only ever get the "Middle" slot; the other two only apply once the creator's video is long enough.</p>
      </div>
    </div>
  );
}
