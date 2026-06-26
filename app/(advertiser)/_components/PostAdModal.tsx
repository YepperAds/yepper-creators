'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  CloudArrowUpIcon,
  FilmIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getToken } from '@/app/(adsense)/utils/token';

type Mode = 'auto' | 'manual';

// Video uploads go straight to the Render backend, bypassing the Next.js API
// route proxy — Vercel Serverless Functions hard-cap request bodies at
// ~4.5MB regardless of streaming, which any real video file blows past.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// Under 5 minutes: the video gets exactly one ad, forced to the middle — no
// choice. 5 minutes or longer: three candidate slots open up (just after the
// 5-minute mark, the middle, and the 80%-through point), and the creator can
// pick any one of them or all three.
const SHORT_VIDEO_THRESHOLD_SEC = 5 * 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface AdSlot { key: string; label: string; time: number; }

function getAdSlots(duration: number): AdSlot[] {
  if (duration < SHORT_VIDEO_THRESHOLD_SEC) {
    return [{ key: 'middle', label: `Middle (${formatTime(duration / 2)})`, time: duration / 2 }];
  }
  return [
    { key: 'intro',  label: `After intro (${formatTime(SHORT_VIDEO_THRESHOLD_SEC)})`, time: SHORT_VIDEO_THRESHOLD_SEC },
    { key: 'middle', label: `Middle (${formatTime(duration / 2)})`,                   time: duration / 2 },
    { key: 'end',    label: `Near the end (${formatTime(duration * 0.8)})`,           time: duration * 0.8 },
  ];
}

// Extracted from connect-accounts/page.tsx's inline "Post Ad" modal so the
// dashboard's right-rail "Add ad" action can reuse the exact same upload
// flow (POST /api/social/post-ad/:provider, cookie auth, no other inputs
// required) without duplicating it.
export default function PostAdModal({
  provider,
  open,
  onClose,
  onPosted,
}: {
  provider: string | null;
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
}) {
  const [adFile, setAdFile]                     = useState<File | null>(null);
  const [adTitle, setAdTitle]                   = useState('');
  const [adDescription, setAdDescription]       = useState('');
  const [adPrivacy, setAdPrivacy]               = useState<'public' | 'unlisted'>('public');
  const [adUploading, setAdUploading]           = useState(false);
  const [adUploadProgress, setAdUploadProgress] = useState(0);
  const [adUploadResult, setAdUploadResult]     = useState<{ trackingCode: string; videoUrl: string | null } | null>(null);
  const [adUploadError, setAdUploadError]       = useState('');
  const [uploadStage, setUploadStage]           = useState<'idle' | 'transferring' | 'queued' | 'processing' | 'uploading'>('idle');
  const [stageMessage, setStageMessage]         = useState('');
  const pollCancelRef = useRef(false);

  // Ad creative placement. If an advertiser has already claimed one of this
  // creator's ad spaces (via "Collaborate with [creator]" on the homepage),
  // their creative is used automatically. Otherwise this falls back to a
  // manual "test" image upload so the overlay pipeline can still be tried.
  const [adCreative, setAdCreative]             = useState<File | null>(null);
  const [videoDuration, setVideoDuration]       = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots]       = useState<string[]>(['middle']);
  const [pendingClaims, setPendingClaims]       = useState<{ slotType: string; imageUrl: string; adType: string; adSize: string }[]>([]);

  const fileRef     = useRef<HTMLInputElement | null>(null);
  const creativeRef  = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      pollCancelRef.current = true; // cancel any poll loop left over from a previous open
      setAdFile(null);
      setAdTitle('');
      setAdDescription('');
      setAdPrivacy('public');
      setAdUploading(false);
      setAdUploadProgress(0);
      setAdUploadResult(null);
      setAdUploadError('');
      setUploadStage('idle');
      setStageMessage('');
      setAdCreative(null);
      setVideoDuration(null);
      setSelectedSlots(['middle']);
      setPendingClaims([]);
    } else {
      pollCancelRef.current = true;
    }
  }, [open, provider]);

  // Pull any ad spaces an advertiser has already claimed for this creator.
  useEffect(() => {
    if (!open) return;
    fetch('/api/social/ad-claims/pending', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setPendingClaims(Array.isArray(json?.data) ? json.data : []))
      .catch(() => setPendingClaims([]));
  }, [open]);

  // Once the video is picked, read its duration client-side — that's what
  // decides whether this is a "forced single mid-roll" video (<5min) or a
  // "pick your slots" video (5min+).
  useEffect(() => {
    if (!adFile) { setVideoDuration(null); return; }
    const url = URL.createObjectURL(adFile);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      setSelectedSlots(['middle']);
      URL.revokeObjectURL(url);
    };
    video.src = url;
    return () => URL.revokeObjectURL(url);
  }, [adFile]);

  const hasAnyPendingClaims = pendingClaims.length > 0;
  const claimedSlotKeys     = new Set(pendingClaims.map((c) => c.slotType));
  const isShortVideo        = videoDuration != null && videoDuration < SHORT_VIDEO_THRESHOLD_SEC;
  const adSlots              = videoDuration != null ? getAdSlots(videoDuration) : [];
  const relevantClaimedSlots = adSlots.filter((s) => claimedSlotKeys.has(s.key));
  const hasRealClaims        = relevantClaimedSlots.length > 0;

  // Slot keys (advertiser-claimed) to send to the backend in real mode.
  const selectedClaimedKeys = isShortVideo
    ? relevantClaimedSlots.map((s) => s.key)
    : relevantClaimedSlots.filter((s) => selectedSlots.includes(s.key)).map((s) => s.key);

  // Seconds to burn the local test creative into, in test/simulation mode.
  const testMarkerSeconds = isShortVideo
    ? adSlots.map((s) => s.time)
    : adSlots.filter((s) => selectedSlots.includes(s.key)).map((s) => s.time);

  const activePlacementCount = hasRealClaims ? selectedClaimedKeys.length : testMarkerSeconds.length;
  const showPlacementPanel   = !!adFile && videoDuration != null && (hasRealClaims || !!adCreative);

  const toggleSlot = (key: string) => {
    setSelectedSlots((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  if (!open || !provider) return null;

  const close = () => { if (!adUploading) onClose(); };

  const downloadCreativeManually = () => {
    if (hasRealClaims) {
      // Claimed creatives live on Cloudinary — just open each in a new tab
      // so the creator can save it themselves.
      relevantClaimedSlots
        .filter((s) => selectedClaimedKeys.includes(s.key))
        .forEach((s) => {
          const claim = pendingClaims.find((c) => c.slotType === s.key);
          if (claim) window.open(claim.imageUrl, '_blank');
        });
      return;
    }
    if (!adCreative) return;
    const url = URL.createObjectURL(adCreative);
    const a = document.createElement('a');
    a.href = url;
    a.download = adCreative.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Polls the backend job created by handlePostAd. The burn-in + YouTube
  // upload run in the background on the server — without this, the original
  // code waited on a single held-open request for that whole pipeline, which
  // Render's reverse-proxy idle timeout would kill (502) on anything but a
  // short, fast video.
  const pollJobStatus = (jobId: string) => new Promise<void>((resolve) => {
    const authHeaders: Record<string, string> = {};
    const token = getToken();
    if (token) authHeaders.Authorization = `Bearer ${token}`;

    const tick = async () => {
      if (pollCancelRef.current) { resolve(); return; }
      try {
        const res = await fetch(`${BACKEND_URL}/api/social/post-ad/jobs/${jobId}`, {
          credentials: 'include',
          headers: authHeaders,
        });
        const json = await res.json();
        const job = json?.data;
        if (!json?.success || !job) {
          setAdUploadError('Lost track of the upload — please check back in a minute or try again');
          setAdUploading(false);
          setUploadStage('idle');
          resolve();
          return;
        }

        if (job.status === 'queued' || job.status === 'processing' || job.status === 'uploading') {
          setUploadStage(job.status);
          setStageMessage(job.stage_message || '');
          setAdUploadProgress(
            job.status === 'queued' ? 15
            : job.status === 'processing' ? Math.max(15, Number(job.progress) || 0)
            : 85
          );
          setTimeout(tick, 2000);
          return;
        }

        if (job.status === 'done') {
          setAdUploadProgress(100);
          setAdUploadResult({ trackingCode: job.result?.trackingCode, videoUrl: job.result?.videoUrl ?? null });
          onPosted?.();
        } else if (job.error_code === 'reconnect_required') {
          setAdUploadError('YouTube upload not authorized. Please disconnect and reconnect your YouTube account to grant upload permissions.');
        } else {
          setAdUploadError(job.error_message || 'Upload failed');
        }
        setAdUploading(false);
        setUploadStage('idle');
        resolve();
      } catch {
        setTimeout(tick, 3000); // transient blip while polling — retry rather than failing the whole job
      }
    };
    tick();
  });

  const handlePostAd = async (mode: Mode) => {
    if (!adFile || !provider || adUploading) return;
    pollCancelRef.current = false;
    setAdUploading(true);
    setAdUploadProgress(0);
    setAdUploadError('');
    setAdUploadResult(null);

    if (mode === 'manual' && (adCreative || hasRealClaims)) downloadCreativeManually();

    // Ad burn-in now happens server-side with native ffmpeg, as part of the
    // background job we poll below — only placement metadata (and, for the
    // local test-creative path, the creative image itself) travels with the
    // upload; the video goes up raw and comes back burned-in.
    const placements: { time: number; imageUrl?: string; adType?: string; adSize?: string }[] = [];
    if (mode === 'auto') {
      if (hasRealClaims && selectedClaimedKeys.length) {
        for (const key of selectedClaimedKeys) {
          const slot = relevantClaimedSlots.find((s) => s.key === key);
          const claim = pendingClaims.find((c) => c.slotType === key);
          if (!slot || !claim) continue;
          placements.push({ time: slot.time, imageUrl: claim.imageUrl, adType: claim.adType, adSize: claim.adSize });
        }
      } else if (adCreative) {
        for (const time of testMarkerSeconds) placements.push({ time });
      }
    }

    setUploadStage('transferring');
    setStageMessage('Uploading video…');
    setAdUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('video',       adFile);
      formData.append('title',       adTitle.trim() || adFile.name.replace(/\.[^.]+$/, ''));
      formData.append('description', adDescription.trim());
      formData.append('privacy',     adPrivacy);
      formData.append('mode',        mode);
      if (placements.length) formData.append('placements', JSON.stringify(placements));
      if (mode === 'auto' && !hasRealClaims && adCreative) formData.append('creative', adCreative);
      if (hasRealClaims && selectedClaimedKeys.length) {
        // Real advertiser-claimed slots — tells the backend which claims to
        // mark "used" once the post succeeds.
        formData.append('claimedSlotTypes', JSON.stringify(selectedClaimedKeys));
      }

      // Use XMLHttpRequest so we can track upload progress. This request now
      // only covers the file transfer — it returns a jobId as soon as the
      // video lands on the backend, well before any YouTube relay work starts.
      const result = await new Promise<{ success: boolean; data?: any; message?: string; code?: string }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setAdUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { resolve({ success: false, message: 'Invalid response' }); }
        };
        xhr.onerror = () => resolve({ success: false, message: 'Network error' });
        xhr.open('POST', `${BACKEND_URL}/api/social/post-ad/${provider}`);
        xhr.withCredentials = true;
        // The login cookie is SameSite=Lax and scoped to this site, not the
        // backend's — it won't ride along on this cross-origin request, so
        // send the same JWT explicitly via the non-httpOnly yepper_token cookie.
        const token = getToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });

      if (!result.success || !result.data?.jobId) {
        if (result.code === 'reconnect_required') {
          setAdUploadError('YouTube upload not authorized. Please disconnect and reconnect your YouTube account to grant upload permissions.');
        } else {
          setAdUploadError(result.message || 'Upload failed');
        }
        setAdUploading(false);
        setUploadStage('idle');
        return;
      }

      setUploadStage('queued');
      setStageMessage('Queued');
      await pollJobStatus(String(result.data.jobId));
    } catch {
      setAdUploadError('Upload failed unexpectedly');
      setAdUploading(false);
      setUploadStage('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-(--color-white)">Post Ad — {provider.charAt(0).toUpperCase() + provider.slice(1)}</h3>
            <p className="text-xs text-(--color-muted) mt-0.5">A unique tracking code will be added to your video description automatically.</p>
          </div>
          <button onClick={close} disabled={adUploading} className="p-1 rounded-full hover:bg-(--color-surface-2) disabled:opacity-40">
            <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
          </button>
        </div>

        {adUploadResult ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
              <CheckCircleIcon className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-400">Video posted successfully!</p>
              <p className="text-xs text-(--color-muted) mt-1">Tracking code embedded in description</p>
              <p className="text-base font-mono font-bold text-(--color-white) mt-2">{adUploadResult.trackingCode}</p>
            </div>
            {adUploadResult.videoUrl && (
              <a href={adUploadResult.videoUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-medium text-blue-400 hover:underline">
                View on YouTube →
              </a>
            )}
            <button onClick={close} className="w-full py-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-medium text-(--color-white)">
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File picker */}
            <div>
              <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Video File *</label>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setAdFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={adUploading}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-2) hover:bg-(--color-surface-3) transition-colors text-sm text-(--color-muted) disabled:opacity-50"
              >
                <FilmIcon className="w-5 h-5 shrink-0" />
                <span className="truncate">{adFile ? adFile.name : 'Choose video file…'}</span>
                {adFile && <span className="ml-auto shrink-0 text-[10px] text-(--color-muted)">{(adFile.size / 1024 / 1024).toFixed(1)} MB</span>}
              </button>
            </div>

            {/* Ad creative (test) — only shown as a fallback when no advertiser has claimed an ad space on this channel yet */}
            {!hasAnyPendingClaims && (
              <div>
                <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Ad Creative (test)</label>
                <input
                  ref={creativeRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setAdCreative(e.target.files?.[0] ?? null)}
                />
                <button
                  onClick={() => creativeRef.current?.click()}
                  disabled={adUploading}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-2) hover:bg-(--color-surface-3) transition-colors text-sm text-(--color-muted) disabled:opacity-50"
                >
                  <PhotoIcon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{adCreative ? adCreative.name : 'Simulate a matched ad image (optional)…'}</span>
                </button>
                <p className="text-[10px] text-(--color-muted) mt-1">No advertiser has claimed an ad space on your channel yet — this just lets you test the auto-insert pipeline.</p>
              </div>
            )}

            {/* Placement choice — once duration is known and there's either a real claim or a test creative */}
            {showPlacementPanel && (
              <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-3 space-y-3">
                {hasRealClaims && (
                  <p className="text-[10px] text-emerald-400 font-semibold">Using advertiser-claimed creative(s) for this video.</p>
                )}
                {isShortVideo ? (
                  <p className="text-xs text-(--color-white)">
                    This video is under 5 minutes, so the ad plays once, in the middle
                    (<span className="font-mono">{formatTime(adSlots[0].time)}</span>). No placement choice for short videos.
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-bold text-(--color-white)">Ad placement — pick one or more</p>
                    <div className="space-y-1.5">
                      {adSlots.map((slot) => {
                        const claimed = claimedSlotKeys.has(slot.key);
                        const claim = pendingClaims.find((c) => c.slotType === slot.key);
                        const disabled = adUploading || (hasRealClaims && !claimed);
                        return (
                          <label key={slot.key} className={`flex items-center gap-2 text-xs cursor-pointer ${disabled && hasRealClaims ? 'text-(--color-muted) opacity-50' : 'text-(--color-white)'}`}>
                            <input
                              type="checkbox"
                              checked={selectedSlots.includes(slot.key)}
                              onChange={() => toggleSlot(slot.key)}
                              disabled={disabled}
                              className="accent-emerald-500"
                            />
                            {slot.label}
                            {hasRealClaims && (claimed && claim ? ` — claimed (${claim.adType === 'lbar' ? 'L-Bar' : 'Corner Badge'}, ${claim.adSize})` : ' — no advertiser yet')}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
                <p className="text-[10px] text-(--color-muted)">Each placement plays the ad for ~12 seconds (fading in/out).</p>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => handlePostAd('auto')}
                    disabled={adUploading || activePlacementCount === 0}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Auto-insert ad
                  </button>
                  <button
                    onClick={() => handlePostAd('manual')}
                    disabled={adUploading}
                    className="w-full py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-1) text-sm font-medium text-(--color-white) disabled:opacity-40"
                  >
                    Skip — download ad image &amp; add it manually
                  </button>
                  <p className="text-[10px] text-(--color-muted)">Burned in server-side — only the few seconds around each marker get re-processed. Keep this tab open until the upload finishes; processing then continues in the background.</p>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Title</label>
              <input
                value={adTitle}
                onChange={(e) => setAdTitle(e.target.value)}
                placeholder="Enter video title…"
                disabled={adUploading}
                className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 disabled:opacity-50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Description / Caption</label>
              <textarea
                value={adDescription}
                onChange={(e) => setAdDescription(e.target.value)}
                placeholder="Add a description, mentions, hashtags…"
                rows={3}
                disabled={adUploading}
                className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 resize-none disabled:opacity-50"
              />
              <p className="text-[10px] text-(--color-muted) mt-1">A tracking code (e.g. <span className="font-mono text-emerald-400">#YPR-YT-001</span>) will be appended automatically.</p>
            </div>

            {/* Privacy */}
            <div>
              <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Privacy</label>
              <div className="flex gap-2">
                {(['public', 'unlisted'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setAdPrivacy(p)}
                    disabled={adUploading}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${adPrivacy === p ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-2) text-(--color-muted) border-(--color-border) hover:text-(--color-white)'} disabled:opacity-50`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {adUploadError && (
              <p className="text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{adUploadError}</p>
            )}

            {/* Progress bar */}
            {adUploading && (
              <div>
                <div className="flex justify-between text-xs text-(--color-muted) mb-1">
                  <span>{stageMessage || (uploadStage === 'transferring' ? 'Uploading video…' : 'Working…')}</span>
                  <span>{adUploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-(--color-surface-2) overflow-hidden">
                  <div className="h-full rounded-full bg-red-500 transition-all duration-300" style={{ width: `${adUploadProgress}%` }} />
                </div>
              </div>
            )}

            {/* Actions — plain upload when the placement panel isn't showing */}
            {!showPlacementPanel && (
              <div className="flex gap-3 pt-1">
                <button onClick={close} disabled={adUploading} className="flex-1 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white) disabled:opacity-40">
                  Cancel
                </button>
                <button
                  onClick={() => handlePostAd('manual')}
                  disabled={!adFile || adUploading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
                >
                  <CloudArrowUpIcon className="w-4 h-4" />
                  {adUploading ? 'Uploading…' : 'Upload & Post'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
