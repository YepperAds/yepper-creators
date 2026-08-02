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
// required pixel dimensions. The backend's own size check (adSpaceLayout.js)
// is still the authoritative gate; this only guarantees what gets sent
// already matches, so that check never has anything left to reject.

const STAGE_MAX = 380; // on-screen px budget for the longer side of the frame
const MARGIN = 64;     // canvas padding around the frame, so overflow is visible
const FIT_EPS = 1.5;   // px tolerance before the frame counts as "covered"

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
  onConfirm: (croppedFile: File) => void;
}

type Transform = { x: number; y: number; scaleX: number; scaleY: number };

export default function AdImageFitModal({ file, targetWidth, targetHeight, onCancel, onConfirm }: Props) {
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [transform, setTransform] = useState<Transform | null>(null);
  const [exporting, setExporting] = useState(false);
  // Opens on a static "here's the mismatch" preview — nothing draggable yet —
  // so the owner sees why the image was rejected before deciding whether to
  // replace it or resize it. Dragging/resizing only turns on in 'edit' mode.
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');

  // Frame: the required aspect ratio, scaled down to fit a comfortable
  // on-screen box. This is the only thing the final export cares about
  // covering — its screen size, not the real target pixels, since the crop
  // math below converts back through scaleX/scaleY regardless of zoom level.
  const frame = useMemo(() => {
    if (targetWidth >= targetHeight) {
      const w = STAGE_MAX;
      return { w, h: STAGE_MAX * (targetHeight / targetWidth) };
    }
    const h = STAGE_MAX;
    return { w: STAGE_MAX * (targetWidth / targetHeight), h };
  }, [targetWidth, targetHeight]);

  // Canvas is bigger than the frame so dragging/shrinking the image reveals
  // real "outside the crop" space instead of just clipping to black.
  const canvas = useMemo(() => ({ w: frame.w + MARGIN * 2, h: frame.h + MARGIN * 2 }), [frame]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const coverTransform = (w: number, h: number): Transform => {
    const s = Math.max(frame.w / w, frame.h / h);
    return { scaleX: s, scaleY: s, x: MARGIN + (frame.w - w * s) / 2, y: MARGIN + (frame.h - h * s) / 2 };
  };
  const containTransform = (w: number, h: number): Transform => {
    const s = Math.min(frame.w / w, frame.h / h);
    return { scaleX: s, scaleY: s, x: MARGIN + (frame.w - w * s) / 2, y: MARGIN + (frame.h - h * s) / 2 };
  };

  // Loads into the static preview at "contain" scale — the whole image
  // visible, letterboxed against the required frame — so the mismatch that
  // got it rejected is plainly visible before anything is editable.
  const handleImgLoad = () => {
    const el = imgElRef.current;
    if (!el) return;
    const w = el.naturalWidth, h = el.naturalHeight;
    setNaturalSize({ w, h });
    setTransform(containTransform(w, h));
  };

  // Switching into edit mode restarts from a "cover"-fitted, centered
  // position — the frame is already fully covered the moment editing opens,
  // so there's something to adjust rather than a blank stage to figure out.
  const startEditing = () => {
    if (!naturalSize) return;
    setTransform(coverTransform(naturalSize.w, naturalSize.h));
    setMode('edit');
  };

  const fits = useMemo(() => {
    if (!transform || !naturalSize) return false;
    const left = transform.x, top = transform.y;
    const right = transform.x + naturalSize.w * transform.scaleX;
    const bottom = transform.y + naturalSize.h * transform.scaleY;
    return (
      left <= MARGIN + FIT_EPS &&
      top <= MARGIN + FIT_EPS &&
      right >= MARGIN + frame.w - FIT_EPS &&
      bottom >= MARGIN + frame.h - FIT_EPS
    );
  }, [transform, naturalSize, frame]);

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

  // ── Drag (pan) ──────────────────────────────────────────────────────────
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const onImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mode !== 'edit' || !transform) return;
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

  // ── Resize: corner handles (both dimensions, together) ───────────────────
  // Scales uniformly from the image's own current center, preserving
  // whatever aspect ratio the image is already at (so a corner-drag after an
  // edge-drag keeps that stretch instead of snapping back to square).
  const cornerRef = useRef<{ startDist: number; origScaleX: number; origScaleY: number; cx: number; cy: number } | null>(null);
  const onCornerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!transform || !naturalSize) return;
    const cx = transform.x + (naturalSize.w * transform.scaleX) / 2;
    const cy = transform.y + (naturalSize.h * transform.scaleY) / 2;
    const p = toCanvasPoint(e);
    const startDist = Math.hypot(p.x - cx, p.y - cy) || 1;
    cornerRef.current = { startDist, origScaleX: transform.scaleX, origScaleY: transform.scaleY, cx, cy };
    window.addEventListener('mousemove', onCornerMouseMove);
    window.addEventListener('mouseup', onCornerMouseUp);
  };
  const onCornerMouseMove = (e: MouseEvent) => {
    const r = cornerRef.current;
    if (!r || !naturalSize) return;
    const p = toCanvasPoint(e);
    const dist = Math.hypot(p.x - r.cx, p.y - r.cy) || 1;
    const factor = dist / r.startDist;
    const nextScaleX = Math.max(0.02, r.origScaleX * factor);
    const nextScaleY = Math.max(0.02, r.origScaleY * factor);
    const nextW = naturalSize.w * nextScaleX;
    const nextH = naturalSize.h * nextScaleY;
    setTransform({ scaleX: nextScaleX, scaleY: nextScaleY, x: r.cx - nextW / 2, y: r.cy - nextH / 2 });
  };
  const onCornerMouseUp = () => {
    cornerRef.current = null;
    window.removeEventListener('mousemove', onCornerMouseMove);
    window.removeEventListener('mouseup', onCornerMouseUp);
  };

  // ── Resize: edge handles (width or height only, independently) ──────────
  const edgeRef = useRef<{ axis: 'x' | 'y'; startDist: number; origScaleX: number; origScaleY: number; cx: number; cy: number } | null>(null);
  const onEdgeMouseDown = (axis: 'x' | 'y') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!transform || !naturalSize) return;
    const cx = transform.x + (naturalSize.w * transform.scaleX) / 2;
    const cy = transform.y + (naturalSize.h * transform.scaleY) / 2;
    const p = toCanvasPoint(e);
    const startDist = Math.max(1, axis === 'x' ? Math.abs(p.x - cx) : Math.abs(p.y - cy));
    edgeRef.current = { axis, startDist, origScaleX: transform.scaleX, origScaleY: transform.scaleY, cx, cy };
    window.addEventListener('mousemove', onEdgeMouseMove);
    window.addEventListener('mouseup', onEdgeMouseUp);
  };
  const onEdgeMouseMove = (e: MouseEvent) => {
    const r = edgeRef.current;
    if (!r || !naturalSize) return;
    const p = toCanvasPoint(e);
    const dist = Math.max(1, r.axis === 'x' ? Math.abs(p.x - r.cx) : Math.abs(p.y - r.cy));
    const factor = dist / r.startDist;
    if (r.axis === 'x') {
      const nextScaleX = Math.max(0.02, r.origScaleX * factor);
      const nextW = naturalSize.w * nextScaleX;
      setTransform(prev => prev && ({ ...prev, scaleX: nextScaleX, x: r.cx - nextW / 2 }));
    } else {
      const nextScaleY = Math.max(0.02, r.origScaleY * factor);
      const nextH = naturalSize.h * nextScaleY;
      setTransform(prev => prev && ({ ...prev, scaleY: nextScaleY, y: r.cy - nextH / 2 }));
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
    if (!transform || !naturalSize || !imgElRef.current) return;
    setExporting(true);

    const cropX = (MARGIN - transform.x) / transform.scaleX;
    const cropY = (MARGIN - transform.y) / transform.scaleY;
    const cropW = frame.w / transform.scaleX;
    const cropH = frame.h / transform.scaleY;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetWidth;
    outCanvas.height = targetHeight;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) { setExporting(false); return; }
    // Source rect can carry a different aspect ratio than the destination
    // when scaleX !== scaleY (an edge-drag stretch) — drawImage stretches it
    // back to match, which is exactly the stretch the owner saw on screen.
    ctx.drawImage(imgElRef.current, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);

    outCanvas.toBlob((blob) => {
      setExporting(false);
      if (!blob) return;
      const croppedFile = new File([blob], file.name.replace(/\.\w+$/, '') + '-fit.png', { type: 'image/png' });
      onConfirm(croppedFile);
    }, 'image/png', 0.95);
  };

  const scaledW = naturalSize && transform ? naturalSize.w * transform.scaleX : 0;
  const scaledH = naturalSize && transform ? naturalSize.h * transform.scaleY : 0;

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  // A handle's "true" position follows the image edge, which can land far
  // outside the (clipped) canvas when the image's aspect ratio is very
  // different from the frame's — e.g. a wide banner frame with a square
  // source photo pushes the top/bottom edges way above/below what's visible.
  // Pin the handle's on-screen position to the canvas bounds in that case so
  // it's always visible and grabbable; the drag math itself still reads the
  // raw mouse position, so resizing behaves correctly either way.
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
    { key: 'l', axis: 'x' as const, top: 0.5, left: 0, cursor: 'ew-resize', w: 10, h: 26 },
    { key: 'r', axis: 'x' as const, top: 0.5, left: 1, cursor: 'ew-resize', w: 10, h: 26 },
    { key: 't', axis: 'y' as const, top: 0, left: 0.5, cursor: 'ns-resize', w: 26, h: 10 },
    { key: 'b', axis: 'y' as const, top: 1, left: 0.5, cursor: 'ns-resize', w: 26, h: 10 },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-2xl bg-[#ffffff] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
          <div>
            <h2 className="text-base font-semibold text-black">
              {mode === 'preview' ? "This image doesn't fit this ad space" : 'Fit your image to this ad space'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {mode === 'preview'
                ? `It needs to be ${targetWidth}×${targetHeight}px. Replace it with a different image, or resize this one to fit.`
                : 'Drag to reposition, drag an edge or corner to resize. Dimmed areas outside the frame get cropped away.'}
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-black/5 text-neutral-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          <div
            ref={canvasElRef}
            className="relative overflow-hidden select-none rounded-md"
            style={{ width: canvas.w, height: canvas.h, ...CHECKERBOARD_BG }}
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
                  width: scaledW,
                  height: scaledH,
                  maxWidth: 'none',
                  cursor: mode === 'edit' ? 'grab' : 'default',
                } : { display: 'none' }}
              />
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

            {mode === 'edit' && transform && naturalSize && CORNER_HANDLES.map(h => {
              const pos = clampedHandlePos(transform.x + h.left * scaledW, transform.y + h.top * scaledH, 16, 16);
              return (
                <div
                  key={h.key}
                  onMouseDown={onCornerMouseDown}
                  style={{
                    position: 'absolute',
                    left: pos.left,
                    top: pos.top,
                    width: 16, height: 16, borderRadius: 9999,
                    background: '#fff', border: '2px solid #111',
                    cursor: h.cursor, zIndex: 6,
                  }}
                />
              );
            })}

            {mode === 'edit' && transform && naturalSize && EDGE_HANDLES.map(h => {
              const pos = clampedHandlePos(transform.x + h.left * scaledW, transform.y + h.top * scaledH, h.w, h.h);
              return (
                <div
                  key={h.key}
                  onMouseDown={onEdgeMouseDown(h.axis)}
                  style={{
                    position: 'absolute',
                    left: pos.left,
                    top: pos.top,
                    width: h.w, height: h.h, borderRadius: 4,
                    background: '#fff', border: '2px solid #111',
                    cursor: h.cursor, zIndex: 6,
                  }}
                />
              );
            })}

            {mode === 'edit' && fits && (
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
          {mode === 'preview' ? (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-black/5 transition-colors"
              >
                Change image
              </button>
              <button
                onClick={startEditing}
                disabled={!naturalSize}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-black hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Resize your image
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
