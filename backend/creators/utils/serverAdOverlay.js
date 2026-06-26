'use strict';

// Server-side replacement for the browser's ffmpeg.wasm pipeline
// (app/(advertiser)/_components/lib/clientAdOverlay.ts). Same algorithm —
// stream-copy everything except a ~12s window around each ad marker, only
// re-encoding those windows, with a full-reencode fallback if the source
// codec isn't copy-compatible — but run with a real native multi-threaded
// ffmpeg binary against files on disk instead of a single-threaded WASM
// build inside a browser tab. That's what makes hour+ videos viable: the
// browser path was fundamentally too slow for those, not just buggy.

const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

const OVERLAY_WINDOW_SEC = 12;
const FADE_SEC = 1;
const MARGIN_RATIO = 0.03;

const AD_FORMAT_SIZES = {
  corner: { small: { ratio: 0.15 }, medium: { ratio: 0.22 }, large: { ratio: 0.30 } },
  lbar:   { small: { vRatio: 0.06, hRatio: 0.10 }, medium: { vRatio: 0.08, hRatio: 0.14 }, large: { vRatio: 0.11, hRatio: 0.18 } },
};

function getFormatConfig(adType, adSize) {
  const type = AD_FORMAT_SIZES[adType] ? adType : 'corner';
  const size = AD_FORMAT_SIZES[type][adSize] ? adSize : 'medium';
  return { type, size, ...AD_FORMAT_SIZES[type][size] };
}

// Sorts/dedupes placements, clamps each into a valid overlay window, and
// merges windows that would otherwise overlap — mirrors clientAdOverlay.ts.
function buildWindows(placements, duration) {
  const sane = placements
    .map((p) => ({ time: Number(p.time), imagePath: p.imagePath, adType: p.adType || 'corner', adSize: p.adSize || 'medium' }))
    .filter((p) => Number.isFinite(p.time) && p.time >= 0 && p.time < duration && p.imagePath)
    .sort((a, b) => a.time - b.time);

  const windows = [];
  for (const p of sane) {
    const start = p.time;
    const end = Math.min(p.time + OVERLAY_WINDOW_SEC, duration);
    if (end - start < 1) continue;
    const prev = windows[windows.length - 1];
    if (prev && start < prev.end) {
      prev.end = Math.max(prev.end, end);
      continue;
    }
    windows.push({ start, end, imagePath: p.imagePath, adType: p.adType, adSize: p.adSize });
  }
  return windows;
}

function buildLayerFilter({ imageInputIndex, videoInPad, videoOutPad, adType, adSize, width, height, fadeOutStart, margin }) {
  const fade = `,format=yuva420p,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1`;

  if (adType === 'lbar') {
    const { vRatio, hRatio } = getFormatConfig('lbar', adSize);
    const vBarW = Math.round(width * vRatio);
    const hBarH = Math.round(height * hRatio);
    return (
      `[${imageInputIndex}:v]scale=${vBarW}:${height}:force_original_aspect_ratio=increase,crop=${vBarW}:${height}${fade}[lv];` +
      `[${imageInputIndex}:v]scale=${width}:${hBarH}:force_original_aspect_ratio=increase,crop=${width}:${hBarH}${fade}[lh];` +
      `[${videoInPad}][lv]overlay=0:0[lmid];` +
      `[lmid][lh]overlay=0:H-h[${videoOutPad}]`
    );
  }

  const { ratio } = getFormatConfig('corner', adSize);
  const adWidth = Math.round(width * ratio);
  return (
    `[${imageInputIndex}:v]scale=${adWidth}:-1${fade}[lad];` +
    `[${videoInPad}][lad]overlay=W-w-${margin}:H-h-${margin}[${videoOutPad}]`
  );
}

async function probeVideo(inputPath) {
  const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath];
  const out = await new Promise((resolve, reject) => {
    const child = spawn(ffprobePath, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe-failed: ${stderr.slice(-500)}`));
      resolve(stdout);
    });
  });

  let data;
  try { data = JSON.parse(out); } catch (e) { throw new Error(`ffprobe-parse-failed: ${e.message}`); }
  const duration = Number(data.format?.duration);
  const vStream = (data.streams || []).find((s) => s.codec_type === 'video');
  if (!vStream || !Number.isFinite(duration)) throw new Error('ffprobe-missing-metadata');
  return { duration, width: vStream.width, height: vStream.height };
}

// ffmpeg never rejects on its own if a command runs away — it just keeps
// grinding. timeoutMs guarantees this always settles by killing the process.
// When durationSec + onFrac are given, parses ffmpeg's own `-progress
// pipe:1` output for real progress instead of guessing.
function execFFmpeg(args, { timeoutMs, durationSec, onFrac } = {}) {
  return new Promise((resolve, reject) => {
    const reportProgress = durationSec && onFrac;
    const fullArgs = reportProgress ? [...args, '-progress', 'pipe:1', '-nostats'] : args;
    const child = spawn(ffmpegPath, fullArgs);

    let settled = false;
    let timer = null;
    let errTail = '';
    let stdoutBuf = '';

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn(value);
    };

    if (timeoutMs) {
      timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* best effort */ }
        finish(reject, new Error('ffmpeg-timeout'));
      }, timeoutMs);
    }

    if (reportProgress) {
      child.stdout.on('data', (d) => {
        stdoutBuf += d;
        let idx;
        while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
          const line = stdoutBuf.slice(0, idx);
          stdoutBuf = stdoutBuf.slice(idx + 1);
          // out_time_ms is actually microseconds — a long-standing ffmpeg
          // naming quirk in its own -progress output.
          const m = /^out_time_ms=(-?\d+)/.exec(line);
          if (m) onFrac(Math.min(1, Math.max(0, Number(m[1]) / 1e6 / durationSec)));
        }
      });
    }

    child.stderr.on('data', (d) => {
      errTail += d;
      if (errTail.length > 4000) errTail = errTail.slice(-4000);
    });

    child.on('error', (err) => finish(reject, err));
    child.on('close', (code) => finish(resolve, { code, stderrTail: errTail.slice(-800) }));
  });
}

// Downloads each placement's creative (advertiser-claimed images live on
// Cloudinary, referenced by URL) into the job's temp workDir, or passes
// through an already-local path (the optional test-creative upload).
async function resolveImages(placements, workDir) {
  const out = [];
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    let imagePath = p.imagePath;
    if (!imagePath && p.imageUrl) {
      const res = await fetch(p.imageUrl);
      if (!res.ok) throw new Error(`Failed to download ad creative: ${p.imageUrl}`);
      const ext = path.extname(new URL(p.imageUrl).pathname) || '.png';
      imagePath = path.join(workDir, `src_img_${i}${ext}`);
      await fsp.writeFile(imagePath, Buffer.from(await res.arrayBuffer()));
    }
    if (!imagePath) continue;
    out.push({ time: p.time, imagePath, adType: p.adType, adSize: p.adSize });
  }
  return out;
}

async function fullReencodeFallback({ inputPath, outputPath, width, height, duration, windows, margin, onFrac }) {
  const args = ['-i', inputPath];
  for (const w of windows) args.push('-loop', '1', '-i', w.imagePath);

  const filterParts = windows.map((w, i) => {
    const videoInPad = i === 0 ? '0:v' : `tmp${i}`;
    const videoOutPad = i === windows.length - 1 ? 'outv' : `tmp${i + 1}`;
    const enable = `between(t,${w.start},${w.end})`;

    if (w.adType === 'lbar') {
      const { vRatio, hRatio } = getFormatConfig('lbar', w.adSize);
      const vBarW = Math.round(width * vRatio);
      const hBarH = Math.round(height * hRatio);
      return (
        `[${i + 1}:v]scale=${vBarW}:${height}:force_original_aspect_ratio=increase,crop=${vBarW}:${height}[v${i}];` +
        `[${i + 1}:v]scale=${width}:${hBarH}:force_original_aspect_ratio=increase,crop=${width}:${hBarH}[h${i}];` +
        `[${videoInPad}][v${i}]overlay=0:0:enable='${enable}'[mid${i}];` +
        `[mid${i}][h${i}]overlay=0:H-h:enable='${enable}'[${videoOutPad}]`
      );
    }

    const { ratio } = getFormatConfig('corner', w.adSize);
    const adWidth = Math.round(width * ratio);
    return (
      `[${i + 1}:v]scale=${adWidth}:-1[ad${i}];` +
      `[${videoInPad}][ad${i}]overlay=W-w-${margin}:H-h-${margin}:enable='${enable}'[${videoOutPad}]`
    );
  });

  // 30 min ceiling — generous since this no longer has to fit inside a
  // browser session, just bounded so a pathological job can't run forever.
  const { code, stderrTail } = await execFFmpeg([
    ...args,
    '-filter_complex', filterParts.join(';'),
    '-map', '[outv]', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest',
    outputPath,
  ], { timeoutMs: 30 * 60_000, durationSec: duration, onFrac });
  if (code !== 0) throw new Error(`full-reencode-failed: ${stderrTail}`);
}

// inputPath/outputPath are real files on disk; placements carry either a
// remote imageUrl or a local imagePath. onProgress receives 0..100.
async function applyAdOverlayOnDisk({ inputPath, outputPath, width, height, duration, placements, onProgress }) {
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ypr_adoverlay_'));
  try {
    const resolved = await resolveImages(placements, workDir);
    const windows = buildWindows(resolved, duration);
    const margin = Math.round(width * MARGIN_RATIO);

    if (windows.length === 0) {
      await fsp.copyFile(inputPath, outputPath);
      onProgress?.(100);
      return;
    }

    const totalSteps = windows.length * 2 + 1; // ~copy+ad per window, plus the final concat
    let stepsDone = 0;
    const reportStep = () => { stepsDone += 1; onProgress?.(Math.min(99, Math.round((stepsDone / totalSteps) * 100))); };
    const reportIntraStep = (frac) => onProgress?.(Math.min(99, Math.round(((stepsDone + frac) / totalSteps) * 100)));

    const segNames = [];
    let segIdx = 0;
    let cursor = 0;
    let fastPathOk = true;

    const runCopySegment = async (start, end) => {
      const name = path.join(workDir, `seg${segIdx++}.mp4`);
      const { code, stderrTail } = await execFFmpeg(
        ['-ss', String(start), '-to', String(end), '-i', inputPath, '-c', 'copy', '-avoid_negative_ts', 'make_zero', name],
        { timeoutMs: 120_000, durationSec: end - start, onFrac: reportIntraStep },
      );
      if (code !== 0) throw new Error(`copy-segment-failed: ${stderrTail}`);
      segNames.push(name);
      reportStep();
    };

    const runAdSegment = async (start, end, imagePath, adType, adSize) => {
      const name = path.join(workDir, `seg${segIdx++}.mp4`);
      const segDuration = end - start;
      const fadeOutStart = Math.max(0, segDuration - FADE_SEC);
      const filter = buildLayerFilter({ imageInputIndex: 1, videoInPad: '0:v', videoOutPad: 'outv', adType, adSize, width, height, fadeOutStart, margin });
      const { code, stderrTail } = await execFFmpeg([
        '-ss', String(start), '-to', String(end), '-i', inputPath,
        '-loop', '1', '-t', String(segDuration), '-i', imagePath,
        '-filter_complex', filter,
        '-map', '[outv]', '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest',
        name,
      ], { timeoutMs: 180_000, durationSec: segDuration, onFrac: reportIntraStep });
      if (code !== 0) throw new Error(`ad-segment-failed: ${stderrTail}`);
      segNames.push(name);
      reportStep();
    };

    try {
      for (const w of windows) {
        if (w.start > cursor) await runCopySegment(cursor, w.start);
        await runAdSegment(w.start, w.end, w.imagePath, w.adType, w.adSize);
        cursor = w.end;
      }
      if (cursor < duration) await runCopySegment(cursor, duration);
    } catch (err) {
      console.warn('[serverAdOverlay] fast path failed, falling back to full re-encode:', err);
      fastPathOk = false;
    }

    if (!fastPathOk) {
      for (const name of segNames) { try { await fsp.unlink(name); } catch { /* best effort */ } }
      const floorPct = Math.min(90, Math.round((stepsDone / totalSteps) * 100));
      await fullReencodeFallback({
        inputPath, outputPath, width, height, duration, windows, margin,
        onFrac: (frac) => onProgress?.(Math.min(99, floorPct + Math.round(frac * (99 - floorPct)))),
      });
      onProgress?.(100);
      return;
    }

    const listPath = path.join(workDir, 'concat_list.txt');
    const listBody = segNames.map((n) => `file '${n.replace(/'/g, "'\\''")}'`).join('\n');
    await fsp.writeFile(listPath, listBody);
    const { code: concatCode } = await execFFmpeg(['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath], { timeoutMs: 120_000 });
    reportStep();
    if (concatCode !== 0) throw new Error('Failed to stitch the processed video together');
    onProgress?.(100);
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { applyAdOverlayOnDisk, probeVideo };
