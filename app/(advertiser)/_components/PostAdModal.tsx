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
import TikTokSponsoredPosts from './TikTokSponsoredPosts';

// Large videos go directly to the paid backend so they do not pass through
// the frontend deployment's request-size and execution limits.
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const DEDICATED_VIDEO_API_URL = process.env.NEXT_PUBLIC_AD_VIDEO_API_URL
  || 'https://yepper-creators-video-worker-2ohx.onrender.com';
const VIDEO_API_URL = (
  DEDICATED_VIDEO_API_URL || BACKEND_URL
).replace(/\/$/, '');
const MAX_VIDEO_SIZE_MB = Number(process.env.NEXT_PUBLIC_MAX_AD_VIDEO_SIZE_MB || 100);
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_AWS_VIDEO_SIZE_GB = Number(process.env.NEXT_PUBLIC_MAX_AWS_AD_VIDEO_SIZE_GB || 100);
const MAX_AWS_VIDEO_SIZE_BYTES = MAX_AWS_VIDEO_SIZE_GB * 1024 * 1024 * 1024;
const MAX_VIDEO_DURATION_MINUTES = Number(process.env.NEXT_PUBLIC_MAX_LONG_VIDEO_MINUTES || 150);
const MAX_VIDEO_DURATION_SEC = MAX_VIDEO_DURATION_MINUTES * 60;
const MAX_VIDEO_WIDTH = 3840;
const MAX_VIDEO_HEIGHT = 2160;

const PERCENTAGE_SLOTS = [
  { key: '8pct', label: '8%' },
  { key: '25pct', label: '25%' },
  { key: '45pct', label: '45%' },
  { key: '65pct', label: '65%' },
  { key: '85pct', label: '85%' },
] as const;

function formatTime(seconds: number): string {
  const roundedSeconds = Math.round(seconds);
  const m = Math.floor(roundedSeconds / 60);
  const s = roundedSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDurationEstimate(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `about ${hours} hr ${remainingMinutes} min` : `about ${hours} hr`;
}

interface AdSlot { key: string; label: string; time: number; }
interface PendingClaim { slotType: string; imageUrl: string; adType: string; adSize: string; status: string; saved?: boolean; }
interface AdPlacement { slotType: string; startsAt: number; endsAt: number; }
interface AdVideoJobStatus {
  status: string;
  pipeline?: string;
  stage_message?: string;
  progress?: number;
  queue_position?: number;
  estimated_remaining_seconds?: number | null;
  priority_applied?: boolean;
  error_message?: string;
}
interface AdVideoUploadResponse {
  success?: boolean;
  data?: {
    jobId?: string | number;
    partSize?: number;
    totalParts?: number;
    priorityApplied?: boolean;
    priorityFeeRwf?: number;
  };
  message?: string;
}
interface AdVideoPriorityOffer {
  enabled: boolean;
  feeRwf: number;
  balanceRwf: number;
  eligible: boolean;
}
interface AwsUploadPart {
  ETag: string;
  PartNumber: number;
}
interface DownloadWritable {
  write(data: Uint8Array | Blob): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
interface DownloadFileHandle {
  createWritable(): Promise<DownloadWritable>;
}
interface WindowWithFilePicker extends Window {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<DownloadFileHandle>;
}

function getAdSlots(duration: number): AdSlot[] {
  return PERCENTAGE_SLOTS.map((slot) => ({
    key: slot.key,
    label: `${slot.label} (${formatTime(duration * (Number(slot.key.replace(/pct$/, '')) / 100))})`,
    time: duration * (Number(slot.key.replace(/pct$/, '')) / 100),
  }));
}

// Extracted from connect-accounts/page.tsx's inline "Post Ad" modal so the
// dashboard's right-rail "Add ad" action can reuse the exact same upload
// flow (POST /api/social/post-ad/:provider, cookie auth, multipart video)
// without duplicating it.
//
// The creator uploads their raw video; the short-video Cloudinary path or
// long-video AWS MediaConvert path injects the claimed creatives server-side.
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
  const [uploadProgress, setUploadProgress]     = useState(0);
  const [uploadStageMessage, setUploadStageMessage] = useState('');
  const [adUploadResult, setAdUploadResult]     = useState<{ trackingCode: string; videoUrl: string | null } | null>(null);
  const [adUploadError, setAdUploadError]       = useState('');

  // Yepper injects the claimed creative(s) into the video server-side.
  // 'job' tracks that processing job; once it's done, 'pendingPost' holds the
  // tracking code (to paste into the description) and the download is ready.
  const [jobId, setJobId]                       = useState<string | null>(null);
  const [jobPipeline, setJobPipeline]           = useState<string | null>(null);
  const [jobStatus, setJobStatus]               = useState<AdVideoJobStatus | null>(null);
  const [jobConnectionWarning, setJobConnectionWarning] = useState('');
  const [pendingPost, setPendingPost]           = useState<{ postId: string; trackingCode: string; description: string; adPlacements?: AdPlacement[] } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloaded, setDownloaded]             = useState(false);
  const [downloading, setDownloading]           = useState(false);
  const [publishedUrl, setPublishedUrl]         = useState('');
  const [confirming, setConfirming]             = useState(false);
  const [copied, setCopied]                     = useState(false);

  // Ad creatives an advertiser has already claimed on this creator's channel
  // (via "Collaborate with [creator]" on the homepage), downloadable here so
  // the creator can edit them into their video before uploading it.
  const [videoDuration, setVideoDuration]       = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions]   = useState<{ width: number; height: number } | null>(null);
  const [videoResolutionValid, setVideoResolutionValid] = useState<boolean | null>(null);
  const [includedSlots, setIncludedSlots]       = useState<string[]>([]);
  const [pendingClaims, setPendingClaims]       = useState<PendingClaim[]>([]);
  const [priorityOffer, setPriorityOffer]       = useState<AdVideoPriorityOffer | null>(null);
  const [priorityRequested, setPriorityRequested] = useState(false);
  const [priorityOfferError, setPriorityOfferError] = useState('');

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
    if (!open || !provider) return;
    const savedJobId = window.sessionStorage.getItem(`yepper-ad-video-job:${provider}`);
    setAdFile(null);
    setAdTitle('');
    setAdDescription('');
    setAdPrivacy('public');
    setAdUploading(!!savedJobId);
    setUploadProgress(0);
    setUploadStageMessage('');
    setAdUploadResult(null);
    setAdUploadError('');
    setJobId(savedJobId);
    setJobPipeline(null);
    setJobStatus(null);
    setPendingPost(null);
    setDownloadProgress(null);
    setDownloaded(false);
    setDownloading(false);
    setPublishedUrl('');
    setConfirming(false);
    setCopied(false);
    setVideoDuration(null);
    setVideoDimensions(null);
    setVideoResolutionValid(null);
    setIncludedSlots([]);
    setPrevSlotsKey('');
    setPendingClaims([]);
  }, [open, provider]);

  // Poll the processing job until it's done (or errors out).
  useEffect(() => {
    if (!jobId || !open) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveFailures = 0;
    let tick: () => Promise<void>;

    const retryDelay = () => Math.min(30_000, 3_000 * (2 ** Math.min(consecutiveFailures - 1, 4)));
    const scheduleRetry = (delay: number) => {
      retryTimer = setTimeout(tick, delay);
    };

    tick = async () => {
      try {
        const res = await authedFetch(`${VIDEO_API_URL}/api/social/post-ad/jobs/${jobId}`);
        if (cancelled) return;
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          if (res.status === 429 || res.status >= 500) {
            consecutiveFailures += 1;
            setJobConnectionWarning(
              `The video service is temporarily unavailable (HTTP ${res.status}). Your job is saved; retrying automatically.`,
            );
            const retryAfter = Number(res.headers.get('Retry-After'));
            scheduleRetry(Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 60_000)
              : retryDelay());
            return;
          }
          setAdUploadError(json?.message || `Could not retrieve processing status (HTTP ${res.status}).`);
          setAdUploading(false);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (!json?.success) {
          setAdUploadError(json?.message || 'Could not retrieve video processing status. Reopen the upload to try again.');
          setAdUploading(false);
          return;
        }
        consecutiveFailures = 0;
        setJobConnectionWarning('');
        setJobStatus(json.data);
        if (json.data.pipeline) setJobPipeline(json.data.pipeline);
        if (json.data.status === 'done') {
          const result = json.data.result ? (typeof json.data.result === 'string' ? JSON.parse(json.data.result) : json.data.result) : null;
          if (result) setPendingPost(result);
          setAdUploading(false);
        } else if (json.data.status === 'error') {
          setAdUploadError(json.data.error_message || 'Processing failed, please try again');
          setAdUploading(false);
        } else if (json.data.status === 'rejected') {
          setAdUploadError(json.data.error_message || 'Your video was not approved for processing.');
          setAdUploading(false);
        } else {
          scheduleRetry(5000);
        }
      } catch {
        if (!cancelled) {
          consecutiveFailures += 1;
          setJobConnectionWarning(
            'The video service connection dropped. Your job is saved; reconnecting automatically.',
          );
          scheduleRetry(retryDelay());
        }
      }
    };
    tick();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, open, provider]);

  // Pull any ad spaces an advertiser has already claimed for this creator,
  // shown immediately, independent of picking a video, so the creator can
  // grab the image(s) whenever they're ready to start editing.
  useEffect(() => {
    if (!open) return;
    fetch('/api/social/ad-claims/pending', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        const claims = Array.isArray(json?.data) ? json.data : [];
        setPendingClaims(claims);
        setIncludedSlots(claims
          .filter((claim: PendingClaim) => claim.status === 'pending')
          .map((claim: PendingClaim) => claim.slotType));
      })
      .catch(() => setPendingClaims([]));
  }, [open]);

  useEffect(() => {
    if (!open || !adFile || adFile.size <= MAX_VIDEO_SIZE_BYTES) return;
    let cancelled = false;
    authedFetch(`${VIDEO_API_URL}/api/social/post-ad/priority-offer`)
      .then(async (response) => {
        const json: { success?: boolean; data?: AdVideoPriorityOffer } = await response.json();
        if (!response.ok || !json.success || !json.data) {
          throw new Error('Could not load priority options.');
        }
        if (!cancelled) setPriorityOffer(json.data);
      })
      .catch(() => {
        if (!cancelled) {
          setPriorityOffer(null);
          setPriorityOfferError('Could not check your wallet for priority processing. Standard processing is still available.');
        }
      });
      return () => { cancelled = true; };
  }, [open, adFile]);

  // Once the video is picked, read its duration client-side so the creator can
  // either select one or many of the fixed percentage slots that Yupper will
  // inject at runtime.
  useEffect(() => {
    if (!adFile) { setVideoDuration(null); setVideoDimensions(null); setVideoResolutionValid(null); return; }
    const url = URL.createObjectURL(adFile);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
      if (video.duration > MAX_VIDEO_DURATION_SEC) {
        setAdUploadError(`Video is too long. Please choose a video no longer than ${MAX_VIDEO_DURATION_MINUTES} minutes.`);
        setVideoResolutionValid(false);
      } else if (video.videoWidth > MAX_VIDEO_WIDTH || video.videoHeight > MAX_VIDEO_HEIGHT) {
        setAdUploadError('Video resolution is too high. Please export it at 4K or lower.');
        setVideoResolutionValid(false);
      } else {
        setVideoResolutionValid(true);
      }
      URL.revokeObjectURL(url);
    };
    video.src = url;
    return () => URL.revokeObjectURL(url);
  }, [adFile]);

  const claimedSlotKeys      = new Set(pendingClaims.filter((claim) => claim.status === 'pending').map((c) => c.slotType));
  const adSlots               = videoDuration != null ? getAdSlots(videoDuration) : [];
  const relevantClaimedSlots = adSlots.filter((slot) => pendingClaims.some((claim) => claim.slotType === slot.key));
  const hasRelevantClaims    = relevantClaimedSlots.some((slot) => claimedSlotKeys.has(slot.key));
  const hasSelectedClaim     = includedSlots.some((slot) => claimedSlotKeys.has(slot));

  // Defaults to every relevant claimed slot once they're known. The creator can
  // choose one or several percentage-based slots instead of a single forced position.
  const relevantSlotsKey = relevantClaimedSlots.filter((slot) => claimedSlotKeys.has(slot.key)).map((slot) => slot.key).join(',');
  if (relevantSlotsKey !== prevSlotsKey) {
    setPrevSlotsKey(relevantSlotsKey);
    if (relevantSlotsKey) setIncludedSlots(relevantClaimedSlots.filter((slot) => claimedSlotKeys.has(slot.key)).map((slot) => slot.key));
  }

  const showSlotConfirmPanel = !!adFile && videoDuration != null && relevantClaimedSlots.length > 0;

  const toggleSlot = (key: string) => {
    setIncludedSlots((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  if (!open || !provider) return null;
  if (provider === 'tiktok') return <TikTokSponsoredPosts onClose={onClose} />;

  const close = () => { if (!adUploading || jobId) onClose(); };

  const uploadLongVideo = async () => {
    if (!provider || !adFile || videoDuration == null || !videoDimensions) return;
    const claimedSlotTypes = includedSlots.filter((slot) => claimedSlotKeys.has(slot));
    if (!claimedSlotTypes.length) {
      throw new Error('Select at least one paid ad placement before processing this video.');
    }

    setUploadStageMessage('Preparing secure multipart upload…');
    const startResponse = await authedFetch(`${VIDEO_API_URL}/api/social/post-ad/${provider}/aws-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: adFile.name,
        contentType: adFile.type || 'video/mp4',
        fileSize: adFile.size,
        duration: videoDuration,
        width: videoDimensions.width,
        height: videoDimensions.height,
        priorityRequested,
        title: adTitle.trim() || adFile.name.replace(/\.[^.]+$/, '') || 'Ad Video',
        description: adDescription.trim(),
        claimedSlotTypes,
      }),
    });
    const startJson: AdVideoUploadResponse = await startResponse.json().catch(() => ({}));
    const startedJobId = startJson.data?.jobId;
    const partSize = startJson.data?.partSize;
    const totalParts = startJson.data?.totalParts;
    if (!startResponse.ok || !startJson.success || !startedJobId || !partSize || !totalParts) {
      throw new Error(startJson.message || `Could not start secure upload (HTTP ${startResponse.status}).`);
    }

    let completed = false;
    try {
      const parts: AwsUploadPart[] = new Array(totalParts);
      let nextPartNumber = 1;
      let uploadedBytes = 0;
      const uploadPart = async () => {
        while (true) {
          const partNumber = nextPartNumber;
          nextPartNumber += 1;
          if (partNumber > totalParts) return;

          const partResponse = await authedFetch(
            `${VIDEO_API_URL}/api/social/post-ad/jobs/${startedJobId}/upload-part-url`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ partNumber }),
            },
          );
          const partJson: { success?: boolean; data?: { url?: string }; message?: string } =
            await partResponse.json().catch(() => ({}));
          if (!partResponse.ok || !partJson.success || !partJson.data?.url) {
            throw new Error(partJson.message || `Could not authorize upload part ${partNumber}.`);
          }

          const start = (partNumber - 1) * partSize;
          const part = adFile.slice(start, Math.min(start + partSize, adFile.size));
          let uploadResponse: Response | null = null;
          let lastError: Error | null = null;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              uploadResponse = await fetch(partJson.data.url, {
                method: 'PUT',
                body: part,
                credentials: 'omit',
              });
              if (uploadResponse.ok) break;
              lastError = new Error(`Storage rejected upload part ${partNumber} (HTTP ${uploadResponse.status}).`);
            } catch {
              lastError = new Error(`Connection interrupted while uploading part ${partNumber}.`);
            }
          }
          if (!uploadResponse?.ok) throw lastError || new Error(`Upload part ${partNumber} failed.`);

          const etag = uploadResponse.headers.get('ETag');
          if (!etag) throw new Error('Storage did not return an ETag for an uploaded part. Check the bucket CORS configuration.');
          parts[partNumber - 1] = { ETag: etag, PartNumber: partNumber };
          uploadedBytes += part.size;
          setUploadProgress(Math.min(99, Math.round(uploadedBytes / adFile.size * 100)));
          setUploadStageMessage(`Uploading securely, part ${partNumber} of ${totalParts}`);
        }
      };

      await Promise.all(Array.from({ length: Math.min(3, totalParts) }, () => uploadPart()));
      setUploadStageMessage('Verifying upload and starting video processing…');
      const completeResponse = await authedFetch(
        `${VIDEO_API_URL}/api/social/post-ad/jobs/${startedJobId}/complete-upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parts }),
        },
      );
      const completeJson: AdVideoUploadResponse = await completeResponse.json().catch(() => ({}));
      if (!completeResponse.ok || !completeJson.success) {
        throw new Error(completeJson.message || `Could not start video processing (HTTP ${completeResponse.status}).`);
      }

      completed = true;
      setUploadProgress(100);
      setJobId(String(startedJobId));
      setJobPipeline('aws');
      window.sessionStorage.setItem(`yepper-ad-video-job:${provider}`, String(startedJobId));
      setJobStatus({
        status: 'pending_approval',
        stage_message: completeJson.message
          || (completeJson.data?.priorityApplied ? 'Priority processing started…' : 'Video uploaded; waiting for processing to start…'),
        progress: 0,
        priority_applied: completeJson.data?.priorityApplied,
      });
    } finally {
      if (!completed) {
        await authedFetch(`${VIDEO_API_URL}/api/social/post-ad/jobs/${startedJobId}/abort-upload`, {
          method: 'POST',
        }).catch(() => {});
      }
    }
  };

  // Keep the existing Cloudinary flow unchanged for videos within its size limit.
  const handleUpload = async () => {
    if (!provider || !adFile || adUploading) return;
    if (adFile.size > MAX_AWS_VIDEO_SIZE_BYTES) {
      setAdUploadError(`This video exceeds the ${MAX_AWS_VIDEO_SIZE_GB} GB upload limit.`);
      return;
    }
    if (videoDuration == null) {
      setAdUploadError('Still reading the video length. Please try again in a moment.');
      return;
    }
    if (videoDuration > MAX_VIDEO_DURATION_SEC) {
      setAdUploadError(`Video is too long. Please choose a video no longer than ${MAX_VIDEO_DURATION_MINUTES} minutes.`);
      return;
    }
    if (videoResolutionValid === false) return;
    if (!videoDimensions) {
      setAdUploadError('Still reading the video resolution. Please try again in a moment.');
      return;
    }
    setAdUploading(true);
    setUploadProgress(0);
    setUploadStageMessage(adFile.size > MAX_VIDEO_SIZE_BYTES
      ? 'Preparing long-video processing…'
      : 'Uploading short video…');
    setAdUploadError('');
    setJobConnectionWarning('');
    try {
      if (adFile.size > MAX_VIDEO_SIZE_BYTES) {
        await uploadLongVideo();
        return;
      }
      const form = new FormData();
      form.append('video', adFile);
      form.append('title', adTitle.trim() || adFile.name.replace(/\.[^.]+$/, '') || 'Ad Video');
      form.append('description', adDescription.trim());
      form.append('privacy', adPrivacy);
      if (hasRelevantClaims && includedSlots.length) {
        form.append('claimedSlotTypes', JSON.stringify(includedSlots));
      }
      const token = getToken();
      const uploadResult = await new Promise<{ status: number; data: AdVideoUploadResponse }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', `${VIDEO_API_URL}/api/social/post-ad/${provider}`);
        request.withCredentials = true;
        if (token) request.setRequestHeader('Authorization', `Bearer ${token}`);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        };
        request.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
        request.onabort = () => reject(new Error('Upload was cancelled.'));
        request.onload = () => {
          try {
            const payload: unknown = JSON.parse(request.responseText);
            if (!payload || typeof payload !== 'object') throw new Error();
            resolve({ status: request.status, data: payload as AdVideoUploadResponse });
          } catch {
            reject(new Error(`The server returned an invalid response (${request.status}).`));
          }
        };
        request.send(form);
      });
      const json = uploadResult.data;
      if (uploadResult.status < 200 || uploadResult.status >= 300 || !json?.success || !json.data?.jobId) {
        setAdUploadError(json?.message || 'Could not start processing, please try again');
        setAdUploading(false);
        return;
      }
      setUploadProgress(100);
      setJobId(String(json.data.jobId));
      window.sessionStorage.setItem(`yepper-ad-video-job:${provider}`, String(json.data.jobId));
      setJobStatus({ status: 'queued', stage_message: 'Waiting for an available processing slot…', progress: 0, queue_position: 1 });
    } catch (err) {
      setAdUploadError(err instanceof Error ? err.message : 'Something went wrong, please try again');
      setAdUploading(false);
    } finally {
      setUploadStageMessage('');
    }
  };

  // Step 2: they've published on their own channel with the code in the
  // description, verify it via the public YouTube API (no OAuth) and mark
  // this post live.
  const handleConfirm = async () => {
    if (!provider || !pendingPost || !publishedUrl.trim() || confirming) return;
    setConfirming(true);
    setAdUploadError('');
    try {
      const res = await authedFetch(`${VIDEO_API_URL}/api/social/post-ad/${provider}/confirm/${pendingPost.postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: publishedUrl.trim(),
          claimedSlotTypes: includedSlots.length ? includedSlots : undefined,
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
    if (!jobId || downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    setAdUploadError('');
    let writable: DownloadWritable | null = null;
    try {
      const pickerWindow = window as WindowWithFilePicker;
      const fileHandle = pickerWindow.showSaveFilePicker
        ? await pickerWindow.showSaveFilePicker({ suggestedName: 'yepper-ad-video.mp4' })
        : null;
      if (!fileHandle && jobPipeline === 'aws') {
        const response = await authedFetch(
          `${VIDEO_API_URL}/api/social/post-ad/jobs/${jobId}/download?direct=1`,
        );
        const json: { success?: boolean; data?: { url?: string }; message?: string } =
          await response.json().catch(() => ({}));
        if (!response.ok || !json.success || !json.data?.url) {
          throw new Error(json.message || `Download could not be started (${response.status}).`);
        }
        window.location.assign(json.data.url);
        return;
      }
      const response = await authedFetch(`${VIDEO_API_URL}/api/social/post-ad/jobs/${jobId}/download`);
      if (!response.ok) {
        const message: { message?: string } = await response.json().catch(() => ({}));
        throw new Error(message.message || `Download failed (${response.status})`);
      }

      const totalBytes = Number(response.headers.get('content-length')) || 0;
      if (!response.body) throw new Error('Your browser cannot stream this download. Please try a current version of Chrome or Edge.');
      const reader = response.body.getReader();
      let receivedBytes = 0;
      if (fileHandle) {
        writable = await fileHandle.createWritable();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writable.write(value);
          receivedBytes += value.byteLength;
          if (totalBytes) setDownloadProgress(Math.min(99, Math.round((receivedBytes / totalBytes) * 100)));
        }
        await writable.close();
        writable = null;
      } else {
        const chunks: BlobPart[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          receivedBytes += value.byteLength;
          if (totalBytes) setDownloadProgress(Math.min(99, Math.round((receivedBytes / totalBytes) * 100)));
        }
        const blobUrl = URL.createObjectURL(new Blob(chunks));
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'yepper-ad-video.mp4';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      }
      setDownloadProgress(100);
      setDownloaded(true);
    } catch (err) {
      if (writable) await writable.abort().catch(() => {});
      if (err instanceof DOMException && err.name === 'AbortError') {
        setDownloadProgress(null);
        return;
      }
      setAdUploadError(err instanceof Error ? err.message : 'Could not download the processed video, please try again');
      setDownloadProgress(null);
    } finally {
      setDownloading(false);
    }
  };

  const startAnotherVideo = () => {
    if (!downloaded) return;
    window.sessionStorage.removeItem(`yepper-ad-video-job:${provider}`);
    setJobId(null);
    setJobStatus(null);
    setPendingPost(null);
    setAdFile(null);
    setAdUploading(false);
    setUploadProgress(0);
    setVideoDuration(null);
    setVideoDimensions(null);
    setVideoResolutionValid(null);
    setIncludedSlots([]);
    setDownloadProgress(null);
    setDownloaded(false);
    setAdUploadError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-(--color-white)">
              {`Post Ad: ${provider.charAt(0).toUpperCase() + provider.slice(1)}`}
            </h3>
            <p className="text-xs text-(--color-muted) mt-0.5">
              Short videos use Cloudinary. Larger videos upload directly to secure storage for background processing.
            </p>
          </div>
          <button onClick={close} disabled={adUploading && !jobId} className="p-1 rounded-full hover:bg-(--color-surface-2) disabled:opacity-40">
            <XMarkIcon className="w-5 h-5 text-(--color-muted)" />
          </button>
        </div>

        {adUploading && !jobId ? (
          <div className="space-y-3 rounded-xl border border-(--color-border) bg-(--color-surface-2) p-4" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-(--color-white)">
                {uploadStageMessage || 'Preparing video…'}
              </p>
              <p className="shrink-0 text-xs font-bold text-(--color-white)">{uploadProgress}%</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-(--color-surface-3)">
              <div className="h-full rounded-full bg-red-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-[10px] text-(--color-muted)">
              {adFile && adFile.size > MAX_VIDEO_SIZE_BYTES
              ? 'Uploading directly to secure storage. Processing may take hours; you can close this window after upload completes.'
                : 'Keep this window open until the short-video upload finishes.'}
            </p>
          </div>
        ) : jobId && !pendingPost ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-4 space-y-3" aria-live="polite">
              <FilmIcon className="w-8 h-8 text-(--color-muted) mx-auto animate-pulse" />
              <p className="text-center text-sm font-medium text-(--color-white)">
                {jobStatus?.status === 'queued'
                  ? `Waiting for processing${jobStatus.queue_position && jobStatus.queue_position > 1 ? `, position ${jobStatus.queue_position} in queue` : '...'}`
                  : jobStatus?.stage_message || 'Processing...'}
              </p>
              <div className="w-full h-2 rounded-full bg-(--color-surface-3) overflow-hidden">
                <div className="h-full rounded-full bg-red-500 transition-all duration-300" style={{ width: `${jobStatus?.progress ?? 0}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-(--color-muted)">
                <span>{jobStatus?.status === 'pending_approval'
                  ? 'Pending approval'
                  : jobStatus?.status === 'approved'
                    ? 'Approved'
                    : jobStatus?.status === 'queued'
                      ? 'Queued'
                      : 'Video processing'}</span>
                <span>{jobStatus?.progress ?? 0}%</span>
              </div>
              <p className="text-[10px] text-(--color-muted)">
                {jobStatus?.status === 'pending_approval'
                  ? 'Your upload is secure. Processing begins after Yepper approves it.'
                  : jobStatus?.status === 'approved'
                    ? 'Your video was approved. MediaConvert will start shortly.'
                    : jobStatus?.status === 'processing' && jobStatus.estimated_remaining_seconds != null
                  ? `Estimated processing time remaining: ${formatDurationEstimate(jobStatus.estimated_remaining_seconds)}. This estimate is based on current progress and is not guaranteed.`
                  : jobStatus?.stage_message?.includes('queue')
                    ? 'Waiting for an AWS processing slot. The render-time estimate will appear after processing starts.'
                  : 'Long videos can take hours. The processing-time estimate appears once enough progress is available. You can close this window; the job keeps running.'}
              </p>
            </div>
            {jobConnectionWarning && (
              <p className="text-xs text-amber-300 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2" role="status">
                {jobConnectionWarning}
              </p>
            )}
            {adUploadError && (
              <p className="text-xs text-red-400 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">{adUploadError}</p>
            )}
            <button onClick={close} className="w-full py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white)">
              Close
            </button>
          </div>
        ) : pendingPost ? (
          <div className="space-y-4">
            {pendingPost.adPlacements?.length ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-xs font-bold text-emerald-300">Ad insertion times in the processed video</p>
                <p className="mt-1 text-xs text-(--color-white)">
                  {pendingPost.adPlacements.map((placement) => (
                    `${formatTime(placement.startsAt)}–${formatTime(placement.endsAt)}`
                  )).join(' · ')}
                  {' '}Seek to these times to verify the ads.
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={downloadProcessedVideo}
              disabled={downloading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {downloading
                ? `Saving video… ${downloadProgress ?? 0}%`
                : downloaded
                  ? 'Downloaded. Download again'
                  : 'Download processed video'}
            </button>
            {downloadProgress !== null && (
              <div className="space-y-1" aria-live="polite">
                <div className="h-2 w-full overflow-hidden rounded-full bg-(--color-surface-3)">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                </div>
                <p className="text-right text-[10px] text-(--color-muted)">
                  {downloading ? `${downloadProgress}% downloaded` : downloaded ? 'Download complete' : ''}
                </p>
              </div>
            )}
            {downloaded && (
              <button
                type="button"
                onClick={startAnotherVideo}
                className="w-full rounded-xl border border-(--color-border) bg-(--color-surface-2) py-2.5 text-sm font-semibold text-(--color-white) hover:bg-(--color-surface-3)"
              >
                Process another video
              </button>
            )}

            <>
                <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-4 space-y-2">
                  <p className="text-xs font-bold text-(--color-muted) uppercase">1. Add this tracking ID to your description</p>
                  <div className="flex items-start gap-2">
                    <pre className="flex-1 whitespace-pre-wrap text-xs font-mono text-(--color-white) bg-(--color-surface-3) rounded-lg p-2.5">{pendingPost.description}</pre>
                    <button onClick={copyCode} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-1) text-[11px] font-medium text-(--color-white)">
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[10px] text-(--color-muted)">
                    Publish the downloaded video on YouTube ({adPrivacy}) with this in the description.
                  </p>
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
                </div>
            </>
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
            {/* File picker */}
            <div>
              <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Video File *</label>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  setPriorityOffer(null);
                  setPriorityRequested(false);
                  setPriorityOfferError('');
                  setAdFile(e.target.files?.[0] ?? null);
                  setAdUploadError('');
                }}
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
              <p className="text-[10px] text-(--color-muted) mt-1">
                Videos up to {MAX_VIDEO_SIZE_MB} MB use the existing Cloudinary path. Larger videos (up to {MAX_AWS_VIDEO_SIZE_GB} GB) upload directly and process in the background.
              </p>
              {adFile && adFile.size > MAX_VIDEO_SIZE_BYTES && (
                <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200" role="status">
                  Long-video processing may take several hours and depends on processing capacity. The original video uploads directly to private storage. The finished MP4 is H.264 at 1080p maximum; 4K sources are downscaled.
                  {videoDuration != null && ` Estimated allowance: ${(videoDuration / 3600).toFixed(2)} hours.`}
                </p>
              )}
              {adFile && adFile.size > MAX_VIDEO_SIZE_BYTES && videoDuration != null && !hasRelevantClaims && (
                <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-[11px] leading-5 text-red-200" role="status">
                  No unused, paid advertiser placement is available for this video&apos;s slots. A processing subscription covers your video hours, but an advertiser must separately purchase a placement before you can process the ad video.
                  {' '}<a href="/studio" className="font-semibold text-emerald-300 underline underline-offset-2">Review Video Studio plans</a>
                </p>
              )}
              {adFile && adFile.size > MAX_VIDEO_SIZE_BYTES && priorityOffer?.enabled && (
                <label className="mt-2 flex items-start gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-2) p-2 text-[11px] text-(--color-white)">
                  <input
                    type="checkbox"
                    checked={priorityRequested}
                    onChange={(event) => setPriorityRequested(event.target.checked)}
                    disabled={!priorityOffer.eligible || adUploading}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span>
                    Request priority processing for {priorityOffer.feeRwf.toLocaleString()} RWF from your creator wallet.
                    {' '}Wallet balance: {priorityOffer.balanceRwf.toLocaleString()} RWF.
                    {!priorityOffer.eligible && ' Add wallet credits to use priority; otherwise the video uses the standard queue.'}
                  </span>
                </label>
              )}
              {priorityOfferError && adFile && adFile.size > MAX_VIDEO_SIZE_BYTES && (
                <p className="mt-2 text-[10px] text-amber-200" role="status">{priorityOfferError}</p>
              )}
            </div>

            {/* Confirm which claimed placements this edit actually includes */}
            {showSlotConfirmPanel && (
              <div className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-3 space-y-3">
                <p className="text-xs font-bold text-(--color-white)">Which percentage slots did you include in this edit?</p>
                <div className="space-y-1.5">
                  {relevantClaimedSlots.map((slot) => {
                    const claimsForSlot = pendingClaims.filter((claim) => claim.slotType === slot.key);
                    const claim = claimsForSlot.find((item) => item.status === 'pending') || claimsForSlot[0];
                    const available = claimsForSlot.some((item) => item.status === 'pending');
                    return (
                      <div key={slot.key} className="flex items-center justify-between gap-2">
                        <label className={`flex items-center gap-2 text-xs ${available ? 'cursor-pointer text-(--color-white)' : 'cursor-not-allowed text-(--color-muted)'}`}>
                          <input
                            type="checkbox"
                            checked={available && includedSlots.includes(slot.key)}
                            onChange={() => toggleSlot(slot.key)}
                            disabled={adUploading || !available}
                            className="accent-emerald-500"
                          />
                          {slot.label}
                          {claim ? `: ${claim.adType === 'lbar' ? 'L-Bar' : 'Corner Badge'}, ${claim.adSize}` : ''}
                          {!available && <span className="text-[10px] text-amber-300">Already used</span>}
                        </label>
                        {claim && (
                          <a
                            href={claim.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-[10px] text-emerald-300 underline"
                          >
                            Open badge image
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!hasRelevantClaims && (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-5 text-amber-100" role="status">
                    These paid placements have already been used. Only a new, unused paid advertiser placement can be added to another video.
                  </p>
                )}
              </div>
            )}

            {/* Metadata fields are only used by the existing short-video upload route. */}
            {(!adFile || adFile.size <= MAX_VIDEO_SIZE_BYTES) && <div>
              <label className="block text-xs font-bold text-(--color-muted) uppercase mb-1.5">Title</label>
              <input
                value={adTitle}
                onChange={(e) => setAdTitle(e.target.value)}
                placeholder="Enter video title…"
                disabled={adUploading}
                className="w-full bg-(--color-surface-2) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm text-(--color-white) outline-none placeholder:text-(--color-muted) focus:border-white/30 disabled:opacity-50"
              />
            </div>}

            {(!adFile || adFile.size <= MAX_VIDEO_SIZE_BYTES) && <div>
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
            </div>}

            {/* Privacy */}
            {(!adFile || adFile.size <= MAX_VIDEO_SIZE_BYTES) && <div>
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
            </div>}

            {/* Error */}
            {adUploadError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2" role="alert">
                <p className="text-xs text-red-300">{adUploadError}</p>
                {adFile && adFile.size > MAX_VIDEO_SIZE_BYTES && adUploadError.toLowerCase().includes('paid ad claim') && (
                  <p className="mt-2 text-[11px] leading-5 text-(--color-muted)">
                    A video-processing plan covers your creator processing hours. It does not replace an advertiser&apos;s paid ad slot.
                    <a href="/studio" className="ml-1 font-semibold text-emerald-300 underline underline-offset-2">View Video Studio plans</a>
                  </p>
                )}
              </div>
            )}
            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={close} disabled={adUploading} className="flex-1 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white) disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!adFile || adUploading || adFile.size > MAX_AWS_VIDEO_SIZE_BYTES || (adFile.size > MAX_VIDEO_SIZE_BYTES && !hasSelectedClaim)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
              >
                <CloudArrowUpIcon className="w-4 h-4" />
                {adUploading ? 'Uploading…' : adFile && adFile.size > MAX_VIDEO_SIZE_BYTES ? 'Upload & Process Long Video' : 'Upload & Process'}
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
