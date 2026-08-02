'use client';
// @ts-nocheck

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Check, Move } from 'lucide-react';

// A Canva/Figma-style crop-and-resize step for an ad image that didn't fit
// the ad space's required size: instead of just rejecting it with a text
// error, show the image on a canvas that's bigger than the required frame —
// so the parts that would get cropped away stay visible (dimmed) instead of
// being clipped out of view — let the owner drag/resize until the frame is
// fully covered (it turns green), then export exactly that crop at the exact
// required pixel dimensions.
//
// The thing being dragged is a BOX, not the raw image. The photo always
// fills that box via uniform "cover" scaling (like CSS object-fit: cover),
// cropping whatever overflows — so no matter what shape the box is, the
// photo's own pixels are never stretched non-uniformly:
//   - a corner drag scales box.w and box.h together (proportional zoom)
//   - an edge drag changes only box.w OR box.h — the box's other dimension
//     doesn't move, and the photo re-zooms uniformly to keep covering the
//     new shape, so growing height alone crops in tighter (more zoomed),
//     growing width alone crops out wider — cropped, never warped.
// The backend's own size check (adSpaceLayout.js) is still the authoritative
// gate; this only guarantees what gets sent already matches, so that check
// never has anything left to reject.

const STAGE_MAX = 380; // on-screen px budget for the longer side of the frame
const MARGIN = 64;     // canvas padding around the frame, so overflow is visible
const FIT_EPS = 1.5;   // px tolerance before the frame counts as "covered"
const MIN_BOX = 24;    // px floor so a box can never be dragged to nothing

const CHECKERBOARD_BG = {
  backgroundImage:
    'linear-gradient(45deg, #d4d4d4 25%, transparent 25%), linear-gradient(-45deg, #d4d4d4 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d4 75%), linear-gradient(-45deg, transparent 75%, #d4d4d4 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  backgroundColor: '#eee',
};

interface Props {
  file: File;
  targetWidth: number;
  targetHeight: number;
  onCancel: () => void;
  onChangeImage: () => void;
  onConfirm: (croppedFile: File) => void;
}

// The box the owner directly manipulates. The photo is never stored at a
// distorted aspect — it's always re-derived from {naturalSize, box} via
// "cover" scaling at render/export time.
type Box = { x: number; y: number; w: number; h: number };

export default function AdImageFitModal({ file, targetWidth, targetHeight, onCancel, onChangeImage, onConfirm }: Props) {
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [exporting, setExporting] = useState(false);
  // Opens on a static "here's the mismatch" preview — nothing draggable yet —
  // so the owner sees why the image was rejected before deciding whether to
  // replace it or resize it. Dragging/resizing only turns on in 'edit' mode.
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');

  // Frame: the required aspect ratio, scaled down to fit a comfortable
  // on-screen box. This is the only thing the final export cares about
  // covering — its screen size, not the real target pixels.
  const frame = useMemo(() => {
    if (targetWidth >= targetHeight) {
      const w = STAGE_MAX;
      return { w, h: STAGE_MAX * (targetHeight / targetWidth) };
    }
    const h = STAGE_MAX;
    return { w: STAGE_MAX * (targetWidth / targetHeight), h };
  }, [targetWidth, targetHeight]);

  // Canvas is bigger than the frame so dragging/shrinking the box reveals
  // real "outside the crop" space instead of just clipping to black.
  const canvas = useMemo(() => ({ w: frame.w + MARGIN * 2, h: frame.h + MARGIN * 2 }), [frame]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // How the photo renders inside a given box: uniform "cover" scale (the
  // larger of the two ratios), centered, so it always fully fills the box
  // with no gaps and no non-uniform stretch — any excess just overflows the
  // box and gets clipped.
  const coverLayout = (b: Box, nw: number, nh: number) => {
    const s = Math.max(b.w / nw, b.h / nh);
    const contentW = nw * s;
    const contentH = nh * s;
    return { scale: s, contentW, contentH, offsetX: (b.w - contentW) / 2, offsetY: (b.h - contentH) / 2 };
  };

  // Loads into a static preview box that contains the whole image at a
  // recognizable size (matches the photo's own aspect, so nothing is
  // cropped yet) — the required-frame outline overlays on top at its true
  // relative scale, making the size mismatch that got it rejected obvious.
  const handleImgLoad = () => {
    const el = imgElRef.current;
    if (!el) return;
    const w = el.naturalWidth, h = el.naturalHeight;
    setNaturalSize({ w, h });
    const s = Math.min(canvas.w / w, canvas.h / h);
    const bw = w * s, bh = h * s;
    setBox({ w: bw, h: bh, x: (canvas.w - bw) / 2, y: (canvas.h - bh) / 2 });
  };

  // Switching into edit mode restarts the box at exactly the frame's size,
  // centered on it — already fully covering the frame, so there's something
  // to adjust rather than a blank stage to figure out.
  const startEditing = () => {
    if (!naturalSize) return;
    setBox({ w: frame.w, h: frame.h, x: MARGIN, y: MARGIN });
    setMode('edit');
  };

  const fits = useMemo(() => {
    if (!box) return false;
    return (
      box.x <= MARGIN + FIT_EPS &&
      box.y <= MARGIN + FIT_EPS &&
      box.x + box.w >= MARGIN + frame.w - FIT_EPS &&
      box.y + box.h >= MARGIN + frame.h - FIT_EPS
    );
  }, [box, frame]);

  // Mouse coordinates are viewport-relative; everything else here is
  // canvas-local, so every drag/resize handler needs the canvas's actual
  // on-screen position to convert between the two.
  const canvasElRef = useRef<HTMLDivElement | null>(null);
  const canvasOffsetRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 });
  useEffect(() => {
    const measure = () => {
      const r = canvasElRef.current?.getBoundingClientRect();
      if (r) canvasOffsetRef.current = { left: r.left, top: r.top };
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [canvas]);
  const toCanvasPoint = (e: { clientX: number; clientY: number }) => ({
    x: e.clientX - canvasOffsetRef.current.left,
    y: e.clientY - canvasOffsetRef.current.top,
  });

  // ── Drag (pan) — moves the box, doesn't resize it ────────────────────────
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const onImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mode !== 'edit' || !box) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: box.x, origY: box.y };
    window.addEventListener('mousemove', onImageMouseMove);
    window.addEventListener('mouseup', onImageMouseUp);
  };
  const onImageMouseMove = (e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setBox(prev => prev && ({ ...prev, x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) }));
  };
  const onImageMouseUp = () => {
    dragRef.current = null;
    window.removeEventListener('mousemove', onImageMouseMove);
    window.removeEventListener('mouseup', onImageMouseUp);
  };

  // ── Resize: corner handles — scale box.w and box.h together ──────────────
  const cornerRef = useRef<{ startDist: number; origW: number; origH: number; cx: number; cy: number } | null>(null);
  const onCornerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!box) return;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const p = toCanvasPoint(e);
    const startDist = Math.max(1, Math.hypot(p.x - cx, p.y - cy));
    cornerRef.current = { startDist, origW: box.w, origH: box.h, cx, cy };
    window.addEventListener('mousemove', onCornerMouseMove);
    window.addEventListener('mouseup', onCornerMouseUp);
  };
  const onCornerMouseMove = (e: MouseEvent) => {
    const r = cornerRef.current;
    if (!r) return;
    const p = toCanvasPoint(e);
    const dist = Math.max(1, Math.hypot(p.x - r.cx, p.y - r.cy));
    const factor = dist / r.startDist;
    const nextW = Math.max(MIN_BOX, r.origW * factor);
    const nextH = Math.max(MIN_BOX, r.origH * factor);
    setBox({ w: nextW, h: nextH, x: r.cx - nextW / 2, y: r.cy - nextH / 2 });
  };
  const onCornerMouseUp = () => {
    cornerRef.current = null;
    window.removeEventListener('mousemove', onCornerMouseMove);
    window.removeEventListener('mouseup', onCornerMouseUp);
  };

  // ── Resize: edge handles — change only box.w OR box.h ────────────────────
  // The other dimension never moves. The photo re-derives its own uniform
  // cover-scale from the new box shape every render, so this only ever
  // crops the image tighter or wider — it can't stretch it, because there's
  // no per-axis scale stored anywhere to stretch.
  const edgeRef = useRef<{ axis: 'x' | 'y'; startDist: number; orig: number; cx: number; cy: number } | null>(null);
  const onEdgeMouseDown = (axis: 'x' | 'y') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!box) return;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const p = toCanvasPoint(e);
    const startDist = Math.max(1, axis === 'x' ? Math.abs(p.x - cx) : Math.abs(p.y - cy));
    edgeRef.current = { axis, startDist, orig: axis === 'x' ? box.w : box.h, cx, cy };
    window.addEventListener('mousemove', onEdgeMouseMove);
    window.addEventListener('mouseup', onEdgeMouseUp);
  };
  const onEdgeMouseMove = (e: MouseEvent) => {
    const r = edgeRef.current;
    if (!r) return;
    const p = toCanvasPoint(e);
    const dist = Math.max(1, r.axis === 'x' ? Math.abs(p.x - r.cx) : Math.abs(p.y - r.cy));
    const nextSize = Math.max(MIN_BOX, r.orig * (dist / r.startDist));
    if (r.axis === 'x') {
      setBox(prev => prev && ({ ...prev, w: nextSize, x: r.cx - nextSize / 2 }));
    } else {
      setBox(prev => prev && ({ ...prev, h: nextSize, y: r.cy - nextSize / 2 }));
    }
  };
  const onEdgeMouseUp = () => {
    edgeRef.current = null;
    window.removeEventListener('mousemove', onEdgeMouseMove);
    window.removeEventListener('mouseup', onEdgeMouseUp);
  };

  useEffect(() => () => {
    window.removeEventListener('mousemove', onImageMouseMove);
    window.removeEventListener('mouseup', onImageMouseUp);
    window.removeEventListener('mousemove', onCornerMouseMove);
    window.removeEventListener('mouseup', onCornerMouseUp);
    window.removeEventListener('mousemove', onEdgeMouseMove);
    window.removeEventListener('mouseup', onEdgeMouseUp);
  }, []);

  const handleConfirm = () => {
    if (!box || !naturalSize || !imgElRef.current) return;
    setExporting(true);

    const { scale, offsetX, offsetY } = coverLayout(box, naturalSize.w, naturalSize.h);
    // Where the frame sits relative to the rendered (cover-scaled) photo,
    // converted back into the photo's own natural pixel coordinates.
    const cropX = (MARGIN - (box.x + offsetX)) / scale;
    const cropY = (MARGIN - (box.y + offsetY)) / scale;
    const cropW = frame.w / scale;
    const cropH = frame.h / scale;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetWidth;
    outCanvas.height = targetHeight;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) { setExporting(false); return; }
    ctx.drawImage(imgElRef.current, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);

    outCanvas.toBlob((blob) => {
      setExporting(false);
      if (!blob) return;
      const croppedFile = new File([blob], file.name.replace(/\.\w+$/, '') + '-fit.png', { type: 'image/png' });
      onConfirm(croppedFile);
    }, 'image/png', 0.95);
  };

  const layout = box && naturalSize ? coverLayout(box, naturalSize.w, naturalSize.h) : null;

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  // A handle's "true" position follows the box edge, which can land far
  // outside the (clipped) canvas for an extreme box shape. Pin the handle's
  // on-screen position to the canvas bounds in that case so it's always
  // visible and grabbable; the drag math itself still reads the raw mouse
  // position, so resizing behaves correctly either way.
  const clampedHandlePos = (rawCx: number, rawCy: number, w: number, h: number) => ({
    left: clamp(rawCx, w / 2, canvas.w - w / 2) - w / 2,
    top: clamp(rawCy, h / 2, canvas.h - h / 2) - h / 2,
  });

  const CORNER_HANDLES = [
    { key: 'tl', top: 0, left: 0, cursor: 'nwse-resize' },
    { key: 'tr', top: 0, left: 1, cursor: 'nesw-resize' },
    { key: 'bl', top: 1, left: 0, cursor: 'nesw-resize' },
    { key: 'br', top: 1, left: 1, cursor: 'nwse-resize' },
  ] as const;

  const EDGE_HANDLES = [
    { key: 'l', axis: 'x' as const, top: 0.5, left: 0, cursor: 'ew-resize', w: 12, h: 32 },
    { key: 'r', axis: 'x' as const, top: 0.5, left: 1, cursor: 'ew-resize', w: 12, h: 32 },
    { key: 't', axis: 'y' as const, top: 0, left: 0.5, cursor: 'ns-resize', w: 32, h: 12 },
    { key: 'b', axis: 'y' as const, top: 1, left: 0.5, cursor: 'ns-resize', w: 32, h: 12 },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#ffffff] shadow-2xl overflow-hidden flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-black/10">
          <div>
            <h2 className="text-base font-semibold text-black">
              {mode === 'preview' ? "This image doesn't fit this ad space" : 'Fit your image to this ad space'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {mode === 'preview'
                ? `It needs to be ${targetWidth}×${targetHeight}px. Replace it with a different image, or resize this one to fit.`
                : 'Drag to reposition, drag a corner to zoom, drag an edge to crop tighter or wider on that side. Dimmed areas outside the frame get cropped away.'}
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-black/5 text-neutral-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-4 overflow-y-auto min-h-0">
          <div
            ref={canvasElRef}
            className="relative overflow-hidden select-none rounded-md"
            style={{ width: canvas.w, height: canvas.h, ...CHECKERBOARD_BG }}
          >
            {imgUrl && (
              // The box is the clipping viewport; the photo inside is always
              // uniformly cover-scaled to fill it, so it can overflow the
              // box (clipped) but never gets non-uniformly stretched.
              <div
                onMouseDown={onImageMouseDown}
                className="absolute overflow-hidden select-none"
                style={box ? {
                  left: box.x, top: box.y, width: box.w, height: box.h,
                  cursor: mode === 'edit' ? 'grab' : 'default',
                } : { left: 0, top: 0, width: 0, height: 0 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgElRef}
                  src={imgUrl}
                  alt="Your ad"
                  onLoad={handleImgLoad}
                  draggable={false}
                  style={layout ? {
                    position: 'absolute',
                    left: layout.offsetX,
                    top: layout.offsetY,
                    width: layout.contentW,
                    height: layout.contentH,
                    maxWidth: 'none',
                  } : { position: 'absolute', width: 1, height: 1, opacity: 0 }}
                />
              </div>
            )}

            {/* Spotlight: dims everything outside the frame while leaving it
                fully visible (not clipped), so the owner can see exactly
                what will be cropped away and adjust accordingly. */}
            <div
              style={{
                position: 'absolute',
                left: MARGIN,
                top: MARGIN,
                width: frame.w,
                height: frame.h,
                pointerEvents: 'none',
                boxShadow: `${mode === 'edit' && fits ? '0 0 0 2px #22c55e' : '0 0 0 2px rgba(255,255,255,0.85)'}, 0 0 0 9999px rgba(0,0,0,0.55)`,
                transition: 'box-shadow 0.15s ease',
              }}
            />

            {mode === 'edit' && box && CORNER_HANDLES.map(h => {
              const pos = clampedHandlePos(box.x + h.left * box.w, box.y + h.top * box.h, 22, 22);
              return (
                <div
                  key={h.key}
                  onMouseDown={onCornerMouseDown}
                  style={{
                    position: 'absolute',
                    left: pos.left,
                    top: pos.top,
                    width: 22, height: 22, borderRadius: 9999,
                    background: '#fff', border: '3px solid #111',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    cursor: h.cursor, zIndex: 6,
                  }}
                />
              );
            })}

            {mode === 'edit' && box && EDGE_HANDLES.map(h => {
              const pos = clampedHandlePos(box.x + h.left * box.w, box.y + h.top * box.h, h.w, h.h);
              return (
                <div
                  key={h.key}
                  onMouseDown={onEdgeMouseDown(h.axis)}
                  style={{
                    position: 'absolute',
                    left: pos.left,
                    top: pos.top,
                    width: h.w, height: h.h, borderRadius: 6,
                    background: '#fff', border: '3px solid #111',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    cursor: h.cursor, zIndex: 6,
                  }}
                />
              );
            })}

            {mode === 'edit' && fits && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-green-500 text-[#fff] text-[11px] font-semibold px-2.5 py-1 shadow">
                <Check size={12} /> Fits
              </div>
            )}
          </div>

          <p className="text-xs text-neutral-500 flex items-center gap-1.5">
            <Move size={12} /> Required size: {targetWidth}×{targetHeight}px
          </p>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10 bg-neutral-50">
          {mode === 'preview' ? (
            <>
              <button
                onClick={onChangeImage}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-black/5 transition-colors"
              >
                Change image
              </button>
              <button
                onClick={startEditing}
                disabled={!naturalSize}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#fff] bg-black hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Resize your image
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onChangeImage}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-black/5 transition-colors"
              >
                Choose a different image
              </button>
              <button
                onClick={handleConfirm}
                disabled={!box || exporting}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  fits ? 'bg-green-600 text-[#fff] hover:bg-green-700' : 'bg-black text-[#fff] hover:bg-neutral-800'
                }`}
              >
                {exporting ? 'Saving…' : fits ? 'Use this fit' : 'Use anyway'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
