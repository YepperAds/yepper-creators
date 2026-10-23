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

const PERCENTAGE_SLOTS = [
  { key: '8pct', percent: 8 },
  { key: '25pct', percent: 25 },
  { key: '45pct', percent: 45 },
  { key: '65pct', percent: 65 },
  { key: '85pct', percent: 85 },
];

function getAdSlots(duration) {
  return PERCENTAGE_SLOTS.map(({ key, percent }) => ({
    key,
    time: duration * (percent / 100),
  }));
}

function run(cmd, args, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stderr = '';
    let stdoutBuffer = '';
    let reportedTime = 0;
    child.stdout.on('data', (data) => {
      if (!onProgress) return;
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const match = /^out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
        if (!match) continue;
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        if (seconds > reportedTime) {
          reportedTime = seconds;
          onProgress(seconds);
        }
      }
    });
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

// Re-encodes only the short ad window; the rest of an MP4 can stay stream-copied.
async function renderAdSegment({ srcPath, start, dur, imagePath, adType, adSize, outPath, onProgress }) {
  const { filter, inputsPerSlot } = buildOverlayFilter({ adType, adSize, segDuration: dur });
  const imageInput = ['-loop', '1', '-framerate', '30', '-i', imagePath];
  const imageInputs = inputsPerSlot === 2 ? [...imageInput, ...imageInput] : imageInput;
  const args = [
    '-y',
    '-ss', String(start), '-t', String(dur), '-i', srcPath,
    ...imageInputs,
    '-filter_complex_threads', '1',
    '-filter_threads', '1',
    '-filter_complex', filter,
    '-map', '[vout]', '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'ultrafast', '-threads', '1', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-progress', 'pipe:1', '-nostats',
    '-avoid_negative_ts', 'make_zero',
    '-shortest',
    outPath,
  ];
  await run(FFMPEG, args, {
    onProgress: (seconds) => onProgress?.(Math.min(1, seconds / dur)),
  });
}

function buildConcatList(pieces) {
  const lines = ['ffconcat version 1.0'];
  for (const piece of pieces) {
    const pathToFile = typeof piece === 'string' ? piece : piece.path;
    lines.push(`file '${pathToFile.replace(/'/g, "'\\''")}'`);
    if (typeof piece !== 'string') {
      lines.push(`inpoint ${piece.inpoint}`, `outpoint ${piece.outpoint}`);
    }
  }
  return lines.join('\n');
}

async function concatCopy(pieces, outPath, { duration, onProgress } = {}) {
  const listPath = outPath + '.list.txt';
  try {
    fs.writeFileSync(listPath, buildConcatList(pieces));
    const args = ['-y', '-fflags', '+genpts', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy'];
    if (onProgress && duration) args.push('-progress', 'pipe:1', '-nostats');
    args.push('-avoid_negative_ts', 'make_zero', outPath);
    await run(FFMPEG, args, {
      onProgress: duration && onProgress
        ? (seconds) => onProgress(Math.min(1, seconds / duration))
        : undefined,
    });
  } finally {
    fs.rmSync(listPath, { force: true });
  }
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

async function renderContinuousVideo({ srcPath, outPath, activeSlots, duration, onProgress }) {
  const { filter, inputs, outputLabel } = buildContinuousOverlayFilter({ activeSlots, duration });
  const args = ['-y', '-i', srcPath];
  for (const input of inputs) args.push('-loop', '1', '-framerate', '30', '-i', input.imagePath);
  args.push(
    '-filter_complex_threads', '1', '-filter_threads', '1', '-filter_complex', filter,
    '-map', outputLabel, '-map', '0:a?', '-c:v', 'libx264', '-preset', 'ultrafast',
    '-threads', '1', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-progress', 'pipe:1', '-nostats',
    '-t', String(duration), '-avoid_negative_ts', 'make_zero', outPath,
  );
  await run(FFMPEG, args, {
    onProgress: (seconds) => onProgress?.(Math.min(1, seconds / duration)),
  });
}

async function renderSegmentedVideo({ srcPath, outPath, activeSlots, duration, tmpDir, onProgress }) {
  const pieces = [];
  let cursor = 0;
  const progressPerSlot = 0.8 / activeSlots.length;

  for (let index = 0; index < activeSlots.length; index += 1) {
    const slot = activeSlots[index];
    const slotEnd = Math.min(duration, slot.time + AD_WINDOW_SEC);
    if (slot.time > cursor) {
      pieces.push({ path: srcPath, inpoint: cursor, outpoint: slot.time });
    }

    const adPath = path.join(tmpDir, `ad-${index}.mp4`);
    await renderAdSegment({
      srcPath,
      start: slot.time,
      dur: slotEnd - slot.time,
      imagePath: slot.imagePath,
      adType: slot.claim.adType,
      adSize: slot.claim.adSize,
      outPath: adPath,
      onProgress: (segmentProgress) => onProgress(
        0.1 + (index * progressPerSlot) + (segmentProgress * progressPerSlot),
        `Rendering ad ${index + 1} of ${activeSlots.length}…`,
      ),
    });
    pieces.push(adPath);
    cursor = slotEnd;
  }

  if (cursor < duration) {
    pieces.push({ path: srcPath, inpoint: cursor, outpoint: duration });
  }

  onProgress(0.92, 'Joining video segments…');
  await concatCopy(pieces, outPath, {
    duration,
    onProgress: (progress) => onProgress(0.92 + (progress * 0.06), 'Joining video segments…'),
  });
}

/**
 * Injects each claimed slot's creative into `srcPath` and writes the result
 * to `outPath`. `claims` is [{ slotType, imageUrl, adType, adSize }].
 * `onProgress(pct, message)` is called between steps for job status updates.
 */
async function injectAds({ srcPath, outPath, claims, onProgress = () => {} }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ypr_adjob_'));

  try {
    onProgress(5, 'Inspecting video…');
    const info = await probeJson(srcPath);
    const duration = parseFloat(info.format?.duration || '0');
    const vStream = (info.streams || []).find((s) => s.codec_type === 'video');
    const audioStream = (info.streams || []).find((stream) => stream.codec_type === 'audio');

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
    const canRenderAdSegments = path.extname(srcPath).toLowerCase() === '.mp4'
      && vStream?.codec_name === 'h264'
      && (!audioStream || audioStream.codec_name === 'aac');
    if (canRenderAdSegments) {
      try {
        await renderSegmentedVideo({
          srcPath,
          outPath,
          activeSlots,
          duration,
          tmpDir,
          onProgress: (progress, message) => onProgress(40 + Math.round(progress * 50), message),
        });
      } catch (err) {
        console.error('[videoAdInjector] Segmented MP4 rendering failed; retrying with full video encoding:', err.message);
        onProgress(40, 'Retrying with full video encoding…');
        await renderContinuousVideo({
          srcPath,
          outPath,
          activeSlots,
          duration,
          onProgress: (progress) => onProgress(40 + Math.round(progress * 50), 'Rendering ad overlay…'),
        });
      }
    } else {
      await renderContinuousVideo({
        srcPath,
        outPath,
        activeSlots,
        duration,
        onProgress: (progress) => onProgress(40 + Math.round(progress * 50), 'Rendering ad overlay…'),
      });
    }
    onProgress(90, 'Finishing video…');
    onProgress(100, 'Done');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { injectAds, getAdSlots, AD_WINDOW_SEC, buildContinuousOverlayFilter, buildConcatList };
