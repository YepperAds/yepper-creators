'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { PublicCreator } from '@/app/_lib/public-home';

interface AdSlot {
  slotType: string;
  label: string;
  status: 'open' | 'claimed';
}

// Lets an advertiser claim one of a creator's three video-placement slots
// (intro / middle / end) by uploading their creative straight to it. Once
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
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [claimingSlot, setClaimingSlot] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin]     = useState(false);
  const [claimedJustNow, setClaimedJustNow] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const targetSlotRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !creator) return;
    setLoading(true);
    setError('');
    setNeedsLogin(false);
    setClaimedJustNow(null);
    fetch(`/api/social/youtube/ad-spaces/${creator.id}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setSlots(json?.data?.slots ?? []))
      .catch(() => setError('Failed to load ad spaces.'))
      .finally(() => setLoading(false));
  }, [open, creator]);

  if (!open || !creator) return null;

  const startClaim = (slotType: string) => {
    targetSlotRef.current = slotType;
    fileRef.current?.click();
  };

  const handleFileChosen = async (file: File) => {
    const slotType = targetSlotRef.current;
    if (!slotType) return;
    setClaimingSlot(slotType);
    setError('');
    setNeedsLogin(false);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('slotType', slotType);

      const res = await fetch(`/api/social/youtube/ad-spaces/${creator.id}/claim`, {
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
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleFileChosen(file);
        }}
      />
      <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-(--color-white)">Collaborate with {creator.channelName || creator.name}</h3>
            <p className="text-xs text-(--color-muted) mt-0.5">Claim a placement slot — your ad gets inserted automatically the next time they post a video.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-(--color-surface-2)">
            <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
          </button>
        </div>

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
              <div key={slot.slotType} className="flex items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-surface-2) p-3">
                <div>
                  <p className="text-sm font-semibold text-(--color-white)">{slot.label}</p>
                  <p className="text-[10px] text-(--color-muted)">~12s ad placement</p>
                </div>
                {slot.status === 'claimed' ? (
                  claimedJustNow === slot.slotType ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400"><CheckCircleIcon className="w-4 h-4" /> Claimed!</span>
                  ) : (
                    <span className="text-xs font-bold text-(--color-muted)">Claimed</span>
                  )
                ) : (
                  <button
                    onClick={() => startClaim(slot.slotType)}
                    disabled={claimingSlot === slot.slotType}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <PhotoIcon className="w-3.5 h-3.5" />
                    {claimingSlot === slot.slotType ? 'Uploading…' : 'Claim — upload ad'}
                  </button>
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
