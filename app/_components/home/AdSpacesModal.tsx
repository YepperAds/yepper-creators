'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, PhotoIcon, XMarkIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { PlayIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
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

// A small, reusable video-mock preview: shows the creator's own latest
// thumbnail (or a placeholder) with the advertiser's chosen ad image
// overlaid, and a percentage-of-video progress bar marking exactly where
// in the video the ad will appear.
function VideoPreviewPanel({
  thumbnail,
  adImageUrl,
  position,
}: {
  thumbnail: string | null;
  adImageUrl: string | null;
  position: number;
}) {
  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-(--color-surface-2) border border-(--color-border)">
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-(--color-surface-2) to-(--color-surface-3)">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
            <PlayIcon className="w-6 h-6 text-white/70 ml-0.5" />
          </div>
        </div>
      )}

      {adImageUrl && (
        <div className="absolute bottom-4 right-4 max-w-[45%] rounded-lg overflow-hidden border-2 border-white shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={adImageUrl} alt="Your ad" className="w-full h-auto block" />
        </div>
      )}

      <div className="absolute left-4 right-4 bottom-3">
        <p className="text-[11px] font-bold text-white mb-1">{position}%</p>
        <div className="relative h-1.5 rounded-full bg-white/25">
          <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${position}%` }} />
        </div>
      </div>
    </div>
  );
}

// Lets an advertiser claim one of a creator's video-placement slots, either
// as a single insertion or as a campaign (1/3/6 months) that auto-fulfills
// on every future upload, up to an estimated insertion count based on the
// creator's posting pace. Shown as a full-screen two-step flow: a preview
// step introducing the channel, then a configure step for the purchase
// itself. Price (and the visual overlay format, corner badge vs L-bar)
// follows the creator's own fixed choice; the advertiser picks slot
// position, duration and size. Once claimed, the slot is automatically
// offered to the creator next time they post a video through Yepper (see
// PostAdModal.tsx).
export default function AdSpacesModal({
  creator,
  open,
  onClose,
}: {
  creator: PublicCreator | null;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'preview' | 'configure'>('preview');

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

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
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
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
  const [postingFrequency, setPostingFrequency] = useState<{ label: string; averageDaysBetweenPosts: number; isEstimated: boolean; hasHistory: boolean; source?: 'measured' | 'stated' | 'none' } | null>(null);
  const [postingEstimate, setPostingEstimate] = useState<{ avgDaysBetweenPosts: number | null; source: 'measured' | 'stated' | 'none'; estimates: Record<number, number> | null } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !creator) return;
    setStep('preview');
    setLoading(true);
    setError('');
    setNeedsLogin(false);
    setClaimedJustNow(null);
    setSelectedSlot(null);
    setPendingFile(null);
    setPendingFileUrl(null);
    setPurchaseMode('single');
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

  // Build/revoke an object URL for the chosen ad image so the preview panel
  // can show it without re-reading the file on every render.
  useEffect(() => {
    if (!pendingFile) {
      setPendingFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  if (!open || !creator) return null;

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
  const selectedSlotPosition = selectedSlot ? Number.parseInt(selectedSlot.replace('pct', ''), 10) || 0 : 0;
  const canSubmit = purchaseMode === 'campaign'
    ? !!(pendingFile && selectedSlot && campaignTotal !== null && estimatedInsertions > 0)
    : !!(pendingFile && selectedSlot);

  const displayTotal = purchaseMode === 'campaign' ? campaignTotal : price;

  const thumbnail = creator.videos?.[0]?.thumbnail ?? null;
  const previewPosition = selectedSlot ? selectedSlotPosition : 45;

  const submitClaim = async () => {
    if (!pendingFile || !selectedSlot) return;
    const slotType = selectedSlot;
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
      } else if (json.allPaid === true) {
        setSlots((prev) => prev.map((s) => (s.slotType === slotType ? { ...s, status: 'claimed' } : s)));
        setClaimedJustNow(slotType);
      } else if (json.paymentUrl) {
        // Do not mark the slot as claimed until the payment callback confirms a
        // successful transaction. The checkout remains pending until that point.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
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

      <div className="relative mx-auto my-auto w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl border border-(--color-border) bg-(--color-surface-1) px-5 py-6 shadow-2xl sm:px-8 sm:py-8">
        {/* Header: channel identity, shared by both steps */}
        <div className="flex items-start justify-between gap-3 mb-8 sm:mb-10">
          <div className="flex items-center gap-3 min-w-0">
            {step === 'configure' && (
              <button
                onClick={() => setStep('preview')}
                className="shrink-0 p-1.5 rounded-full hover:bg-(--color-surface-2) -ml-1.5"
                aria-label="Back"
              >
                <ChevronLeftIcon className="w-5 h-5 text-(--color-muted)" />
              </button>
            )}
            {creator.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={creator.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-(--color-surface-2) shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-(--color-white) truncate">{creator.channelName || creator.name}</h2>
              <p className="text-sm text-(--color-muted)">
                {creator.subscribers?.toLocaleString() ?? 0} subscribers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {creator.provider !== 'tiktok' && (
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
                <PlayIcon className="w-4 h-4 text-red-600" />
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-(--color-surface-2)">
              <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{error}</p>
        )}
        {needsLogin && (
          <p className="mb-4 text-xs text-amber-400 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            Log in to claim an ad space: <a href="/login" className="underline font-semibold">go to login</a>.
          </p>
        )}

        {loading ? (
          <div className="flex-1 grid sm:grid-cols-2 gap-6">
            <div className="aspect-video rounded-2xl bg-(--color-surface-2) animate-pulse" />
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-(--color-surface-2) animate-pulse" />)}
            </div>
          </div>
        ) : step === 'preview' ? (
          <div>
            <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
              <VideoPreviewPanel thumbnail={thumbnail} adImageUrl={null} position={previewPosition} />

              <div className="space-y-3">
                {adTypeLabel && (
                  <div className="rounded-xl bg-(--color-surface-2) px-4 py-3.5">
                    <p className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wide">This channel's ad format</p>
                    <p className="text-sm font-bold text-(--color-white) mt-1">{adTypeLabel}</p>
                    <p className="text-xs text-(--color-muted) mt-1">{adTypeDescription}</p>
                  </div>
                )}

                {postingFrequency && (
                  <div className="rounded-xl bg-(--color-surface-2) px-4 py-3.5">
                    <p className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wide">Posting frequency</p>
                    <p className="text-sm font-bold text-(--color-white) mt-1">{postingFrequency.label}</p>
                  </div>
                )}

                {tier && (
                  <div className="rounded-xl bg-(--color-surface-2) px-4 py-3.5 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wide">Pricing tier</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">{tier}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex items-end justify-between gap-4 border-t border-(--color-border) pt-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-(--color-white)">Advertise on {creator.channelName || creator.name}</h3>
                <p className="text-sm text-(--color-muted) mt-1 max-w-md">
                  Claim a placement slot: your ad gets inserted automatically the next time they post a video.
                </p>
              </div>
              <button
                onClick={() => setStep('configure')}
                className="shrink-0 flex items-center gap-1.5 px-5 py-3 rounded-full bg-red-600 hover:bg-red-500 text-sm font-bold text-white"
              >
                Continue
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
              {/* Controls */}
              <div className="space-y-5">
                <div>
                  <div className="flex gap-2 p-1 rounded-xl bg-(--color-surface-2)">
                    {(['single', 'campaign'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setPurchaseMode(mode);
                          setSelectedSlot(null);
                        }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${purchaseMode === mode ? 'bg-white text-black' : 'text-(--color-muted)'}`}
                      >
                        {mode === 'single' ? 'Single insertion' : 'Campaign (1 / 3 / 6 months)'}
                      </button>
                    ))}
                  </div>
                </div>

                {purchaseMode === 'campaign' && (!postingEstimate || postingEstimate.source === 'none') ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
                    This creator has no posting pace yet, so campaign purchase is unavailable. Switch to Single insertions.
                  </div>
                ) : purchaseMode === 'campaign' ? (
                  <div>
                    <p className="text-xs font-bold text-(--color-white) uppercase tracking-wide mb-1">Package length</p>
                    <p className="text-xs text-(--color-muted) mb-3">Choose your campaign period and how many times you want your ads to come up in that period</p>
                    <div className="space-y-2">
                      {CAMPAIGN_PACKAGE_OPTIONS.map((option) => {
                        const isSelected = packageLength === option.value;
                        const defaultCount = getDefaultInsertionsForPackage(option.value);
                        const value = Number(campaignInsertionsByPackage[option.value] ?? defaultCount) || defaultCount || 0;
                        return (
                          <div
                            key={option.value}
                            className={`w-full rounded-xl border px-4 py-3 transition-colors ${isSelected ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-(--color-border) bg-(--color-surface-2)'}`}
                          >
                            <button
                              type="button"
                              onClick={() => setPackageLength(option.value)}
                              className="flex w-full items-center justify-between gap-3 text-left text-(--color-white)"
                            >
                              <span className="text-sm font-bold">{option.value}</span>
                              <span className="text-[10px] text-(--color-muted)">~{defaultCount} estimated</span>
                            </button>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <label htmlFor={`campaign-insertions-${option.months}`} className="text-[10px] text-(--color-muted)">Insertions</label>
                              <input
                                id={`campaign-insertions-${option.months}`}
                                type="number"
                                min={1}
                                max={100000}
                                value={value}
                                onFocus={() => setPackageLength(option.value)}
                                onChange={(e) => {
                                  const nextValue = Number(e.target.value) || 0;
                                  setCampaignInsertionsByPackage((prev) => ({
                                    ...prev,
                                    [option.value]: Math.max(1, nextValue),
                                  }));
                                  setPackageLength(option.value);
                                }}
                                className="w-20 rounded-md border border-(--color-border) bg-(--color-surface-1) px-2 py-1.5 text-right text-xs font-bold text-(--color-white)"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-(--color-muted)">
                      {postingEstimate?.source === 'measured'
                        ? `Based on this creator posting about every ${postingEstimate.avgDaysBetweenPosts} days (measured).`
                        : postingEstimate?.source === 'stated'
                          ? 'Based on the creator\'s stated pace (unverified estimate).'
                          : 'Posting pace estimate unavailable.'}
                    </p>
                  </div>
                ) : null}

                <div>
                  <p className="text-xs font-bold text-(--color-white) uppercase tracking-wide mb-2">Slot position</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => {
                      const disabled = slot.status !== 'open';
                      const isActive = selectedSlot === slot.slotType;
                      return (
                        <button
                          key={slot.slotType}
                          type="button"
                          disabled={disabled}
                          onClick={() => !disabled && setSelectedSlot(slot.slotType)}
                          className={`min-w-[4.25rem] px-3 py-2.5 rounded-xl text-sm font-bold ${isActive ? 'bg-white text-black' : disabled ? 'bg-(--color-surface-2) text-(--color-muted) opacity-45' : 'bg-(--color-surface-2) text-(--color-white)'}`}
                        >
                          {slot.label}
                          {disabled && (
                            claimedJustNow === slot.slotType
                              ? <CheckCircleIcon className="inline-block w-3.5 h-3.5 ml-1 -mt-0.5 text-emerald-400" />
                              : null
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-(--color-white) uppercase tracking-wide mb-2">Duration</p>
                  <div className="flex gap-2">
                    {DURATION_BANDS.map((band) => (
                      <button
                        key={band}
                        onClick={() => setDurationBand(band)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold font-mono ${durationBand === band ? 'bg-white text-black' : 'bg-(--color-surface-2) text-(--color-muted)'}`}
                      >
                        {band}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-(--color-white) uppercase tracking-wide mb-2">Size</p>
                  <div className="flex gap-2">
                    {sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setAdSize(size)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold capitalize ${adSize === size ? 'bg-white text-black' : 'bg-(--color-surface-2) text-(--color-muted)'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-4">
                <VideoPreviewPanel thumbnail={thumbnail} adImageUrl={pendingFileUrl} position={previewPosition} />

                {purchaseMode === 'campaign' && campaignTotal !== null && (
                  <div className="rounded-xl bg-(--color-surface-2) px-4 py-3 space-y-1">
                    <p className="text-sm font-bold text-emerald-400">
                      {estimatedInsertions.toLocaleString()} insertions × {price?.toLocaleString() ?? '0'} RWF = {campaignTotal.toLocaleString()} RWF
                    </p>
                    <p className="text-[11px] text-(--color-muted)">
                      Your ad appears at {selectedSlotPosition || '—'}% of every video this creator posts for {packageLength}, up to ~{estimatedInsertions.toLocaleString()} videos. Any insertions not delivered by the end date are refunded automatically.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-2) text-sm text-(--color-muted) hover:bg-(--color-surface-3)"
                >
                  <PhotoIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{pendingFile ? pendingFile.name : 'Choose image of your ad'}</span>
                </button>
              </div>
            </div>

            <div className="mt-8 flex items-end justify-between gap-4 border-t border-(--color-border) pt-6">
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                {displayTotal !== null ? `${displayTotal.toLocaleString()} RWF` : '—'}
              </p>
              <button
                onClick={submitClaim}
                disabled={!canSubmit || claimingSlot === selectedSlot}
                className="shrink-0 px-8 py-3.5 rounded-full bg-red-600 hover:bg-red-500 text-sm font-bold text-white disabled:opacity-50"
              >
                {claimingSlot === selectedSlot
                  ? 'Processing…'
                  : purchaseMode === 'campaign'
                    ? `Pay ${displayTotal?.toLocaleString() ?? '—'} RWF & Start Campaign`
                    : `Pay ${displayTotal?.toLocaleString() ?? '—'} RWF & Claim Slot`}
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-[11px] text-(--color-muted)">Note: videos under 60 seconds get the ad overlaid across the full video rather than at a fixed slot position.</p>
      </div>
    </div>
  );
}
