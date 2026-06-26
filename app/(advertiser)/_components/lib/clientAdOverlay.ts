// Burns ad creative(s) into a video entirely in the browser via ffmpeg.wasm —
// no bytes get processed by Render or Vercel. This mirrors the filter-graph
// logic in backend/creators/utils/adOverlay.js (kept there for reference/the
// "manual" non-auto path), but runs client-side so heavy ffmpeg work never
// competes with the web server for CPU/RAM. Only the few seconds around each
// marker get re-encoded — everything else is a fast stream copy — so
// processing time scales with marker count, not video length, same as before.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const OVERLAY_WINDOW_SEC = 12;
const FADE_SEC = 1;
const MARGIN_RATIO = 0.03;

const AD_FORMAT_SIZES: Record<string, Record<string, { ratio?: number; vRatio?: number; hRatio?: number }>> = {
  corner: { small: { ratio: 0.15 }, medium: { ratio: 0.22 }, large: { ratio: 0.30 } },
  lbar:   { small: { vRatio: 0.06, hRatio: 0.10 }, medium: { vRatio: 0.08, hRatio: 0.14 }, large: { vRatio: 0.11, hRatio: 0.18 } },
};

function getFormatConfig(adType: string, adSize: string) {
  const type = AD_FORMAT_SIZES[adType] ? adType : 'corner';
  const size = AD_FORMAT_SIZES[type][adSize] ? adSize : 'medium';
  return { type, size, ...AD_FORMAT_SIZES[type][size] };
}

export interface Placement {
  time: number;
  imageBytes: Uint8Array;
  adType?: string;
  adSize?: string;
}

interface Window {
  start: number;
  end: number;
  imageBytes: Uint8Array;
  adType: string;
  adSize: string;
}

// Sorts/dedupes placements, clamps each into a valid overlay window, and
// merges windows that would otherwise overlap — same rule as the server.
function buildWindows(placements: Placement[], duration: number): Window[] {
  const sane = placements
    .map((p) => ({ time: Number(p.time), imageBytes: p.imageBytes, adType: p.adType || 'corner', adSize: p.adSize || 'medium' }))
    .filter((p) => Number.isFinite(p.time) && p.time >= 0 && p.time < duration && p.imageBytes)
    .sort((a, b) => a.time - b.time);

  const windows: Window[] = [];
  for (const p of sane) {
    const start = p.time;
    const end = Math.min(p.time + OVERLAY_WINDOW_SEC, duration);
    if (end - start < 1) continue;
    const prev = windows[windows.length - 1];
    if (prev && start < prev.end) {
      prev.end = Math.max(prev.end, end);
      continue;
    }
    windows.push({ start, end, imageBytes: p.imageBytes, adType: p.adType, adSize: p.adSize });
  }
  return windows;
}

function buildLayerFilter({ imageInputIndex, videoInPad, videoOutPad, adType, adSize, width, height, fadeOutStart, margin }: {
  imageInputIndex: number; videoInPad: string; videoOutPad: string; adType: string; adSize: string;
  width: number; height: number; fadeOutStart: number; margin: number;
}): string {
  const fade = `,format=yuva420p,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1`;

  if (adType === 'lbar') {
    const { vRatio, hRatio } = getFormatConfig('lbar', adSize);
    const vBarW = Math.round(width * (vRatio as number));
    const hBarH = Math.round(height * (hRatio as number));
    return (
      `[${imageInputIndex}:v]scale=${vBarW}:${height}:force_original_aspect_ratio=increase,crop=${vBarW}:${height}${fade}[lv];` +
      `[${imageInputIndex}:v]scale=${width}:${hBarH}:force_original_aspect_ratio=increase,crop=${width}:${hBarH}${fade}[lh];` +
      `[${videoInPad}][lv]overlay=0:0[lmid];` +
      `[lmid][lh]overlay=0:H-h[${videoOutPad}]`
    );
  }

  const { ratio } = getFormatConfig('corner', adSize);
  const adWidth = Math.round(width * (ratio as number));
  return (
    `[${imageInputIndex}:v]scale=${adWidth}:-1${fade}[lad];` +
    `[${videoInPad}][lad]overlay=W-w-${margin}:H-h-${margin}[${videoOutPad}]`
  );
}

let ffmpegSingleton: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    // Self-hosted (see scripts/copy-ffmpeg-core.js) — single-threaded build,
    // deliberately not the multi-threaded core: that needs
    // Cross-Origin-Embedder-Policy: require-corp on the page, which breaks
    // the window.open()-based Google OAuth popup flow used elsewhere in
    // this dashboard (connect-accounts).
    coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
  });
  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

export interface OverlayInput {
  videoBytes: Uint8Array;
  width: number;
  height: number;
  duration: number;
  placements: Placement[];
  onProgress?: (pct: number) => void;
}

export async function applyAdOverlayInBrowser({ videoBytes, width, height, duration, placements, onProgress }: OverlayInput): Promise<Blob> {
  const windows = buildWindows(placements, duration);
  if (windows.length === 0) return new Blob([videoBytes], { type: 'video/mp4' });

  const ffmpeg = await getFFmpeg();
  const margin = Math.round(width * MARGIN_RATIO);
  await ffmpeg.writeFile('input.mp4', videoBytes);

  const totalSteps = windows.length * 2 + 1; // ~copy+ad per window, plus the final concat
  let stepsDone = 0;
  const reportStep = () => { stepsDone += 1; onProgress?.(Math.min(99, Math.round((stepsDone / totalSteps) * 100))); };

  const segNames: string[] = [];
  let segIdx = 0;
  let cursor = 0;
  let fastPathOk = true;

  const runCopySegment = async (start: number, end: number) => {
    const name = `seg${segIdx++}.mp4`;
    const code = await ffmpeg.exec(['-ss', String(start), '-to', String(end), '-i', 'input.mp4', '-c', 'copy', '-avoid_negative_ts', 'make_zero', name]);
    if (code !== 0) throw new Error('copy-segment-failed');
    segNames.push(name);
    reportStep();
  };

  const runAdSegment = async (start: number, end: number, imageBytes: Uint8Array, adType: string, adSize: string) => {
    const imgName = `adimg${segIdx}.png`;
    await ffmpeg.writeFile(imgName, imageBytes);
    const name = `seg${segIdx++}.mp4`;
    const fadeOutStart = Math.max(0, end - start - FADE_SEC);
    const filter = buildLayerFilter({ imageInputIndex: 1, videoInPad: '0:v', videoOutPad: 'outv', adType, adSize, width, height, fadeOutStart, margin });
    const code = await ffmpeg.exec([
      '-ss', String(start), '-to', String(end), '-i', 'input.mp4',
      '-loop', '1', '-i', imgName,
      '-filter_complex', filter,
      '-map', '[outv]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest',
      name,
    ]);
    if (code !== 0) throw new Error('ad-segment-failed');
    segNames.push(name);
    reportStep();
  };

  try {
    for (const w of windows) {
      if (w.start > cursor) await runCopySegment(cursor, w.start);
      await runAdSegment(w.start, w.end, w.imageBytes, w.adType, w.adSize);
      cursor = w.end;
    }
    if (cursor < duration) await runCopySegment(cursor, duration);
  } catch {
    fastPathOk = false;
  }

  if (!fastPathOk) {
    // Source codec wasn't copy-compatible with the fast path (rare for a
    // standard browser-exported/recorded mp4) — fall back to one full
    // re-encode pass with hard on/off cuts instead of fades, same as the
    // server's old applyOverlayFullReencode fallback.
    for (const name of segNames) { try { await ffmpeg.deleteFile(name); } catch { /* best effort */ } }
    const blob = await fullReencodeFallback(ffmpeg, { width, height, windows, margin });
    onProgress?.(100);
    return blob;
  }

  const listBody = segNames.map((n) => `file '${n}'`).join('\n');
  await ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(listBody));
  const concatCode = await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', '-c', 'copy', 'output.mp4']);
  reportStep();
  if (concatCode !== 0) throw new Error('Failed to stitch the processed video together');

  const data = await ffmpeg.readFile('output.mp4');
  onProgress?.(100);
  return new Blob([data as Uint8Array], { type: 'video/mp4' });
}

async function fullReencodeFallback(ffmpeg: FFmpeg, { width, height, windows, margin }: {
  width: number; height: number; windows: Window[]; margin: number;
}): Promise<Blob> {
  const args = ['-i', 'input.mp4'];
  for (let i = 0; i < windows.length; i++) {
    const imgName = `fimg${i}.png`;
    await ffmpeg.writeFile(imgName, windows[i].imageBytes);
    args.push('-loop', '1', '-i', imgName);
  }

  const filterParts = windows.map((w, i) => {
    const videoInPad = i === 0 ? '0:v' : `tmp${i}`;
    const videoOutPad = i === windows.length - 1 ? 'outv' : `tmp${i + 1}`;
    const enable = `between(t,${w.start},${w.end})`;

    if (w.adType === 'lbar') {
      const { vRatio, hRatio } = getFormatConfig('lbar', w.adSize);
      const vBarW = Math.round(width * (vRatio as number));
      const hBarH = Math.round(height * (hRatio as number));
      return (
        `[${i + 1}:v]scale=${vBarW}:${height}:force_original_aspect_ratio=increase,crop=${vBarW}:${height}[v${i}];` +
        `[${i + 1}:v]scale=${width}:${hBarH}:force_original_aspect_ratio=increase,crop=${width}:${hBarH}[h${i}];` +
        `[${videoInPad}][v${i}]overlay=0:0:enable='${enable}'[mid${i}];` +
        `[mid${i}][h${i}]overlay=0:H-h:enable='${enable}'[${videoOutPad}]`
      );
    }

    const { ratio } = getFormatConfig('corner', w.adSize);
    const adWidth = Math.round(width * (ratio as number));
    return (
      `[${i + 1}:v]scale=${adWidth}:-1[ad${i}];` +
      `[${videoInPad}][ad${i}]overlay=W-w-${margin}:H-h-${margin}:enable='${enable}'[${videoOutPad}]`
    );
  });

  const code = await ffmpeg.exec([
    ...args,
    '-filter_complex', filterParts.join(';'),
    '-map', '[outv]', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest',
    'output.mp4',
  ]);
  if (code !== 0) throw new Error('Video processing failed — try a different video file');

  const data = await ffmpeg.readFile('output.mp4');
  return new Blob([data as Uint8Array], { type: 'video/mp4' });
}
