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
const OVERLAY_WINDOW_SEC = 12; // within the requested 10-15s range
const FADE_SEC           = 1;
const AD_WIDTH_RATIO     = 0.22; // ad badge width relative to video width
const MARGIN_RATIO       = 0.03;

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
    .map((p) => ({ time: Number(p.time), imagePath: p.imagePath }))
    .filter((p) => Number.isFinite(p.time) && p.time >= 0 && p.time < duration && p.imagePath)
    .sort((a, b) => a.time - b.time);

  const windows = [];
  for (const p of sane) {
    let start = p.time;
    let end = Math.min(p.time + OVERLAY_WINDOW_SEC, duration);
    if (end - start < 1) continue; // too close to the end of the video to be worth it

    const prev = windows[windows.length - 1];
    if (prev && start < prev.end) {
      prev.end = Math.max(prev.end, end); // merge overlapping windows, keep prev's image
      continue;
    }
    windows.push({ start, end, imagePath: p.imagePath });
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
      '-shortest', // the ad image is looped indefinitely — stop once the (finite) video segment ends
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
// fast copy+concat path (no fade; chains one overlay stage per window so
// each can show its own image, only active during its own time range).
async function applyOverlayFullReencode({ videoPath, windows, videoInfo, outputPath }) {
  const { width } = videoInfo;
  const adWidth = Math.round(width * AD_WIDTH_RATIO);
  const margin  = Math.round(width * MARGIN_RATIO);

  const cmd = ffmpeg().input(videoPath);
  windows.forEach((w) => cmd.input(w.imagePath).inputOptions(['-loop', '1']));

  const filterParts = windows.map((w, i) => {
    const imgIn = `${i + 1}:v`;
    const vIn = i === 0 ? '0:v' : `tmp${i}`;
    const vOut = i === windows.length - 1 ? 'outv' : `tmp${i + 1}`;
    return (
      `[${imgIn}]scale=${adWidth}:-1[ad${i}];` +
      `[${vIn}][ad${i}]overlay=W-w-${margin}:H-h-${margin}:enable='between(t,${w.start},${w.end})'[${vOut}]`
    );
  });

  const cmdFinal = cmd
    .complexFilter(filterParts.join(';'))
    .outputOptions(['-map', '[outv]', '-map', '0:a?', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest'])
    .output(outputPath);
  await runCommand(cmdFinal);
}

/**
 * Burns one or more ad images into the video, each at its own timestamp.
 * `placements` is an array of { time (seconds), imagePath (local file path) }.
 * Returns { outputPath, cleanup }. Caller is responsible for calling cleanup()
 * once the processed file has been uploaded/consumed.
 */
async function applyAdOverlay({ videoPath, placements }) {
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

  const windows = buildWindows(placements, duration);
  if (windows.length === 0) return { outputPath: videoPath, cleanup: () => {} };

  const workDir = path.join(os.tmpdir(), `ypr_overlay_${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const outputPath = path.join(workDir, 'output.mp4');
  const cleanup = () => { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {} };

  const fastPathEligible = vStream.codec_name === 'h264' && (!aStream || aStream.codec_name === 'aac');

  try {
    if (!fastPathEligible) {
      console.warn(`[adOverlay] Source codec (${vStream.codec_name}/${aStream?.codec_name}) doesn't match the fast-path target (h264/aac) — falling back to a full re-encode.`);
      await applyOverlayFullReencode({ videoPath, windows, videoInfo, outputPath });
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
      await buildAdSegment({ videoPath, adImagePath: w.imagePath, start: w.start, end: w.end, videoInfo, segPath: adSegPath });
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

module.exports = { applyAdOverlay, estimateOverlaySeconds, computeSlotTimes, probeDuration, OVERLAY_WINDOW_SEC };
