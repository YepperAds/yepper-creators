'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { PublicCreator } from '@/app/_lib/public-home';

// The claim upload includes an image file and can land close to the Next.js
// API route proxy's ~4.5MB Vercel body cap — go straight to the backend
// instead, same as the video upload in PostAdModal.tsx.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

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

// Lets an advertiser claim one of a creator's three video-placement slots
// (intro / middle / end) by uploading their creative straight to it, at a
// size of their choosing. The visual format (corner badge vs L-bar) is the
// creator's own fixed choice (set on their dashboard) — not the advertiser's.
// Once claimed, the slot is automatically offered to the creator next time
// they post a video through Yepper (see PostAdModal.tsx).
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
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [claimingSlot, setClaimingSlot] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin]     = useState(false);
  const [claimedJustNow, setClaimedJustNow] = useState<string | null>(null);

  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [adSize, setAdSize] = useState('medium');
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
    setPendingFile(null);
    setError('');
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

      const res = await fetch(`${BACKEND_URL}/api/social/youtube/ad-spaces/${creator.id}/claim`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setNeedsLogin(true);
      } else if (!json.success) {
        setError(json.message || 'Failed to claim ad space');
      } else {
        setSlots((prev) => prev.map((s) => (s.slotType === slotType ? { ...s, status: 'claimed' } : s)));
        setClaimedJustNow(slotType);
        setExpandedSlot(null);
      }
    } catch {
      setError('Failed to claim ad space');
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
                      {claimingSlot === slot.slotType ? 'Uploading…' : 'Confirm claim'}
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
