'use client';
// @ts-nocheck

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, Move } from 'lucide-react';

// A Canva/Figma-style crop-and-resize step for an ad image that didn't fit
// the ad space's required size: instead of just rejecting it with a text
// error, show the image against a real-size outline of what's required, let
// the owner drag it around and resize it by its corners until it fully
// covers that outline (the frame turns green the moment it does), then
// export exactly that crop at the exact required pixel dimensions. The
// backend's own size check (adSpaceLayout.js) is still the authoritative
// gate; this only guarantees what gets sent already matches, so that check
// never has anything left to reject.

const STAGE_MAX = 420; // on-screen px budget for the longer side of the frame
const FIT_EPS = 1.5;   // px tolerance before the frame counts as "covered"

interface Props {
  file: File;
  targetWidth: number;
  targetHeight: number;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}

export default function AdImageFitModal({ file, targetWidth, targetHeight, onCancel, onConfirm }: Props) {
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [transform, setTransform] = useState<{ scale: number; x: number; y: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  // Frame: the required aspect ratio, scaled down to fit a comfortable
  // on-screen box. This is the only thing the final export cares about
  // covering — its screen size, not the real target pixels, since the crop
  // math below converts back through `scale` regardless of zoom level.
  const frame = useMemo(() => {
    if (targetWidth >= targetHeight) {
      const w = STAGE_MAX;
      return { w, h: STAGE_MAX * (targetHeight / targetWidth) };
    }
    const h = STAGE_MAX;
    return { w: STAGE_MAX * (targetWidth / targetHeight), h };
  }, [targetWidth, targetHeight]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Once the image is loaded and we know both its natural size and the
  // frame's on-screen size, start it "cover"-fitted and centered — the
  // frame is already fully covered on open, not empty, so there's
  // something to adjust rather than a blank stage to figure out.
  const handleImgLoad = () => {
    const el = imgElRef.current;
    if (!el) return;
    const w = el.naturalWidth, h = el.naturalHeight;
    setNaturalSize({ w, h });
    const coverScale = Math.max(frame.w / w, frame.h / h);
    setTransform({
      scale: coverScale,
      x: (frame.w - w * coverScale) / 2,
      y: (frame.h - h * coverScale) / 2,
    });
  };

  const fits = useMemo(() => {
    if (!transform || !naturalSize) return false;
    const left = transform.x, top = transform.y;
    const right = transform.x + naturalSize.w * transform.scale;
    const bottom = transform.y + naturalSize.h * transform.scale;
    return left <= FIT_EPS && top <= FIT_EPS && right >= frame.w - FIT_EPS && bottom >= frame.h - FIT_EPS;
  }, [transform, naturalSize, frame]);

  // ── Drag (pan) ──────────────────────────────────────────────────────────
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const onImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!transform) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y };
    window.addEventListener('mousemove', onImageMouseMove);
    window.addEventListener('mouseup', onImageMouseUp);
  };
  const onImageMouseMove = (e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setTransform(prev => prev && ({ ...prev, x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) }));
  };
  const onImageMouseUp = () => {
    dragRef.current = null;
    window.removeEventListener('mousemove', onImageMouseMove);
    window.removeEventListener('mouseup', onImageMouseUp);
  };

  // ── Resize (corner handles) ──────────────────────────────────────────────
  // Scales uniformly from the image's own current center: simpler than
  // anchoring the opposite corner, still reads as "drag a corner to zoom"
  // the way resizing an object in Canva/Figma does.
  const resizeRef = useRef<{ startDist: number; origScale: number; cx: number; cy: number } | null>(null);
  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!transform || !naturalSize) return;
    const cx = transform.x + (naturalSize.w * transform.scale) / 2;
    const cy = transform.y + (naturalSize.h * transform.scale) / 2;
    const startDist = Math.hypot(e.clientX - (cx + frameOffsetRef.current.left), e.clientY - (cy + frameOffsetRef.current.top)) || 1;
    resizeRef.current = { startDist, origScale: transform.scale, cx, cy };
    window.addEventListener('mousemove', onHandleMouseMove);
    window.addEventListener('mouseup', onHandleMouseUp);
  };
  const onHandleMouseMove = (e: MouseEvent) => {
    const r = resizeRef.current;
    if (!r || !naturalSize) return;
    const dist = Math.hypot(e.clientX - (r.cx + frameOffsetRef.current.left), e.clientY - (r.cy + frameOffsetRef.current.top)) || 1;
    const nextScale = Math.max(0.02, r.origScale * (dist / r.startDist));
    // Keep the same center while the size changes, so a corner-drag reads
    // as "grow/shrink in place" instead of drifting toward one corner.
    const nextW = naturalSize.w * nextScale;
    const nextH = naturalSize.h * nextScale;
    setTransform({ scale: nextScale, x: r.cx - nextW / 2, y: r.cy - nextH / 2 });
  };
  const onHandleMouseUp = () => {
    resizeRef.current = null;
    window.removeEventListener('mousemove', onHandleMouseMove);
    window.removeEventListener('mouseup', onHandleMouseUp);
  };

  // Corner-handle math needs the frame's actual on-screen position (mouse
  // coordinates are viewport-relative, everything else here is frame-local).
  const frameElRef = useRef<HTMLDivElement | null>(null);
  const frameOffsetRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 });
  useEffect(() => {
    const measure = () => {
      const r = frameElRef.current?.getBoundingClientRect();
      if (r) frameOffsetRef.current = { left: r.left, top: r.top };
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [frame]);

  useEffect(() => () => {
    window.removeEventListener('mousemove', onImageMouseMove);
    window.removeEventListener('mouseup', onImageMouseUp);
    window.removeEventListener('mousemove', onHandleMouseMove);
    window.removeEventListener('mouseup', onHandleMouseUp);
  }, []);

  const handleConfirm = () => {
    if (!transform || !naturalSize || !imgElRef.current) return;
    setExporting(true);

    const cropX = -transform.x / transform.scale;
    const cropY = -transform.y / transform.scale;
    const cropW = frame.w / transform.scale;
    const cropH = frame.h / transform.scale;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setExporting(false); return; }
    ctx.drawImage(imgElRef.current, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);

    canvas.toBlob((blob) => {
      setExporting(false);
      if (!blob) return;
      const croppedFile = new File([blob], file.name.replace(/\.\w+$/, '') + '-fit.png', { type: 'image/png' });
      onConfirm(croppedFile);
    }, 'image/png', 0.95);
  };

  const HANDLE_POS = [
    { key: 'tl', top: 0, left: 0, cursor: 'nwse-resize' },
    { key: 'tr', top: 0, left: 1, cursor: 'nesw-resize' },
    { key: 'bl', top: 1, left: 0, cursor: 'nesw-resize' },
    { key: 'br', top: 1, left: 1, cursor: 'nwse-resize' },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl bg-[#ffffff] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <div>
            <h2 className="text-base font-semibold text-black">Fit your image to this ad space</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Drag to reposition, drag a corner to resize, until the image fully covers the frame.
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-black/5 text-neutral-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          <div
            ref={frameElRef}
            className="relative overflow-hidden select-none"
            style={{
              width: frame.w,
              height: frame.h,
              boxShadow: fits
                ? '0 0 0 3px #22c55e, 0 0 24px 2px rgba(34,197,94,0.45)'
                : '0 0 0 2px rgba(0,0,0,0.25)',
              background: '#111',
              transition: 'box-shadow 0.15s ease',
              cursor: transform ? 'grab' : 'default',
            }}
          >
            {imgUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgElRef}
                src={imgUrl}
                alt="Your ad"
                onLoad={handleImgLoad}
                onMouseDown={onImageMouseDown}
                draggable={false}
                style={transform ? {
                  position: 'absolute',
                  left: transform.x,
                  top: transform.y,
                  width: naturalSize ? naturalSize.w * transform.scale : undefined,
                  height: naturalSize ? naturalSize.h * transform.scale : undefined,
                  maxWidth: 'none',
                  cursor: 'grab',
                } : { display: 'none' }}
              />
            )}

            {transform && naturalSize && HANDLE_POS.map(h => (
              <div
                key={h.key}
                onMouseDown={onHandleMouseDown}
                style={{
                  position: 'absolute',
                  left: transform.x + h.left * naturalSize.w * transform.scale - 8,
                  top: transform.y + h.top * naturalSize.h * transform.scale - 8,
                  width: 16, height: 16, borderRadius: 9999,
                  background: '#fff', border: '2px solid #111',
                  cursor: h.cursor, zIndex: 5,
                }}
              />
            ))}

            {fits && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-green-500 text-white text-[11px] font-semibold px-2.5 py-1 shadow">
                <Check size={12} /> Fits
              </div>
            )}
          </div>

          <p className="text-xs text-neutral-500 flex items-center gap-1.5">
            <Move size={12} /> Required size: {targetWidth}×{targetHeight}px
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10 bg-neutral-50">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-black/5 transition-colors"
          >
            Choose a different image
          </button>
          <button
            onClick={handleConfirm}
            disabled={!transform || exporting}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              fits ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-black text-white hover:bg-neutral-800'
            }`}
          >
            {exporting ? 'Saving…' : fits ? 'Use this fit' : 'Use anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}
