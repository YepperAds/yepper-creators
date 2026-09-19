'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  FilmIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getToken } from '@/app/(adsense)/utils/token';

// The video file goes straight to the backend (multipart), not through the
// Vercel frontend proxy, since it can be multiple GB.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// Under 5 minutes: the video gets exactly one ad slot, forced to the middle;
// no choice. 5 minutes or longer: three candidate slots open up (just after
// the 5-minute mark, the middle, and the 80%-through point), and an
// advertiser can claim any one of them.
const SHORT_VIDEO_THRESHOLD_SEC = 5 * 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface AdSlot { key: string; label: string; time: number; }
interface PendingClaim { slotType: string; imageUrl: string; adType: string; adSize: string; }

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

function downloadImage(url: string) {
  // Claimed creatives live on Cloudinary (cross-origin), so the anchor
  // `download` attribute is ignored by the browser: opening in a new tab
  // lets the creator save it themselves via right-click / browser controls.
  window.open(url, '_blank');
}

// Extracted from connect-accounts/page.tsx's inline "Post Ad" modal so the
// dashboard's right-rail "Add ad" action can reuse the exact same upload
// flow (POST /api/social/post-ad/:provider, cookie auth, multipart video)
// without duplicating it.
//
// The creator uploads their raw video; Yepper injects the claimed
// creative(s) server-side (ffmpeg, see runAdVideoJob) and the creator
// downloads the processed file to publish themselves on YouTube.
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
  const [adUploadResult, setAdUploadResult]     = useState<{ trackingCode: string; videoUrl: string | null } | null>(null);
  const [adUploadError, setAdUploadError]       = useState('');

  // Yepper injects the claimed creative(s) into the video server-side.
  // 'job' tracks that processing job; once it's done, 'pendingPost' holds the
  // tracking code (to paste into the description) and the download is ready.
  const [jobId, setJobId]                       = useState<string | null>(null);
  const [jobStatus, setJobStatus]               = useState<{ status: string; stage_message?: string; progress?: number } | null>(null);
  const [pendingPost, setPendingPost]           = useState<{ postId: string; trackingCode: string; description: string } | null>(null);
  const [publishedUrl, setPublishedUrl]         = useState('');
  const [confirming, setConfirming]             = useState(false);
  const [copied, setCopied]                     = useState(false);

  // Ad creatives an advertiser has already claimed on this creator's channel
  // (via "Collaborate with [creator]" on the homepage), downloadable here so
  // the creator can edit them into their video before uploading it.
  const [videoDuration, setVideoDuration]       = useState<number | null>(null);
  const [includedSlots, setIncludedSlots]       = useState<string[]>([]);
  const [pendingClaims, setPendingClaims]       = useState<PendingClaim[]>([]);

  const [prevSlotsKey, setPrevSlotsKey]         = useState('');

  const fileRef = useRef<HTMLInputElement | null>(null);

  const authedFetch = (url: string, init: RequestInit = {}) => {
    const token = getToken();
    return fetch(url, {
      ...init,
      credentials: 'include',
      headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  };

  useEffect(() => {
    if (open) {
      setAdFile(null);
      setAdTitle('');
      setAdDescription('');
      setAdPrivacy('public');
      setAdUploading(false);
      setAdUploadResult(null);
      setAdUploadError('');
      setJobId(null);
      setJobStatus(null);
      setPendingPost(null);
      setPublishedUrl('');
      setConfirming(false);
      setCopied(false);
      setVideoDuration(null);
      setIncludedSlots([]);
      setPrevSlotsKey('');
      setPendingClaims([]);
    }
  }, [open, provider]);

  // Poll the processing job until it's done (or errors out).
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await authedFetch(`${BACKEND_URL}/api/social/post-ad/jobs/${jobId}`);
        const json = await res.json();
        if (cancelled || !json?.success) return;
        setJobStatus(json.data);
        if (json.data.status === 'done') {
          const result = json.data.result ? (typeof json.data.result === 'string' ? JSON.parse(json.data.result) : json.data.result) : null;
          if (result) setPendingPost(result);
          setAdUploading(false);
        } else if (json.data.status === 'error') {
          setAdUploadError(json.data.error_message || 'Processing failed, please try again');
          setAdUploading(false);
          setJobId(null);
        } else {
          setTimeout(tick, 2000);
        }
      } catch {
        if (!cancelled) setTimeout(tick, 3000);
      }
    };
    tick();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Pull any ad spaces an advertiser has already claimed for this creator,
  // shown immediately, independent of picking a video, so the creator can
  // grab the image(s) whenever they're ready to start editing.
  useEffect(() => {
    if (!open) return;
    fetch('/api/social/ad-claims/pending', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setPendingClaims(Array.isArray(json?.data) ? json.data : []))
      .catch(() => setPendingClaims([]));
  }, [open]);

  // Once the video is picked, read its duration client-side: that's what
  // decides whether this is a "forced single mid-roll" video (<5min) or a
  // "pick your slots" video (5min+).
  useEffect(() => {
    if (!adFile) { setVideoDuration(null); return; }
    const url = URL.createObjectURL(adFile);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      URL.revokeObjectURL(url);
    };
    video.src = url;
    return () => URL.revokeObjectURL(url);
  }, [adFile]);

  const claimedSlotKeys      = new Set(pendingClaims.map((c) => c.slotType));
  const isShortVideo         = videoDuration != null && videoDuration < SHORT_VIDEO_THRESHOLD_SEC;
  const adSlots               = videoDuration != null ? getAdSlots(videoDuration) : [];
  const relevantClaimedSlots = adSlots.filter((s) => claimedSlotKeys.has(s.key));
  const hasRelevantClaims    = relevantClaimedSlots.length > 0;

  // Defaults to every relevant claimed slot once they're known: for a short
  // video there's only one possible slot, so it's pre-checked automatically.
  // Adjusted during render (not an effect) per https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const relevantSlotsKey = relevantClaimedSlots.map((s) => s.key).join(',');
  if (relevantSlotsKey !== prevSlotsKey) {
    setPrevSlotsKey(relevantSlotsKey);
    if (relevantSlotsKey) setIncludedSlots(relevantClaimedSlots.map((s) => s.key));
  }

  const showSlotConfirmPanel = !!adFile && videoDuration != null && hasRelevantClaims;

  const toggleSlot = (key: string) => {
    setIncludedSlots((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  if (!open || !provider) return null;

  const close = () => { if (!adUploading) onClose(); };

  // Step 1: upload the raw video — Yepper injects the claimed creative(s)
  // server-side and queues a processing job.
  const handleUpload = async () => {
    if (!provider || !adFile || adUploading) return;
    setAdUploading(true);
    setAdUploadError('');
    try {
      const form = new FormData();
      form.append('video', adFile);
      form.append('title', adTitle.trim() || adFile.name.replace(/\.[^.]+$/, '') || 'Ad Video');
      form.append('description', adDescription.trim());
      form.append('privacy', adPrivacy);
      if (hasRelevantClaims && includedSlots.length) {
        form.append('claimedSlotTypes', JSON.stringify(includedSlots));
      }
      const res = await authedFetch(`${BACKEND_URL}/api/social/post-ad/${provider}`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!json?.success || !json.data?.jobId) {
        setAdUploadError(json?.message || 'Could not start processing, please try again');
        setAdUploading(false);
        return;
      }
      setJobId(String(json.data.jobId));
      setJobStatus({ status: 'queued', stage_message: 'Queued…', progress: 0 });
    } catch {
      setAdUploadError('Something went wrong, please try again');
      setAdUploading(false);
    }
  };

  // Step 2: they've published on their own channel with the code in the
  // description — verify it via the public YouTube API (no OAuth) and mark
  // this post live.
  const handleConfirm = async () => {
    if (!provider || !pendingPost || !publishedUrl.trim() || confirming) return;
    setConfirming(true);
    setAdUploadError('');
    try {
      const res = await authedFetch(`${BACKEND_URL}/api/social/post-ad/${provider}/confirm/${pendingPost.postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: publishedUrl.trim(),
          claimedSlotTypes: hasRelevantClaims && includedSlots.length ? includedSlots : undefined,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        setAdUploadError(json?.message || "Couldn't verify that video, please try again");
        return;
      }
      setAdUploadResult({ trackingCode: json.data.trackingCode, videoUrl: json.data.videoUrl ?? null });
      onPosted?.();
    } catch {
      setAdUploadError('Something went wrong, please try again');
    } finally {
      setConfirming(false);
    }
  };

  const copyCode = () => {
    if (!pendingPost) return;
    navigator.clipboard?.writeText(pendingPost.description).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadProcessedVideo = async () => {
    if (!jobId) return;
    setAdUploadError('');
    try {
      const response = await authedFetch(`${BACKEND_URL}/api/social/post-ad/jobs/${jobId}/download`);
      if (!response.ok) {
        const message = await response.json().catch(() => null);
        setAdUploadError(message?.message || `Download failed (${response.status})`);
        return;
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'yepper-processed-video.mp4';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setAdUploadError('Could not download the processed video, please try again');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-(--color-white)">Post Ad: {provider.charAt(0).toUpperCase() + provider.slice(1)}</h3>
            <p className="text-xs text-(--color-muted) mt-0.5">Upload your video — we inject the ad, you download it and publish it yourself.</p>
          </div>
          <button onClick={close} disabled={adUploading} className="p-1 rounded-full hover:bg-(--color-surface-2) disabled:opacity-40">
            <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
          </button>
        </div>

        {jobId && !pendingPost ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-4 text-center space-y-3">
              <FilmIcon className="w-8 h-8 text-(--color-muted) mx-auto animate-pulse" />
              <p className="text-sm font-medium text-(--color-white)">{jobStatus?.stage_message || 'Processing…'}</p>
              <div className="w-full h-2 rounded-full bg-(--color-surface-3) overflow-hidden">
                <div className="h-full rounded-full bg-red-500 transition-all duration-300" style={{ width: `${jobStatus?.progress ?? 0}%` }} />
              </div>
              <p className="text-[10px] text-(--color-muted)">This can take a while for long videos — you can close this and check back.</p>
            </div>
            {adUploadError && (
              <p className="text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{adUploadError}</p>
            )}
            <button onClick={close} className="w-full py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white)">
              Close
            </button>
          </div>
        ) : pendingPost ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={downloadProcessedVideo}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-600 text-sm font-bold text-white"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Download processed video
            </button>

            <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-4 space-y-2">
              <p className="text-xs font-bold text-(--color-muted) uppercase">1. Add this to your description</p>
              <div className="flex items-start gap-2">
                <pre className="flex-1 whitespace-pre-wrap text-xs font-mono text-(--color-white) bg-(--color-surface-3) rounded-lg p-2.5">{pendingPost.description}</pre>
                <button onClick={copyCode} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-1) text-[11px] font-medium text-(--color-white)">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-(--color-muted)">Publish the downloaded video on YouTube ({adPrivacy}) with this in the description.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">2. Paste the published video link</label>
              <input
                value={publishedUrl}
                onChange={(e) => setPublishedUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                disabled={confirming}
                className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 disabled:opacity-50"
              />
            </div>

            {adUploadError && (
              <p className="text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{adUploadError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={close} disabled={confirming} className="flex-1 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white) disabled:opacity-40">
                Do this later
              </button>
              <button
                onClick={handleConfirm}
                disabled={!publishedUrl.trim() || confirming}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
              >
                <CheckCircleIcon className="w-4 h-4" />
                {confirming ? 'Verifying…' : 'Confirm'}
              </button>
            </div>
          </div>
        ) : adUploadResult ? (
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
            {/* Advertiser creatives claimed on this channel, downloadable any time, independent of picking a video */}
            {pendingClaims.length > 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <p className="text-xs font-bold text-emerald-400">Ad images ready for you to use</p>
                <p className="text-[10px] text-(--color-muted)">
                  Claimed for your channel — pick the video below and Yepper will inject these automatically.
                </p>
                <div className="space-y-1.5">
                  {pendingClaims.map((claim) => (
                    <div key={claim.slotType} className="flex items-center justify-between gap-2 text-xs text-(--color-white) bg-(--color-surface-2) rounded-lg px-3 py-2">
                      <span className="truncate">
                        {claim.slotType.charAt(0).toUpperCase() + claim.slotType.slice(1)} slot
                        <span className="text-(--color-muted)">: {claim.adType === 'lbar' ? 'L-Bar' : 'Corner Badge'}, {claim.adSize}</span>
                      </span>
                      <button
                        onClick={() => downloadImage(claim.imageUrl)}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-(--color-surface-3) hover:bg-(--color-surface-1) text-[11px] font-medium"
                      >
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                <span className="truncate">{adFile ? adFile.name : 'Choose your raw video file…'}</span>
                {adFile && <span className="ml-auto shrink-0 text-[10px] text-(--color-muted)">{(adFile.size / 1024 / 1024).toFixed(1)} MB</span>}
              </button>
              <p className="text-[10px] text-(--color-muted) mt-1">Upload the video as-is — Yepper injects the claimed ad(s) for you.</p>
            </div>

            {/* Confirm which claimed placements this edit actually includes */}
            {showSlotConfirmPanel && (
              <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-3 space-y-3">
                {isShortVideo ? (
                  <p className="text-xs text-(--color-white)">This video is under 5 minutes, so it only has the middle slot.</p>
                ) : (
                  <p className="text-xs font-bold text-(--color-white)">Which placements did you include in this edit?</p>
                )}
                <div className="space-y-1.5">
                  {relevantClaimedSlots.map((slot) => {
                    const claim = pendingClaims.find((c) => c.slotType === slot.key);
                    return (
                      <label key={slot.key} className="flex items-center gap-2 text-xs cursor-pointer text-(--color-white)">
                        <input
                          type="checkbox"
                          checked={includedSlots.includes(slot.key)}
                          onChange={() => toggleSlot(slot.key)}
                          disabled={adUploading}
                          className="accent-emerald-500"
                        />
                        {slot.label}
                        {claim ? `: ${claim.adType === 'lbar' ? 'L-Bar' : 'Corner Badge'}, ${claim.adSize}` : ''}
                      </label>
                    );
                  })}
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

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={close} disabled={adUploading} className="flex-1 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white) disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!adFile || adUploading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
              >
                <CloudArrowUpIcon className="w-4 h-4" />
                {adUploading ? 'Uploading…' : 'Upload & Process'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



// 'use client';

// import { useEffect, useRef, useState } from 'react';
// import {
//   ArrowDownTrayIcon,
//   CheckCircleIcon,
//   CloudArrowUpIcon,
//   FilmIcon,
//   XMarkIcon,
// } from '@heroicons/react/24/outline';
// import { getToken } from '@/app/(adsense)/utils/token';

// // Video uploads go straight to the Render backend, bypassing the Next.js API
// // route proxy: Vercel Serverless Functions hard-cap request bodies at
// // ~4.5MB regardless of streaming, which any real video file blows past.
// const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// // The video relay (raw upload to YouTube, no processing) runs on a separate,
// // leaner Render service from the main API. Job status is still readable from
// // BACKEND_URL below since both services share the same ad_video_jobs table.
// const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:5050';

// // Under 5 minutes: the video gets exactly one ad slot, forced to the middle;
// // no choice. 5 minutes or longer: three candidate slots open up (just after
// // the 5-minute mark, the middle, and the 80%-through point), and an
// // advertiser can claim any one of them.
// const SHORT_VIDEO_THRESHOLD_SEC = 5 * 60;

// function formatTime(seconds: number): string {
//   const m = Math.floor(seconds / 60);
//   const s = Math.round(seconds % 60);
//   return `${m}:${String(s).padStart(2, '0')}`;
// }

// interface AdSlot { key: string; label: string; time: number; }
// interface PendingClaim { slotType: string; imageUrl: string; adType: string; adSize: string; }

// function getAdSlots(duration: number): AdSlot[] {
//   if (duration < SHORT_VIDEO_THRESHOLD_SEC) {
//     return [{ key: 'middle', label: `Middle (${formatTime(duration / 2)})`, time: duration / 2 }];
//   }
//   return [
//     { key: 'intro',  label: `After intro (${formatTime(SHORT_VIDEO_THRESHOLD_SEC)})`, time: SHORT_VIDEO_THRESHOLD_SEC },
//     { key: 'middle', label: `Middle (${formatTime(duration / 2)})`,                   time: duration / 2 },
//     { key: 'end',    label: `Near the end (${formatTime(duration * 0.8)})`,           time: duration * 0.8 },
//   ];
// }

// function downloadImage(url: string) {
//   // Claimed creatives live on Cloudinary (cross-origin), so the anchor
//   // `download` attribute is ignored by the browser: opening in a new tab
//   // lets the creator save it themselves via right-click / browser controls.
//   window.open(url, '_blank');
// }

// // Extracted from connect-accounts/page.tsx's inline "Post Ad" modal so the
// // dashboard's right-rail "Add ad" action can reuse the exact same upload
// // flow (POST /api/social/post-ad/:provider, cookie auth, no other inputs
// // required) without duplicating it.
// //
// // Advertisers' creatives never get burned into the video on Yepper's servers.
// // The creator downloads the claimed image(s) here, edits them into the
// // video themselves with their own tools, and uploads the finished file. This
// // route is a plain relay to YouTube; it doesn't inspect the video at all.
// export default function PostAdModal({
//   provider,
//   open,
//   onClose,
//   onPosted,
// }: {
//   provider: string | null;
//   open: boolean;
//   onClose: () => void;
//   onPosted?: () => void;
// }) {
//   const [adFile, setAdFile]                     = useState<File | null>(null);
//   const [adTitle, setAdTitle]                   = useState('');
//   const [adDescription, setAdDescription]       = useState('');
//   const [adPrivacy, setAdPrivacy]               = useState<'public' | 'unlisted'>('public');
//   const [adUploading, setAdUploading]           = useState(false);
//   const [adUploadProgress, setAdUploadProgress] = useState(0);
//   const [adUploadResult, setAdUploadResult]     = useState<{ trackingCode: string; videoUrl: string | null } | null>(null);
//   const [adUploadError, setAdUploadError]       = useState('');
//   const [uploadStage, setUploadStage]           = useState<'idle' | 'transferring' | 'queued' | 'uploading'>('idle');
//   const [stageMessage, setStageMessage]         = useState('');
//   const pollCancelRef = useRef(false);

//   // Ad creatives an advertiser has already claimed on this creator's channel
//   // (via "Collaborate with [creator]" on the homepage), downloadable here so
//   // the creator can edit them into their video before uploading it.
//   const [videoDuration, setVideoDuration]       = useState<number | null>(null);
//   const [includedSlots, setIncludedSlots]       = useState<string[]>([]);
//   const [pendingClaims, setPendingClaims]       = useState<PendingClaim[]>([]);

//   const [prevSlotsKey, setPrevSlotsKey]         = useState('');

//   const fileRef = useRef<HTMLInputElement | null>(null);

//   useEffect(() => {
//     if (open) {
//       pollCancelRef.current = true; // cancel any poll loop left over from a previous open
//       setAdFile(null);
//       setAdTitle('');
//       setAdDescription('');
//       setAdPrivacy('public');
//       setAdUploading(false);
//       setAdUploadProgress(0);
//       setAdUploadResult(null);
//       setAdUploadError('');
//       setUploadStage('idle');
//       setStageMessage('');
//       setVideoDuration(null);
//       setIncludedSlots([]);
//       setPrevSlotsKey('');
//       setPendingClaims([]);
//     } else {
//       pollCancelRef.current = true;
//     }
//   }, [open, provider]);

//   // Pull any ad spaces an advertiser has already claimed for this creator,
//   // shown immediately, independent of picking a video, so the creator can
//   // grab the image(s) whenever they're ready to start editing.
//   useEffect(() => {
//     if (!open) return;
//     fetch('/api/social/ad-claims/pending', { credentials: 'include', cache: 'no-store' })
//       .then((r) => r.json())
//       .then((json) => setPendingClaims(Array.isArray(json?.data) ? json.data : []))
//       .catch(() => setPendingClaims([]));
//   }, [open]);

//   // Once the video is picked, read its duration client-side: that's what
//   // decides whether this is a "forced single mid-roll" video (<5min) or a
//   // "pick your slots" video (5min+).
//   useEffect(() => {
//     if (!adFile) { setVideoDuration(null); return; }
//     const url = URL.createObjectURL(adFile);
//     const video = document.createElement('video');
//     video.preload = 'metadata';
//     video.onloadedmetadata = () => {
//       setVideoDuration(video.duration);
//       URL.revokeObjectURL(url);
//     };
//     video.src = url;
//     return () => URL.revokeObjectURL(url);
//   }, [adFile]);

//   const claimedSlotKeys      = new Set(pendingClaims.map((c) => c.slotType));
//   const isShortVideo         = videoDuration != null && videoDuration < SHORT_VIDEO_THRESHOLD_SEC;
//   const adSlots               = videoDuration != null ? getAdSlots(videoDuration) : [];
//   const relevantClaimedSlots = adSlots.filter((s) => claimedSlotKeys.has(s.key));
//   const hasRelevantClaims    = relevantClaimedSlots.length > 0;

//   // Defaults to every relevant claimed slot once they're known: for a short
//   // video there's only one possible slot, so it's pre-checked automatically.
//   // Adjusted during render (not an effect) per https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
//   const relevantSlotsKey = relevantClaimedSlots.map((s) => s.key).join(',');
//   if (relevantSlotsKey !== prevSlotsKey) {
//     setPrevSlotsKey(relevantSlotsKey);
//     if (relevantSlotsKey) setIncludedSlots(relevantClaimedSlots.map((s) => s.key));
//   }

//   const showSlotConfirmPanel = !!adFile && videoDuration != null && hasRelevantClaims;

//   const toggleSlot = (key: string) => {
//     setIncludedSlots((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
//   };

//   if (!open || !provider) return null;

//   const close = () => { if (!adUploading) onClose(); };

//   // Polls the backend job created by handlePostAd. The YouTube upload runs in
//   // the background on the server; without this, the original code waited on
//   // a single held-open request for that whole pipeline, which Render's
//   // reverse-proxy idle timeout would kill (502) on anything but a short, fast
//   // video.
//   const pollJobStatus = (jobId: string) => new Promise<void>((resolve) => {
//     const authHeaders: Record<string, string> = {};
//     const token = getToken();
//     if (token) authHeaders.Authorization = `Bearer ${token}`;

//     const tick = async () => {
//       if (pollCancelRef.current) { resolve(); return; }
//       try {
//         const res = await fetch(`${BACKEND_URL}/api/social/post-ad/jobs/${jobId}`, {
//           credentials: 'include',
//           headers: authHeaders,
//         });
//         const json = await res.json();
//         const job = json?.data;
//         if (!json?.success || !job) {
//           setAdUploadError('Lost track of the upload, please check back in a minute or try again');
//           setAdUploading(false);
//           setUploadStage('idle');
//           resolve();
//           return;
//         }

//         if (job.status === 'queued' || job.status === 'uploading') {
//           setUploadStage(job.status);
//           setStageMessage(job.stage_message || '');
//           setAdUploadProgress(job.status === 'queued' ? 15 : 60);
//           setTimeout(tick, 2000);
//           return;
//         }

//         if (job.status === 'done') {
//           setAdUploadProgress(100);
//           setAdUploadResult({ trackingCode: job.result?.trackingCode, videoUrl: job.result?.videoUrl ?? null });
//           onPosted?.();
//         } else if (job.error_code === 'reconnect_required') {
//           setAdUploadError('YouTube upload not authorized. Please disconnect and reconnect your YouTube account to grant upload permissions.');
//         } else {
//           setAdUploadError(job.error_message || 'Upload failed');
//         }
//         setAdUploading(false);
//         setUploadStage('idle');
//         resolve();
//       } catch {
//         setTimeout(tick, 3000); // transient blip while polling: retry rather than failing the whole job
//       }
//     };
//     tick();
//   });

//   const handlePostAd = async () => {
//     if (!adFile || !provider || adUploading) return;
//     pollCancelRef.current = false;
//     setAdUploading(true);
//     setAdUploadProgress(0);
//     setAdUploadError('');
//     setAdUploadResult(null);

//     setUploadStage('transferring');
//     setStageMessage('Uploading video…');
//     setAdUploadProgress(0);

//     try {
//       const formData = new FormData();
//       formData.append('video',       adFile);
//       formData.append('title',       adTitle.trim() || adFile.name.replace(/\.[^.]+$/, ''));
//       formData.append('description', adDescription.trim());
//       formData.append('privacy',     adPrivacy);
//       if (hasRelevantClaims && includedSlots.length) {
//         // Tells the backend which advertiser claims this edit covers, so
//         // they get marked "used" once the post succeeds.
//         formData.append('claimedSlotTypes', JSON.stringify(includedSlots));
//       }

//       // Use XMLHttpRequest so we can track upload progress. This request now
//       // only covers the file transfer; it returns a jobId as soon as the
//       // video lands on the backend, well before the YouTube relay starts.
//       const result = await new Promise<{ success: boolean; data?: { jobId: string }; message?: string; code?: string }>((resolve) => {
//         const xhr = new XMLHttpRequest();
//         xhr.upload.onprogress = (e) => {
//           if (e.lengthComputable) setAdUploadProgress(Math.round((e.loaded / e.total) * 100));
//         };
//         xhr.onload = () => {
//           try { resolve(JSON.parse(xhr.responseText)); }
//           catch { resolve({ success: false, message: 'Invalid response' }); }
//         };
//         xhr.onerror = () => resolve({ success: false, message: 'Network error' });
//         xhr.open('POST', `${WORKER_URL}/api/social/post-ad/${provider}`);
//         xhr.withCredentials = true;
//         // The login cookie is SameSite=Lax and scoped to this site, not the
//         // backend's; it won't ride along on this cross-origin request, so
//         // send the same JWT explicitly via the non-httpOnly yepper_token cookie.
//         const token = getToken();
//         if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
//         xhr.send(formData);
//       });

//       if (!result.success || !result.data?.jobId) {
//         if (result.code === 'reconnect_required') {
//           setAdUploadError('YouTube upload not authorized. Please disconnect and reconnect your YouTube account to grant upload permissions.');
//         } else {
//           setAdUploadError(result.message || 'Upload failed');
//         }
//         setAdUploading(false);
//         setUploadStage('idle');
//         return;
//       }

//       setUploadStage('queued');
//       setStageMessage('Queued');
//       await pollJobStatus(String(result.data.jobId));
//     } catch {
//       setAdUploadError('Upload failed unexpectedly');
//       setAdUploading(false);
//       setUploadStage('idle');
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
//       <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">

//         <div className="flex items-center justify-between mb-5">
//           <div>
//             <h3 className="text-lg font-bold text-(--color-white)">Post Ad: {provider.charAt(0).toUpperCase() + provider.slice(1)}</h3>
//             <p className="text-xs text-(--color-muted) mt-0.5">A unique tracking code will be added to your video description automatically.</p>
//           </div>
//           <button onClick={close} disabled={adUploading} className="p-1 rounded-full hover:bg-(--color-surface-2) disabled:opacity-40">
//             <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
//           </button>
//         </div>

//         {adUploadResult ? (
//           <div className="space-y-4">
//             <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
//               <CheckCircleIcon className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
//               <p className="text-sm font-bold text-emerald-400">Video posted successfully!</p>
//               <p className="text-xs text-(--color-muted) mt-1">Tracking code embedded in description</p>
//               <p className="text-base font-mono font-bold text-(--color-white) mt-2">{adUploadResult.trackingCode}</p>
//             </div>
//             {adUploadResult.videoUrl && (
//               <a href={adUploadResult.videoUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-medium text-blue-400 hover:underline">
//                 View on YouTube →
//               </a>
//             )}
//             <button onClick={close} className="w-full py-2.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-sm font-medium text-(--color-white)">
//               Close
//             </button>
//           </div>
//         ) : (
//           <div className="space-y-4">
//             {/* Advertiser creatives claimed on this channel, downloadable any time, independent of picking a video */}
//             {pendingClaims.length > 0 && (
//               <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
//                 <p className="text-xs font-bold text-emerald-400">Ad images ready for you to use</p>
//                 <p className="text-[10px] text-(--color-muted)">
//                   Download these and edit them into your video yourself, then upload the finished file below.
//                 </p>
//                 <div className="space-y-1.5">
//                   {pendingClaims.map((claim) => (
//                     <div key={claim.slotType} className="flex items-center justify-between gap-2 text-xs text-(--color-white) bg-(--color-surface-2) rounded-lg px-3 py-2">
//                       <span className="truncate">
//                         {claim.slotType.charAt(0).toUpperCase() + claim.slotType.slice(1)} slot
//                         <span className="text-(--color-muted)">: {claim.adType === 'lbar' ? 'L-Bar' : 'Corner Badge'}, {claim.adSize}</span>
//                       </span>
//                       <button
//                         onClick={() => downloadImage(claim.imageUrl)}
//                         className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-(--color-surface-3) hover:bg-(--color-surface-1) text-[11px] font-medium"
//                       >
//                         <ArrowDownTrayIcon className="w-3.5 h-3.5" />
//                         Download
//                       </button>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* File picker */}
//             <div>
//               <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Video File *</label>
//               <input
//                 ref={fileRef}
//                 type="file"
//                 accept="video/*"
//                 className="hidden"
//                 onChange={(e) => setAdFile(e.target.files?.[0] ?? null)}
//               />
//               <button
//                 onClick={() => fileRef.current?.click()}
//                 disabled={adUploading}
//                 className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-2) hover:bg-(--color-surface-3) transition-colors text-sm text-(--color-muted) disabled:opacity-50"
//               >
//                 <FilmIcon className="w-5 h-5 shrink-0" />
//                 <span className="truncate">{adFile ? adFile.name : 'Choose your edited video file…'}</span>
//                 {adFile && <span className="ml-auto shrink-0 text-[10px] text-(--color-muted)">{(adFile.size / 1024 / 1024).toFixed(1)} MB</span>}
//               </button>
//               <p className="text-[10px] text-(--color-muted) mt-1">Upload the video after you&apos;ve already edited the ad image(s) into it.</p>
//             </div>

//             {/* Confirm which claimed placements this edit actually includes */}
//             {showSlotConfirmPanel && (
//               <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-3 space-y-3">
//                 {isShortVideo ? (
//                   <p className="text-xs text-(--color-white)">This video is under 5 minutes, so it only has the middle slot.</p>
//                 ) : (
//                   <p className="text-xs font-bold text-(--color-white)">Which placements did you include in this edit?</p>
//                 )}
//                 <div className="space-y-1.5">
//                   {relevantClaimedSlots.map((slot) => {
//                     const claim = pendingClaims.find((c) => c.slotType === slot.key);
//                     return (
//                       <label key={slot.key} className="flex items-center gap-2 text-xs cursor-pointer text-(--color-white)">
//                         <input
//                           type="checkbox"
//                           checked={includedSlots.includes(slot.key)}
//                           onChange={() => toggleSlot(slot.key)}
//                           disabled={adUploading}
//                           className="accent-emerald-500"
//                         />
//                         {slot.label}
//                         {claim ? `: ${claim.adType === 'lbar' ? 'L-Bar' : 'Corner Badge'}, ${claim.adSize}` : ''}
//                       </label>
//                     );
//                   })}
//                 </div>
//               </div>
//             )}

//             {/* Title */}
//             <div>
//               <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Title</label>
//               <input
//                 value={adTitle}
//                 onChange={(e) => setAdTitle(e.target.value)}
//                 placeholder="Enter video title…"
//                 disabled={adUploading}
//                 className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 disabled:opacity-50"
//               />
//             </div>

//             {/* Description */}
//             <div>
//               <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Description / Caption</label>
//               <textarea
//                 value={adDescription}
//                 onChange={(e) => setAdDescription(e.target.value)}
//                 placeholder="Add a description, mentions, hashtags…"
//                 rows={3}
//                 disabled={adUploading}
//                 className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 resize-none disabled:opacity-50"
//               />
//               <p className="text-[10px] text-(--color-muted) mt-1">A tracking code (e.g. <span className="font-mono text-emerald-400">#YPR-YT-001</span>) will be appended automatically.</p>
//             </div>

//             {/* Privacy */}
//             <div>
//               <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Privacy</label>
//               <div className="flex gap-2">
//                 {(['public', 'unlisted'] as const).map((p) => (
//                   <button
//                     key={p}
//                     onClick={() => setAdPrivacy(p)}
//                     disabled={adUploading}
//                     className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${adPrivacy === p ? 'bg-(--color-white) text-black border-transparent' : 'bg-(--color-surface-2) text-(--color-muted) border-(--color-border) hover:text-(--color-white)'} disabled:opacity-50`}
//                   >
//                     {p.charAt(0).toUpperCase() + p.slice(1)}
//                   </button>
//                 ))}
//               </div>
//             </div>

//             {/* Error */}
//             {adUploadError && (
//               <p className="text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{adUploadError}</p>
//             )}

//             {/* Progress bar */}
//             {adUploading && (
//               <div>
//                 <div className="flex justify-between text-xs text-(--color-muted) mb-1">
//                   <span>{stageMessage || (uploadStage === 'transferring' ? 'Uploading video…' : 'Working…')}</span>
//                   <span>{adUploadProgress}%</span>
//                 </div>
//                 <div className="w-full h-2 rounded-full bg-(--color-surface-2) overflow-hidden">
//                   <div className="h-full rounded-full bg-red-500 transition-all duration-300" style={{ width: `${adUploadProgress}%` }} />
//                 </div>
//               </div>
//             )}

//             {/* Actions */}
//             <div className="flex gap-3 pt-1">
//               <button onClick={close} disabled={adUploading} className="flex-1 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white) disabled:opacity-40">
//                 Cancel
//               </button>
//               <button
//                 onClick={handlePostAd}
//                 disabled={!adFile || adUploading}
//                 className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
//               >
//                 <CloudArrowUpIcon className="w-4 h-4" />
//                 {adUploading ? 'Uploading…' : 'Upload & Post'}
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
