'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  CloudArrowUpIcon,
  FilmIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

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

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setAdFile(null);
      setAdTitle('');
      setAdDescription('');
      setAdPrivacy('public');
      setAdUploading(false);
      setAdUploadProgress(0);
      setAdUploadResult(null);
      setAdUploadError('');
    }
  }, [open, provider]);

  if (!open || !provider) return null;

  const close = () => { if (!adUploading) onClose(); };

  const handlePostAd = async () => {
    if (!adFile || !provider || adUploading) return;
    setAdUploading(true);
    setAdUploadProgress(0);
    setAdUploadError('');
    setAdUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('video',       adFile);
      formData.append('title',       adTitle.trim() || adFile.name.replace(/\.[^.]+$/, ''));
      formData.append('description', adDescription.trim());
      formData.append('privacy',     adPrivacy);

      // Use XMLHttpRequest so we can track upload progress
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
        xhr.open('POST', `/api/social/post-ad/${provider}`);
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      if (!result.success) {
        if (result.code === 'reconnect_required') {
          setAdUploadError('YouTube upload not authorized. Please disconnect and reconnect your YouTube account to grant upload permissions.');
        } else {
          setAdUploadError(result.message || 'Upload failed');
        }
      } else {
        setAdUploadResult({ trackingCode: result.data?.trackingCode, videoUrl: result.data?.videoUrl });
        onPosted?.();
      }
    } catch {
      setAdUploadError('Upload failed unexpectedly');
    } finally {
      setAdUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl w-full max-w-lg p-6">

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
                  <span>Uploading to YouTube…</span>
                  <span>{adUploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-(--color-surface-2) overflow-hidden">
                  <div className="h-full rounded-full bg-red-500 transition-all duration-300" style={{ width: `${adUploadProgress}%` }} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={close} disabled={adUploading} className="flex-1 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-2) text-sm font-medium text-(--color-white) disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={handlePostAd}
                disabled={!adFile || adUploading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
              >
                <CloudArrowUpIcon className="w-4 h-4" />
                {adUploading ? 'Uploading…' : 'Upload & Post'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
