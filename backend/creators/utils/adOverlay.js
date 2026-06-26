'use strict';

const ffmpeg      = require('fluent-ffmpeg');
const ffmpegPath  = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const fs          = require('fs');
const os          = require('os');
const path        = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Lowest OS scheduling priority (max niceness; no-op on Windows). Encoding
// now runs in the same process as the web server, so this is what keeps
// ffmpeg from starving the event loop of CPU on a constrained Render
// instance — without it, even a cheap GET (job-status polling) can stall
// long enough that Render's proxy 502s it.
const FFMPEG_NICENESS = 19;

// The ad is visible for this long per marker (with a fade in/out at the edges).
const OVERLAY_WINDOW_SEC = 12; // within the requested 10-15s range
const FADE_SEC           = 1;
const MARGIN_RATIO       = 0.03;

// Visual ad formats an advertiser picks when claiming a slot. Sizes are
// expressed as ratios of the video's own width/height so they scale to any
// resolution. Exported so the frontend can render the same labels/descriptions
// without duplicating them.
const AD_FORMATS = {
  corner: {
    label: 'Corner Badge',
    description: 'A small badge that pops up in a corner of the video and fades in/out without covering the content.',
    sizes: {
      small:  { ratio: 0.15 },
      medium: { ratio: 0.22 },
      large:  { ratio: 0.30 },
    },
  },
  lbar: {
    label: 'L-Bar',
    description: 'An L-shaped banner — a strip down the left edge plus a strip along the bottom — more visible than a corner badge, like on-screen TV branding.',
    sizes: {
      small:  { vRatio: 0.06, hRatio: 0.10 },
      medium: { vRatio: 0.08, hRatio: 0.14 },
      large:  { vRatio: 0.11, hRatio: 0.18 },
    },
  },
};
const AD_TYPES = Object.keys(AD_FORMATS);
const AD_SIZES = ['small', 'medium', 'large'];

function getFormatConfig(adType, adSize) {
  const type = AD_FORMATS[adType] ? adType : 'corner';
  const size = AD_FORMATS[type].sizes[adSize] ? adSize : 'medium';
  return { type, size, ...AD_FORMATS[type].sizes[size] };
}

// Only the marker windows get re-encoded — everything else is a stream copy — so
// processing time scales with marker count, not with the host video's length.
const FIXED_OVERHEAD_SECONDS   = 8;  // probing + splitting + concatenation + ffmpeg startup
const ENCODE_SECONDS_PER_MARKER = 18; // observed throughput for a ~12s 1080p overlay window

function estimateOverlaySeconds(markerCount) {
  const n = Math.max(0, Math.min(Number(markerCount) || 0, 12));
  if (n === 0) return 0;
  return FIXED_OVERHEAD_SECONDS + n * ENCODE_SECONDS_PER_MARKER;
}

// Mirrors the placement rule shown to creators/advertisers: under 5 minutes
// gets a single forced mid-roll; 5 minutes+ opens three slots. This is the
// server-side source of truth — the frontend's copy is for display only.
const SHORT_VIDEO_THRESHOLD_SEC = 5 * 60;

function computeSlotTimes(duration) {
  if (duration < SHORT_VIDEO_THRESHOLD_SEC) {
    return { middle: duration / 2 };
  }
  return {
    intro:  SHORT_VIDEO_THRESHOLD_SEC,
    middle: duration / 2,
    end:    duration * 0.8,
  };
}

function probe(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

async function probeDuration(filePath) {
  const info = await probe(filePath);
  const duration = parseFloat(info.format.duration);
  if (!Number.isFinite(duration)) throw new Error('Could not read video duration');
  return duration;
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

// Sorts/dedupes placements by time, clamps each into a valid [0, duration]
// overlay window, and merges windows that would otherwise overlap (keeping
// the earlier placement's image when two windows collide).
function buildWindows(placements, duration) {
  const sane = (placements || [])
    .map((p) => ({ time: Number(p.time), imagePath: p.imagePath, adType: p.adType || 'corner', adSize: p.adSize || 'medium' }))
    .filter((p) => Number.isFinite(p.time) && p.time >= 0 && p.time < duration && p.imagePath)
    .sort((a, b) => a.time - b.time);

  const windows = [];
  for (const p of sane) {
    let start = p.time;
    let end = Math.min(p.time + OVERLAY_WINDOW_SEC, duration);
    if (end - start < 1) continue; // too close to the end of the video to be worth it

    const prev = windows[windows.length - 1];
    if (prev && start < prev.end) {
      prev.end = Math.max(prev.end, end); // merge overlapping windows, keep prev's image/format
      continue;
    }
    windows.push({ start, end, imagePath: p.imagePath, adType: p.adType, adSize: p.adSize });
  }
  return windows;
}

// Builds the filter-graph fragment for a single ad placement: one branch for
// a corner badge, two (vertical + horizontal bar) for an L-bar, both ending
// in a named output pad so the caller can chain them.
function buildLayerFilters({ imageInputIndex, videoInPad, videoOutPad, adType, adSize, width, height, fadeOutStart, margin, enable, padPrefix }) {
  const enableSuffix = enable ? `:enable='${enable}'` : '';

  if (adType === 'lbar') {
    const { vRatio, hRatio } = getFormatConfig('lbar', adSize);
    const vBarW = Math.round(width * vRatio);
    const hBarH = Math.round(height * hRatio);
    const vPad = `${padPrefix}v`;
    const hPad = `${padPrefix}h`;
    const midPad = `${padPrefix}mid`;
    const fade = fadeOutStart != null
      ? `,format=yuva420p,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1`
      : '';
    return (
      `[${imageInputIndex}:v]scale=${vBarW}:${height}:force_original_aspect_ratio=increase,crop=${vBarW}:${height}${fade}[${vPad}];` +
      `[${imageInputIndex}:v]scale=${width}:${hBarH}:force_original_aspect_ratio=increase,crop=${width}:${hBarH}${fade}[${hPad}];` +
      `[${videoInPad}][${vPad}]overlay=0:0${enableSuffix}[${midPad}];` +
      `[${midPad}][${hPad}]overlay=0:H-h${enableSuffix}[${videoOutPad}]`
    );
  }

  const { ratio } = getFormatConfig('corner', adSize);
  const adWidth = Math.round(width * ratio);
  const adPad = `${padPrefix}ad`;
  const fade = fadeOutStart != null
    ? `,format=yuva420p,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1`
    : '';
  return (
    `[${imageInputIndex}:v]scale=${adWidth}:-1${fade}[${adPad}];` +
    `[${videoInPad}][${adPad}]overlay=W-w-${margin}:H-h-${margin}${enableSuffix}[${videoOutPad}]`
  );
}

async function buildAdSegment({ videoPath, adImagePath, start, end, videoInfo, segPath, adType, adSize }) {
  const { width, height, fps, hasAudio, sampleRate, channels } = videoInfo;
  const segDuration = end - start;
  const margin       = Math.round(width * MARGIN_RATIO);
  const fadeOutStart = Math.max(0, segDuration - FADE_SEC);

  const filter = buildLayerFilters({
    imageInputIndex: 1, videoInPad: '0:v', videoOutPad: 'outv',
    adType, adSize, width, height, fadeOutStart, margin, enable: null, padPrefix: 'l0',
  });

  const cmd = ffmpeg()
    .renice(FFMPEG_NICENESS)
    .input(videoPath).inputOptions(['-ss', String(start), '-to', String(end)])
    .input(adImagePath).inputOptions(['-loop', '1'])
    .complexFilter(filter)
    .outputOptions([
      '-map', '[outv]',
      ...(hasAudio ? ['-map', '0:a'] : []),
      '-c:v', 'libx264',
      '-preset', 'veryfast', // caps x264's lookahead/rate-control buffers — matters on a memory-limited instance
      '-threads', '2',
      '-pix_fmt', 'yuv420p',
      '-r', String(fps),
      ...(hasAudio ? ['-c:a', 'aac', '-ar', String(sampleRate), '-ac', String(channels)] : ['-an']),
      '-shortest', // the ad image is looped indefinitely — stop once the (finite) video segment ends
    ])
    .output(segPath);

  await runCommand(cmd);
}

async function buildCopySegment({ videoPath, start, end, segPath }) {
  const cmd = ffmpeg()
    .renice(FFMPEG_NICENESS)
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
    .renice(FFMPEG_NICENESS)
    .input(listPath).inputOptions(['-f', 'concat', '-safe', '0'])
    .outputOptions(['-c', 'copy'])
    .output(outputPath);
  await runCommand(cmd);
}

// Slow but always-correct fallback for source codecs that don't allow the
// fast copy+concat path (no fade; chains one overlay stage per window —
// two for L-bar — so each can show its own image/format, time-gated).
async function applyOverlayFullReencode({ videoPath, windows, videoInfo, outputPath }) {
  const { width, height } = videoInfo;
  const margin = Math.round(width * MARGIN_RATIO);

  const cmd = ffmpeg().renice(FFMPEG_NICENESS).input(videoPath);
  windows.forEach((w) => cmd.input(w.imagePath).inputOptions(['-loop', '1']));

  const filterParts = windows.map((w, i) => buildLayerFilters({
    imageInputIndex: i + 1,
    videoInPad:  i === 0 ? '0:v' : `tmp${i}`,
    videoOutPad: i === windows.length - 1 ? 'outv' : `tmp${i + 1}`,
    adType: w.adType, adSize: w.adSize, width, height, margin,
    fadeOutStart: null, // no fade in this fallback — hard cut on/off
    enable: `between(t,${w.start},${w.end})`,
    padPrefix: `l${i}`,
  }));

  const cmdFinal = cmd
    .complexFilter(filterParts.join(';'))
    .outputOptions([
      '-map', '[outv]', '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast', // this path re-encodes the WHOLE video — default preset's lookahead buffers are what was OOM-killing a 512MB instance
      '-threads', '2',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest',
    ])
    .output(outputPath);
  await runCommand(cmdFinal);
}

/**
 * Burns one or more ad images into the video, each at its own timestamp.
 * `placements` is an array of { time (seconds), imagePath (local file path) }.
 * Returns { outputPath, cleanup }. Caller is responsible for calling cleanup()
 * once the processed file has been uploaded/consumed.
 */
// Logs RSS so we can see exactly where memory climbs on Render instead of
// guessing — remove once the real OOM source is confirmed and fixed.
function memLog(label) {
  const mb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log(`[memlog] ${label}: RSS=${mb}MB`);
}

async function applyAdOverlay({ videoPath, placements }) {
  memLog('applyAdOverlay:start');
  const info = await probe(videoPath);
  memLog('applyAdOverlay:after-probe');
  const duration = parseFloat(info.format.duration);
  const vStream = info.streams.find((s) => s.codec_type === 'video');
  const aStream = info.streams.find((s) => s.codec_type === 'audio');
  if (!vStream || !Number.isFinite(duration)) throw new Error('Could not read video metadata');
  console.log(`[adOverlay] video: ${vStream.width}x${vStream.height} ${vStream.codec_name}, audio: ${aStream?.codec_name ?? 'none'}, duration: ${duration.toFixed(1)}s`);

  const videoInfo = {
    width: vStream.width,
    height: vStream.height,
    fps: parseFrameRate(vStream.avg_frame_rate && vStream.avg_frame_rate !== '0/0' ? vStream.avg_frame_rate : vStream.r_frame_rate),
    hasAudio: !!aStream,
    sampleRate: aStream ? aStream.sample_rate : null,
    channels: aStream ? aStream.channels : null,
  };

  const windows = buildWindows(placements, duration);
  if (windows.length === 0) return { outputPath: videoPath, cleanup: () => {} };

  const workDir = path.join(os.tmpdir(), `ypr_overlay_${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const outputPath = path.join(workDir, 'output.mp4');
  const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {} };

  const fastPathEligible = vStream.codec_name === 'h264' && (!aStream || aStream.codec_name === 'aac');

  console.log(`[adOverlay] path: ${fastPathEligible ? 'FAST (segment copy+concat)' : 'SLOW (full re-encode)'}, windows: ${windows.length}`);
  memLog('applyAdOverlay:before-encode');

  try {
    if (!fastPathEligible) {
      console.warn(`[adOverlay] Source codec (${vStream.codec_name}/${aStream?.codec_name}) doesn't match the fast-path target (h264/aac) — falling back to a full re-encode.`);
      await applyOverlayFullReencode({ videoPath, windows, videoInfo, outputPath });
      memLog('applyAdOverlay:after-full-reencode');
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
        memLog(`applyAdOverlay:after-copy-segment-${i}`);
        segPaths.push(segPath);
      }
      const adSegPath = path.join(workDir, `seg${i++}.mp4`);
      await buildAdSegment({ videoPath, adImagePath: w.imagePath, start: w.start, end: w.end, videoInfo, segPath: adSegPath, adType: w.adType, adSize: w.adSize });
      memLog(`applyAdOverlay:after-ad-segment-${i}`);
      segPaths.push(adSegPath);
      cursor = w.end;
    }
    if (cursor < duration) {
      const segPath = path.join(workDir, `seg${i++}.mp4`);
      await buildCopySegment({ videoPath, start: cursor, end: duration, segPath });
      segPaths.push(segPath);
    }

    memLog('applyAdOverlay:before-concat');
    await concatSegments(segPaths, outputPath, workDir);
    memLog('applyAdOverlay:after-concat');
    return { outputPath, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

module.exports = { applyAdOverlay, estimateOverlaySeconds, computeSlotTimes, probeDuration, OVERLAY_WINDOW_SEC, AD_FORMATS, AD_TYPES, AD_SIZES, memLog };
