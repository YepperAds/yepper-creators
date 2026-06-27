'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { PublicCreator } from '@/app/_lib/public-home';
import { getToken } from '@/app/(adsense)/utils/token';

// The claim upload includes an image file and can land close to the Next.js
// API route proxy's ~4.5MB Vercel body cap — go straight to the backend
// instead, same as the video upload in PostAdModal.tsx.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

const DURATION_BANDS = ['5–15s', '15–30s', '30–60s', '60–120s'] as const;
const AD_KINDS = [
  { value: 'video_ad', label: 'Video ad' },
  { value: 'audio_ad', label: 'Audio ad' },
  { value: 'mention',  label: 'Mention' },
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
  video_ad: number;
  audio_ad: number;
  mention: number;
}

// Lets an advertiser claim one of a creator's three video-placement slots
// (intro / middle / end) by paying the creator's subscriber-tier price for a
// chosen duration + ad kind, then uploading their creative to it at a size of
// their choosing. The visual format (corner badge vs L-bar) is the creator's
// own fixed choice (set on their dashboard) — not the advertiser's. Once
// claimed, the slot is automatically offered to the creator next time they
// post a video through Yepper (see PostAdModal.tsx).
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
  const [adSize, setAdSize] = useState('medium');
  const [durationBand, setDurationBand] = useState<string>(DURATION_BANDS[1]);
  const [adKind, setAdKind] = useState('video_ad');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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
    setAdKind('video_ad');
    setPendingFile(null);
    setError('');
  };

  const priceForSelection = (): number | null => {
    const row = pricingRows.find((r) => r.duration === durationBand);
    if (!row) return null;
    return (row as any)[adKind] ?? null;
  };

  const submitClaim = async () => {
    if (!expandedSlot || !pendingFile) return;
    const slotType = expandedSlot;
    setClaimingSlot(slotType);
    setError('');
    setNeedsLogin(false);

    try {
      const formData = new FormData();
      formData.append('image', pendingFile);
      formData.append('slotType', slotType);
      formData.append('adSize', adSize);
      formData.append('durationBand', durationBand);
      formData.append('adKind', adKind);

      // The login cookie is SameSite=Lax and scoped to this site, not the
      // backend's — it won't ride along on this cross-origin request, so
      // send the same JWT explicitly via the non-httpOnly yepper_token cookie.
      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/api/social/youtube/ad-spaces/${creator.id}/claim/initiate`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setNeedsLogin(true);
      } else if (!json.success) {
        setError(json.message || 'Failed to claim ad space');
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
      setError('Failed to claim ad space');
    } finally {
      setClaimingSlot(null);
    }
  };

  const price = priceForSelection();

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
            <p className="text-xs text-(--color-muted) mt-0.5">Claim a placement slot — your ad gets inserted automatically the next time they post a video.</p>
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

        {!loading && tier && (
          <div className="mb-3 rounded-xl border border-(--color-border) bg-(--color-surface-2) px-3 py-2 flex items-center justify-between">
            <p className="text-[10px] font-bold text-(--color-muted) uppercase">Pricing tier</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">{tier}</span>
          </div>
        )}

        {needsLogin && (
          <p className="mb-3 text-xs text-amber-400 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            Log in to claim an ad space — <a href="/login" className="underline font-semibold">go to login</a>.
          </p>
        )}
        {error && (
          <p className="mb-3 text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{error}</p>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-(--color-surface-2) animate-pulse" />)}
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
                    {/* Duration */}
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

                    {/* Ad kind */}
                    <div>
                      <p className="text-[10px] font-bold text-(--color-muted) uppercase mb-1.5">Ad kind</p>
                      <div className="flex gap-2">
                        {AD_KINDS.map((k) => (
                          <button
                            key={k.value}
                            onClick={() => setAdKind(k.value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${adKind === k.value ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-1) text-(--color-muted) border-(--color-border)'}`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Size */}
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

                    {/* Price */}
                    {price !== null && (
                      <div className="rounded-lg border border-(--color-border) bg-(--color-surface-1) px-3 py-2 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-(--color-muted) uppercase">Price</span>
                        <span className="text-sm font-bold text-emerald-400">{price.toLocaleString()} RWF</span>
                      </div>
                    )}

                    {/* Creative + submit */}
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
                      disabled={!pendingFile || claimingSlot === slot.slotType}
                      className="w-full py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {claimingSlot === slot.slotType ? 'Processing…' : price !== null ? `Pay ${price.toLocaleString()} RWF & Claim` : 'Pay & Claim'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-[10px] text-(--color-muted)">Note: videos under 5 minutes only ever get the "Middle" slot — the other two only apply once the creator's video is long enough.</p>
      </div>
    </div>
  );
}
