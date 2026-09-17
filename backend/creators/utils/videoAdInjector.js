'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const https = require('https');
const http  = require('http');
const { spawn } = require('child_process');
const { AD_FORMATS } = require('./adOverlay');

const FFMPEG  = process.env.FFMPEG_PATH  || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const AD_WINDOW_SEC = 6;       // how long the creative stays on screen per slot
const FADE_SEC      = 0.4;

const SHORT_VIDEO_THRESHOLD_SEC = 5 * 60;

function getAdSlots(duration) {
  if (duration < SHORT_VIDEO_THRESHOLD_SEC) {
    return [{ key: 'middle', time: duration / 2 }];
  }
  return [
    { key: 'intro',  time: SHORT_VIDEO_THRESHOLD_SEC },
    { key: 'middle', time: duration / 2 },
    { key: 'end',    time: duration * 0.8 },
  ];
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

function probeJson(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath]);
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exited ${code}: ${stderr.slice(-1000)}`));
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
    });
  });
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadToFile(res.headers.location, destPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) { file.close(); return reject(new Error(`Image download failed: ${res.statusCode}`)); }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    }).on('error', (err) => { file.close(); reject(err); });
  });
}

// Builds the filter_complex for one ad window given the claim's format.
function buildOverlayFilter({ adType, adSize, segDuration }) {
  const fmt   = AD_FORMATS[adType] || AD_FORMATS.corner;
  const sizes = fmt.sizes[adSize] || fmt.sizes.medium;
  const fadeOutStart = Math.max(0, segDuration - FADE_SEC).toFixed(2);

  if (adType === 'lbar') {
    const vRatio = sizes.vRatio, hRatio = sizes.hRatio;
    return {
      inputsPerSlot: 2, // same image used twice (left strip + bottom strip)
      filter:
        `[1:v]scale=iw*${vRatio}:ih,format=rgba,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1[left];` +
        `[2:v]scale=iw:ih*${hRatio},format=rgba,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1[bottom];` +
        `[0:v][left]overlay=x=0:y=0[tmp1];` +
        `[tmp1][bottom]overlay=x=0:y=H-h[vout]`,
    };
  }

  const ratio = sizes.ratio;
  return {
    inputsPerSlot: 1,
    filter:
      `[1:v]scale=iw*${ratio}:-1,format=rgba,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1[badge];` +
      `[0:v][badge]overlay=x=W-w-20:y=H-h-20[vout]`,
  };
}

// Re-encodes just the [start, start+dur] window of `srcPath` with the
// creative overlaid, writing an .mp4 that matches the source's codec so the
// final concat (-c copy) doesn't choke on mismatched streams.
async function renderAdSegment({ srcPath, start, dur, imagePath, adType, adSize, videoCodec, audioCodec, outPath }) {
  const { filter, inputsPerSlot } = buildOverlayFilter({ adType, adSize, segDuration: dur });
  const imageInputs = inputsPerSlot === 2 ? ['-i', imagePath, '-i', imagePath] : ['-i', imagePath];
  const vOutLabel = inputsPerSlot === 2 ? '[vout]' : '[vout]';

  const args = [
    '-y',
    '-ss', String(start), '-t', String(dur), '-i', srcPath,
    ...imageInputs,
    '-filter_complex', filter,
    '-map', vOutLabel, '-map', '0:a?',
    '-c:v', videoCodec === 'h264' ? 'libx264' : 'libx264',
    '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    outPath,
  ];
  await run(FFMPEG, args);
}

// Fast, lossless cut (no re-encode) of [start, end) (end=null means to EOF).
async function cutSegmentCopy({ srcPath, start, end, outPath }) {
  const args = ['-y'];
  if (start != null) args.push('-ss', String(start));
  args.push('-i', srcPath);
  if (end != null) args.push('-to', String(end - (start || 0)));
  args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero', outPath);
  await run(FFMPEG, args);
}

async function concatCopy(pieces, outPath) {
  const listPath = outPath + '.list.txt';
  fs.writeFileSync(listPath, pieces.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath]);
  fs.unlinkSync(listPath);
}

/**
 * Injects each claimed slot's creative into `srcPath` and writes the result
 * to `outPath`. `claims` is [{ slotType, imageUrl, adType, adSize }].
 * `onProgress(pct, message)` is called between steps for job status updates.
 */
async function injectAds({ srcPath, outPath, claims, onProgress = () => {} }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ypr_adjob_'));
  const cleanupPaths = [tmpDir];

  try {
    onProgress(5, 'Inspecting video…');
    const info = await probeJson(srcPath);
    const duration = parseFloat(info.format?.duration || '0');
    const vStream = (info.streams || []).find((s) => s.codec_type === 'video');
    const videoCodec = vStream?.codec_name || 'h264';

    if (!duration || !claims.length) {
      fs.copyFileSync(srcPath, outPath);
      onProgress(100, 'Done');
      return;
    }

    const slots = getAdSlots(duration);
    const activeSlots = slots
      .map((s) => ({ ...s, claim: claims.find((c) => c.slotType === s.key) }))
      .filter((s) => s.claim && s.time < duration)
      .sort((a, b) => a.time - b.time);

    if (!activeSlots.length) {
      fs.copyFileSync(srcPath, outPath);
      onProgress(100, 'Done');
      return;
    }

    onProgress(15, 'Downloading creative(s)…');
    for (const slot of activeSlots) {
      const ext = path.extname(new URL(slot.claim.imageUrl).pathname) || '.png';
      slot.imagePath = path.join(tmpDir, `${slot.key}${ext}`);
      await downloadToFile(slot.claim.imageUrl, slot.imagePath);
    }

    const pieces = [];
    let cursor = 0;
    let stepsDone = 0;
    const totalSteps = activeSlots.length * 2 + 1;

    for (const slot of activeSlots) {
      const winStart = Math.max(cursor, slot.time);
      const winEnd   = Math.min(duration, winStart + AD_WINDOW_SEC);

      if (winStart > cursor) {
        const beforePath = path.join(tmpDir, `piece_${pieces.length}.mp4`);
        await cutSegmentCopy({ srcPath, start: cursor, end: winStart, outPath: beforePath });
        pieces.push(beforePath);
      }
      stepsDone++; onProgress(15 + Math.round((stepsDone / totalSteps) * 70), `Placing ${slot.key} ad…`);

      const adPath = path.join(tmpDir, `ad_${pieces.length}.mp4`);
      await renderAdSegment({
        srcPath, start: winStart, dur: winEnd - winStart,
        imagePath: slot.imagePath, adType: slot.claim.adType, adSize: slot.claim.adSize,
        videoCodec, outPath: adPath,
      });
      pieces.push(adPath);
      stepsDone++; onProgress(15 + Math.round((stepsDone / totalSteps) * 70), `Placing ${slot.key} ad…`);

      cursor = winEnd;
    }

    if (cursor < duration) {
      const afterPath = path.join(tmpDir, `piece_${pieces.length}.mp4`);
      await cutSegmentCopy({ srcPath, start: cursor, end: null, outPath: afterPath });
      pieces.push(afterPath);
    }

    onProgress(90, 'Stitching final video…');
    await concatCopy(pieces, outPath);
    onProgress(100, 'Done');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { injectAds, getAdSlots, AD_WINDOW_SEC };
