#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BADGE_SECONDS = 15;
const MAX_BADGE_BYTES = 20 * 1024 * 1024;
const ENCODER_BY_CODEC = {
  h264: 'libx264',
  hevc: 'libx265',
  vp8: 'libvpx',
  vp9: 'libvpx-vp9',
  mpeg4: 'mpeg4',
  av1: 'libaom-av1',
  mpeg2video: 'mpeg2video',
};

function parseArgs(args) {
  const parsed = { badges: [] };
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--badge') {
      parsed.badges.push(args[++index]);
    } else if (['--input', '--output', '--slots'].includes(option)) {
      parsed[option.slice(2)] = args[++index];
    } else if (option === '--help') {
      parsed.help = true;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }
  return parsed;
}

function run(command, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const commandArgs = command === 'ffmpeg'
      ? ['-hide_banner', '-loglevel', 'error', '-nostats', ...args]
      : args;
    const child = spawn(command, commandArgs, { stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.setEncoding('utf8').on('data', (data) => { stdout += data; });
      child.stderr.setEncoding('utf8').on('data', (data) => { stderr += data; });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
    });
  });
}

function parseRate(value) {
  const [numerator, denominator] = String(value || '').split('/').map(Number);
  return numerator > 0 && denominator > 0 ? numerator / denominator : 0;
}

function safeProfile(profile) {
  const value = String(profile || '').toLowerCase();
  if (value.includes('baseline')) return 'baseline';
  if (value === 'main') return 'main';
  if (value === 'high') return 'high';
  if (value.includes('high 10')) return 'high10';
  if (value.includes('high 4:2:2')) return 'high422';
  if (value.includes('high 4:4:4')) return 'high444';
  return null;
}

function parseBadge(argument) {
  const separator = String(argument || '').indexOf('=');
  if (separator <= 0) throw new Error('--badge must be written as PERCENT=image-path-or-url.');
  return {
    slotType: argument.slice(0, separator),
    imageUrl: argument.slice(separator + 1),
  };
}

async function downloadBadge(imageUrl, destination) {
  if (!/^https?:\/\//i.test(imageUrl)) {
    const sourcePath = path.resolve(imageUrl);
    const file = await stat(sourcePath);
    if (!file.isFile() || file.size <= 0 || file.size > MAX_BADGE_BYTES) {
      throw new Error(`Local badge image must be a non-empty file under 20 MiB: ${sourcePath}`);
    }
    await copyFile(sourcePath, destination);
    return;
  }
  const url = new URL(imageUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('Badge URLs must use the secure res.cloudinary.com host.');
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Could not download badge image (HTTP ${response.status}).`);
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BADGE_BYTES) {
    throw new Error('Badge image exceeds the 20 MiB limit.');
  }
  const image = Buffer.from(await response.arrayBuffer());
  if (!image.length || image.length > MAX_BADGE_BYTES) throw new Error('Badge image is empty or exceeds the 20 MiB limit.');
  await writeFile(destination, image);
}

function seconds(value) {
  return Number(value).toFixed(3);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'Usage: node local-video-helper.mjs --input VIDEO --output OUTPUT.mkv --slots 8pct,25pct --badge 8pct=BADGE_IMAGE --badge 25pct=BADGE_IMAGE\n',
    );
    return;
  }
  if (!args.input || !args.output || !args.slots) {
    throw new Error('Required: --input, --output, and --slots. Run with --help for an example.');
  }
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const outputDirectory = path.dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });

  const probe = JSON.parse(await run('ffprobe', [
    '-v', 'error', '-show_streams', '-show_format', '-of', 'json', inputPath,
  ], { capture: true }));
  const video = probe.streams?.find((stream) => stream.codec_type === 'video');
  if (!video) throw new Error('Input does not contain a video stream.');
  const duration = Number(probe.format?.duration);
  const frameRate = parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate);
  const encoder = ENCODER_BY_CODEC[video.codec_name];
  if (!Number.isFinite(duration) || duration <= 0 || !frameRate || !encoder) {
    throw new Error(`Cannot preserve the source video codec (${video.codec_name || 'unknown'}) and frame rate.`);
  }

  const slots = [...new Set(args.slots.split(',').map((slot) => slot.trim()).filter(Boolean))]
    .map((slotType) => {
      const percent = Number(slotType.replace(/(?:pct|%)$/, ''));
      if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
        throw new Error(`Invalid percentage slot: ${slotType}`);
      }
      const badge = args.badges.map(parseBadge).find((item) => item.slotType === slotType);
      if (!badge) throw new Error(`Provide an image with --badge ${slotType}=IMAGE_URL.`);
      const startsAt = duration * percent / 100;
      return { ...badge, slotType, startsAt, endsAt: Math.min(duration, startsAt + BADGE_SECONDS) };
    })
    .sort((a, b) => a.startsAt - b.startsAt);
  for (let index = 1; index < slots.length; index += 1) {
    if (slots[index].startsAt < slots[index - 1].endsAt) {
      throw new Error('Selected badge windows overlap.');
    }
  }

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'yepper-video-'));
  const pieces = [];
  let cursor = 0;
  const audio = probe.streams?.some((stream) => stream.codec_type === 'audio');
  const encoderArgs = ['-c:v', encoder, '-threads', '1'];
  const profile = video.codec_name === 'h264' ? safeProfile(video.profile) : null;
  if (profile) encoderArgs.push('-profile:v', profile);
  if (video.pix_fmt) encoderArgs.push('-pix_fmt', video.pix_fmt);
  encoderArgs.push('-r', String(frameRate));
  const bitrate = Number(video.bit_rate);
  if (Number.isFinite(bitrate) && bitrate > 0) encoderArgs.push('-b:v', String(Math.round(bitrate)));

  const copyPiece = async (start, end) => {
    if (end <= start) return;
    const destination = path.join(tempDirectory, `piece-${String(pieces.length).padStart(3, '0')}.mkv`);
    process.stdout.write(`Copying untouched section ${seconds(start)}–${seconds(end)} seconds…\n`);
    await run('ffmpeg', [
      '-y', '-ss', seconds(start), '-i', inputPath, '-t', seconds(end - start),
      '-map', '0:v:0', ...(audio ? ['-map', '0:a:0?'] : []),
      '-c', 'copy', '-avoid_negative_ts', 'make_zero', destination,
    ]);
    pieces.push(destination);
  };

  try {
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      await copyPiece(cursor, slot.startsAt);
      const badgePath = path.join(tempDirectory, `badge-${index}.png`);
      await downloadBadge(slot.imageUrl, badgePath);
      const destination = path.join(tempDirectory, `piece-${String(pieces.length).padStart(3, '0')}.mkv`);
      const badgeWidth = Math.max(32, Math.round(video.width * 0.2));
      const badgeHeight = Math.max(32, Math.round(video.height * 0.2));
      process.stdout.write(`Rendering ${slot.slotType} badge (${seconds(slot.startsAt)}–${seconds(slot.endsAt)} seconds)…\n`);
      await run('ffmpeg', [
        '-y', '-ss', seconds(slot.startsAt), '-i', inputPath,
        '-loop', '1', '-framerate', String(frameRate), '-i', badgePath,
        '-t', seconds(slot.endsAt - slot.startsAt),
        '-filter_complex', `[1:v]scale=${badgeWidth}:${badgeHeight}:force_original_aspect_ratio=decrease[badge];[0:v][badge]overlay=W-w-24:H-h-24:shortest=1[outv]`,
        '-map', '[outv]', ...(audio ? ['-map', '0:a:0?'] : []),
        ...encoderArgs, ...(audio ? ['-c:a', 'copy'] : []),
        '-avoid_negative_ts', 'make_zero', destination,
      ]);
      pieces.push(destination);
      cursor = slot.endsAt;
    }
    await copyPiece(cursor, duration);

    const concatList = path.join(tempDirectory, 'concat.txt');
    await writeFile(concatList, `${pieces.map((piece) => `file '${path.basename(piece)}'`).join('\n')}\n`);
    process.stdout.write('Joining all sections without re-encoding…\n');
    await run('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-map', '0', '-c', 'copy', outputPath,
    ]);
    process.stdout.write(`Finished: ${outputPath}\n`);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const scriptName = path.basename(fileURLToPath(import.meta.url));
  process.stderr.write(`${scriptName}: ${error.message}\n`);
  process.exitCode = 1;
});
