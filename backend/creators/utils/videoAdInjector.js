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
const INTRO_SLOT_SEC = 30;

const SHORT_VIDEO_THRESHOLD_SEC = 5 * 60;

function getAdSlots(duration) {
  if (duration <= SHORT_VIDEO_THRESHOLD_SEC) {
    return [{ key: 'intro', time: INTRO_SLOT_SEC }];
  }
  return [
    { key: 'intro',  time: INTRO_SLOT_SEC },
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
      `[1:v]scale=iw*${ratio}:-1,pad=iw+16:ih+16:8:8:color=white,format=rgba,` +
      `fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1[badge];` +
      `[0:v][badge]overlay=x=W-w-20:y=H-h-20[vout]`,
  };
}

// Re-encodes just the [start, start+dur] window of `srcPath` with the
// creative overlaid, writing an .mp4 that matches the source's codec so the
// final concat (-c copy) doesn't choke on mismatched streams.
async function renderAdSegment({ srcPath, start, dur, imagePath, adType, adSize, videoCodec, audioCodec, outPath }) {
  const { filter, inputsPerSlot } = buildOverlayFilter({ adType, adSize, segDuration: dur });
  const imageInput = ['-loop', '1', '-framerate', '30', '-i', imagePath];
  const imageInputs = inputsPerSlot === 2 ? [...imageInput, ...imageInput] : imageInput;
  const vOutLabel = inputsPerSlot === 2 ? '[vout]' : '[vout]';

  const args = [
    '-y',
    '-ss', String(start), '-t', String(dur), '-i', srcPath,
    ...imageInputs,
    '-filter_complex_threads', '1',
    '-filter_threads', '1',
    '-filter_complex', filter,
    '-map', vOutLabel, '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'ultrafast', '-threads', '1', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-avoid_negative_ts', 'make_zero',
    '-shortest',
    outPath,
  ];
  await run(FFMPEG, args);
}

// Fast, lossless cut (no re-encode) of [start, end) (end=null means to EOF).
async function cutSegmentCopy({ srcPath, start, end, outPath }) {
  const args = ['-y'];
  if (start != null) args.push('-ss', String(start));
  args.push('-i', srcPath);
  if (end != null) args.push('-t', String(end - (start || 0)));
  args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero', outPath);
  await run(FFMPEG, args);
}

async function concatCopy(pieces, outPath) {
  const listPath = outPath + '.list.txt';
  fs.writeFileSync(listPath, pieces.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  await run(FFMPEG, ['-y', '-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-avoid_negative_ts', 'make_zero', outPath]);
  fs.unlinkSync(listPath);
}

function buildContinuousOverlayFilter({ activeSlots, duration }) {
  const filters = [];
  const inputs = [];
  let currentVideo = '[0:v]';
  let inputIndex = 1;

  activeSlots.forEach((slot, slotIndex) => {
    const start = Number(slot.time.toFixed(3));
    const end = Number(Math.min(duration, slot.time + AD_WINDOW_SEC).toFixed(3));
    const fadeOutStart = Math.max(0, end - start - FADE_SEC).toFixed(3);
    const fmt = AD_FORMATS[slot.claim.adType] || AD_FORMATS.corner;
    const sizes = fmt.sizes[slot.claim.adSize] || fmt.sizes.medium;
    const outputLabel = `[overlay${slotIndex}]`;

    if (slot.claim.adType === 'lbar') {
      const leftLabel = `[left${slotIndex}]`;
      const bottomLabel = `[bottom${slotIndex}]`;
      const leftInput = inputIndex++;
      const bottomInput = inputIndex++;
      inputs.push({ imagePath: slot.imagePath });
      inputs.push({ imagePath: slot.imagePath });
      filters.push(
        `[${leftInput}:v]scale=iw*${sizes.vRatio}:ih,format=rgba,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1,trim=duration=${end - start},setpts=PTS-STARTPTS+${start}/TB${leftLabel};`,
        `[${bottomInput}:v]scale=iw:ih*${sizes.hRatio},format=rgba,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1,trim=duration=${end - start},setpts=PTS-STARTPTS+${start}/TB${bottomLabel};`,
        `${currentVideo}${leftLabel}overlay=x=0:y=0:enable='between(t,${start},${end})':eof_action=pass:repeatlast=0[tmp${slotIndex}];`,
        `[tmp${slotIndex}]${bottomLabel}overlay=x=0:y=H-h:enable='between(t,${start},${end})':eof_action=pass:repeatlast=0${outputLabel}`,
      );
    } else {
      const badgeLabel = `[badge${slotIndex}]`;
      const imageInput = inputIndex++;
      inputs.push({ imagePath: slot.imagePath });
      filters.push(
        `[${imageInput}:v]scale=iw*${sizes.ratio}:-1,pad=iw+16:ih+16:8:8:color=white,format=rgba,fade=t=in:st=0:d=${FADE_SEC}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${FADE_SEC}:alpha=1,trim=duration=${end - start},setpts=PTS-STARTPTS+${start}/TB${badgeLabel};`,
        `${currentVideo}${badgeLabel}overlay=x=W-w-20:y=H-h-20:enable='between(t,${start},${end})':eof_action=pass:repeatlast=0${outputLabel}`,
      );
    }
    currentVideo = outputLabel;
  });

  return { filter: filters.join(''), inputs, outputLabel: currentVideo };
}

async function renderContinuousVideo({ srcPath, outPath, activeSlots, duration }) {
  const { filter, inputs, outputLabel } = buildContinuousOverlayFilter({ activeSlots, duration });
  const args = ['-y', '-i', srcPath];
  for (const input of inputs) args.push('-loop', '1', '-framerate', '30', '-i', input.imagePath);
  args.push(
    '-filter_complex_threads', '1', '-filter_threads', '1', '-filter_complex', filter,
    '-map', outputLabel, '-map', '0:a?', '-c:v', 'libx264', '-preset', 'ultrafast',
    '-threads', '1', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(duration), '-avoid_negative_ts', 'make_zero', outPath,
  );
  await run(FFMPEG, args);
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

    if (vStream?.width > 1920 || vStream?.height > 1080) {
      throw new Error('Video resolution is too high; export the video at 1080p or lower');
    }

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
      throw new Error('Selected ad claims do not match any available slot in this video');
    }

    onProgress(15, 'Downloading creative(s)…');
    for (const slot of activeSlots) {
      const ext = path.extname(new URL(slot.claim.imageUrl).pathname) || '.png';
      slot.imagePath = path.join(tmpDir, `${slot.key}${ext}`);
      await downloadToFile(slot.claim.imageUrl, slot.imagePath);
    }

    onProgress(40, 'Rendering ad overlay…');
    await renderContinuousVideo({ srcPath, outPath, activeSlots, duration });
    onProgress(90, 'Finishing video…');
    onProgress(100, 'Done');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { injectAds, getAdSlots, AD_WINDOW_SEC, buildContinuousOverlayFilter };
