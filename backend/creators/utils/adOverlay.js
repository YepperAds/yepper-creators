'use strict';

const ffmpeg      = require('fluent-ffmpeg');
const ffmpegPath  = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const fs          = require('fs');
const os          = require('os');
const path        = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// The ad is visible for this long per marker (with a fade in/out at the edges).
const OVERLAY_WINDOW_SEC = 6;
const FADE_SEC           = 1;
const AD_WIDTH_RATIO     = 0.22; // ad badge width relative to video width
const MARGIN_RATIO       = 0.03;

// Only the marker windows get re-encoded — everything else is a stream copy — so
// processing time scales with marker count, not with the host video's length.
const FIXED_OVERHEAD_SECONDS   = 8;  // probing + splitting + concatenation + ffmpeg startup
const ENCODE_SECONDS_PER_MARKER = 12; // observed throughput for a ~6s 1080p overlay window

function estimateOverlaySeconds(markerCount) {
  const n = Math.max(0, Math.min(Number(markerCount) || 0, 12));
  if (n === 0) return 0;
  return FIXED_OVERHEAD_SECONDS + n * ENCODE_SECONDS_PER_MARKER;
}

function probe(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function parseFrameRate(rate) {
  if (!rate || typeof rate !== 'string') return 30;
  const [num, den] = rate.split('/').map(Number);
  if (!den) return num || 30;
  return num / den;
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    cmd.on('error', (err) => reject(err)).on('end', () => resolve()).run();
  });
}

// Sorts/dedupes marker times, clamps each into a valid [0, duration] overlay
// window, and merges windows that would otherwise overlap.
function buildWindows(markers, duration) {
  const sane = Array.from(new Set(
    (markers || [])
      .map(Number)
      .filter((m) => Number.isFinite(m) && m >= 0 && m < duration),
  )).sort((a, b) => a - b);

  const windows = [];
  for (const m of sane) {
    let start = m;
    let end = Math.min(m + OVERLAY_WINDOW_SEC, duration);
    if (end - start < 1) continue; // too close to the end of the video to be worth it

    const prev = windows[windows.length - 1];
    if (prev && start < prev.end) {
      prev.end = Math.max(prev.end, end); // merge overlapping windows
      continue;
    }
    windows.push({ start, end });
  }
  return windows;
}

async function buildAdSegment({ videoPath, adImagePath, start, end, videoInfo, segPath }) {
  const { width, fps, hasAudio, sampleRate, channels } = videoInfo;
  const segDuration = end - start;
  const adWidth      = Math.round(width * AD_WIDTH_RATIO);
  const margin       = Math.round(width * MARGIN_RATIO);
  const fadeOutStart = Math.max(0, segDuration - FADE_SEC);

  const filter =
    `[1:v]scale=${adWidth}:-1,format=yuva420p,` +
    `fade=t=in:st=0:d=${FADE_SEC}:alpha=1,` +
    `fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1[ad];` +
    `[0:v][ad]overlay=W-w-${margin}:H-h-${margin}[outv]`;

  const cmd = ffmpeg()
    .input(videoPath).inputOptions(['-ss', String(start), '-to', String(end)])
    .input(adImagePath).inputOptions(['-loop', '1'])
    .complexFilter(filter)
    .outputOptions([
      '-map', '[outv]',
      ...(hasAudio ? ['-map', '0:a'] : []),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      ...(hasAudio ? ['-c:a', 'aac', '-ar', String(sampleRate), '-ac', String(channels)] : ['-an']),
    ])
    .output(segPath);

  await runCommand(cmd);
}

async function buildCopySegment({ videoPath, start, end, segPath }) {
  const cmd = ffmpeg()
    .input(videoPath).inputOptions(['-ss', String(start), '-to', String(end)])
    .outputOptions(['-c', 'copy', '-avoid_negative_ts', 'make_zero'])
    .output(segPath);
  await runCommand(cmd);
}

async function concatSegments(segPaths, outputPath, workDir) {
  const listPath = path.join(workDir, 'concat_list.txt');
  const listBody = segPaths.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, listBody);

  const cmd = ffmpeg()
    .input(listPath).inputOptions(['-f', 'concat', '-safe', '0'])
    .outputOptions(['-c', 'copy'])
    .output(outputPath);
  await runCommand(cmd);
}

// Slow but always-correct fallback for source codecs that don't allow the
// fast copy+concat path (no fade, single full re-encode pass).
async function applyOverlayFullReencode({ videoPath, adImagePath, windows, videoInfo, outputPath }) {
  const { width } = videoInfo;
  const adWidth = Math.round(width * AD_WIDTH_RATIO);
  const margin  = Math.round(width * MARGIN_RATIO);
  const enableExpr = windows.map((w) => `between(t,${w.start},${w.end})`).join('+');

  const cmd = ffmpeg()
    .input(videoPath)
    .input(adImagePath).inputOptions(['-loop', '1'])
    .complexFilter(`[1:v]scale=${adWidth}:-1[ad];[0:v][ad]overlay=W-w-${margin}:H-h-${margin}:enable='${enableExpr}'[outv]`)
    .outputOptions(['-map', '[outv]', '-map', '0:a?', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac'])
    .output(outputPath);
  await runCommand(cmd);
}

/**
 * Burns the ad image into the video at the given marker timestamps (seconds).
 * Returns { outputPath, cleanup }. Caller is responsible for calling cleanup()
 * once the processed file has been uploaded/consumed.
 */
async function applyAdOverlay({ videoPath, adImagePath, markers }) {
  const info = await probe(videoPath);
  const duration = parseFloat(info.format.duration);
  const vStream = info.streams.find((s) => s.codec_type === 'video');
  const aStream = info.streams.find((s) => s.codec_type === 'audio');
  if (!vStream || !Number.isFinite(duration)) throw new Error('Could not read video metadata');

  const videoInfo = {
    width: vStream.width,
    fps: parseFrameRate(vStream.avg_frame_rate && vStream.avg_frame_rate !== '0/0' ? vStream.avg_frame_rate : vStream.r_frame_rate),
    hasAudio: !!aStream,
    sampleRate: aStream ? aStream.sample_rate : null,
    channels: aStream ? aStream.channels : null,
  };

  const windows = buildWindows(markers, duration);
  if (windows.length === 0) return { outputPath: videoPath, cleanup: () => {} };

  const workDir = path.join(os.tmpdir(), `ypr_overlay_${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const outputPath = path.join(workDir, 'output.mp4');
  const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {} };

  const fastPathEligible = vStream.codec_name === 'h264' && (!aStream || aStream.codec_name === 'aac');

  try {
    if (!fastPathEligible) {
      console.warn(`[adOverlay] Source codec (${vStream.codec_name}/${aStream?.codec_name}) doesn't match the fast-path target (h264/aac) — falling back to a full re-encode.`);
      await applyOverlayFullReencode({ videoPath, adImagePath, windows, videoInfo, outputPath });
      return { outputPath, cleanup };
    }

    // Walk the timeline, alternating copy segments and re-encoded ad segments.
    const segPaths = [];
    let cursor = 0;
    let i = 0;
    for (const w of windows) {
      if (w.start > cursor) {
        const segPath = path.join(workDir, `seg${i++}.mp4`);
        await buildCopySegment({ videoPath, start: cursor, end: w.start, segPath });
        segPaths.push(segPath);
      }
      const adSegPath = path.join(workDir, `seg${i++}.mp4`);
      await buildAdSegment({ videoPath, adImagePath, start: w.start, end: w.end, videoInfo, segPath: adSegPath });
      segPaths.push(adSegPath);
      cursor = w.end;
    }
    if (cursor < duration) {
      const segPath = path.join(workDir, `seg${i++}.mp4`);
      await buildCopySegment({ videoPath, start: cursor, end: duration, segPath });
      segPaths.push(segPath);
    }

    await concatSegments(segPaths, outputPath, workDir);
    return { outputPath, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

module.exports = { applyAdOverlay, estimateOverlaySeconds, OVERLAY_WINDOW_SEC };
