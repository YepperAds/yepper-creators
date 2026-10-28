import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';

const BADGE_SECONDS = 15;
const MAX_BADGE_FETCH_BYTES = 20 * 1024 * 1024;
const ENCODER_BY_CODEC: Record<string, string> = {
  h264: 'libx264',
  hevc: 'libx265',
  vp8: 'libvpx',
  vp9: 'libvpx-vp9',
  mpeg4: 'mpeg4',
  av1: 'libaom-av1',
  mpeg2video: 'mpeg2video',
};

export interface BrowserAdClaim {
  slotType: string;
  imageUrl: string;
}

export interface BrowserAdPlacement {
  slotType: string;
  startsAt: number;
  endsAt: number;
}

export interface BrowserProcessingProgress {
  percent: number;
  message: string;
}

interface SourceVideo {
  codec: string;
  profile: string | null;
  pixelFormat: string | null;
  frameRate: number;
  bitrate: number | null;
}

function getCodecSettings(logs: string[]): SourceVideo {
  const videoLine = logs.find((line) => /Video:/i.test(line));
  if (!videoLine) throw new Error('FFmpeg could not find a video stream in this file.');

  const codec = videoLine.match(/Video:\s*([a-z0-9_]+)/i)?.[1]?.toLowerCase();
  const profile = videoLine.match(/Video:\s*[^,(]+\(([^)]+)\)/i)?.[1]?.trim() ?? null;
  const pixelFormat = videoLine.match(/,\s*([a-z0-9_]+)(?:\([^)]*\))?,\s*\d{2,5}x\d{2,5}/i)?.[1] ?? null;
  const frameRate = Number(videoLine.match(/([\d.]+)\s+fps/i)?.[1]);
  const bitrateKbps = Number(videoLine.match(/([\d.]+)\s*kb\/s/i)?.[1]);

  if (!codec || !Number.isFinite(frameRate) || frameRate <= 0) {
    throw new Error('FFmpeg could not identify the source video codec and frame rate.');
  }
  return {
    codec,
    profile,
    pixelFormat,
    frameRate,
    bitrate: Number.isFinite(bitrateKbps) && bitrateKbps > 0 ? Math.round(bitrateKbps * 1000) : null,
  };
}

function formatTime(seconds: number): string {
  return seconds.toFixed(3);
}

function getSafeProfile(profile: string | null): string | null {
  if (!profile) return null;
  const normalized = profile.toLowerCase();
  if (normalized.includes('baseline')) return 'baseline';
  if (normalized === 'main') return 'main';
  if (normalized === 'high') return 'high';
  if (normalized.includes('high 10')) return 'high10';
  if (normalized.includes('high 4:2:2')) return 'high422';
  if (normalized.includes('high 4:4:4')) return 'high444';
  return null;
}

function assertTrustedBadgeUrl(imageUrl: string): URL {
  const url = new URL(imageUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('Ad image must use a secure Cloudinary URL.');
  }
  return url;
}

async function fetchBadge(imageUrl: string): Promise<Uint8Array> {
  const response = await fetch(assertTrustedBadgeUrl(imageUrl), {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Could not load an ad image (HTTP ${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > MAX_BADGE_FETCH_BYTES) {
    throw new Error('An ad image is empty or larger than the 20 MiB safety limit.');
  }
  return new Uint8Array(buffer);
}

function buildEncoderArgs(video: SourceVideo, encoder: string): string[] {
  const args = ['-c:v', encoder, '-threads', '1'];
  const profile = video.codec === 'h264' ? getSafeProfile(video.profile) : null;
  if (profile) args.push('-profile:v', profile);
  if (video.pixelFormat) args.push('-pix_fmt', video.pixelFormat);
  args.push('-r', String(video.frameRate));
  if (video.bitrate) args.push('-b:v', String(video.bitrate));
  return args;
}

function buildOverlayFilter(width: number, height: number): string {
  const badgeWidth = Math.max(32, Math.round(width * 0.2));
  const badgeHeight = Math.max(32, Math.round(height * 0.2));
  return `[1:v]scale=${badgeWidth}:${badgeHeight}:force_original_aspect_ratio=decrease[badge];`
    + '[0:v][badge]overlay=W-w-24:H-h-24:shortest=1[outv]';
}

async function runCommand(
  ffmpeg: FFmpeg,
  args: string[],
  onProgress: (progress: number) => void,
): Promise<void> {
  const handleProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) onProgress(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on('progress', handleProgress);
  try {
    const exitCode = await ffmpeg.exec(args);
    onProgress(1);
    if (exitCode !== 0) throw new Error('FFmpeg could not process a video segment.');
  } finally {
    ffmpeg.off('progress', handleProgress);
  }
}

export async function processVideoLocally({
  file,
  duration,
  width,
  height,
  claims,
  onProgress,
}: {
  file: File;
  duration: number;
  width: number;
  height: number;
  claims: BrowserAdClaim[];
  onProgress: (progress: BrowserProcessingProgress) => void;
}): Promise<{ blob: Blob; filename: string; placements: BrowserAdPlacement[] }> {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video duration is invalid.');
  if (!claims.length) throw new Error('Select at least one paid ad slot before processing this video.');

  const sortedClaims = [...claims].sort((a, b) => {
    const percentA = Number(a.slotType.replace('pct', ''));
    const percentB = Number(b.slotType.replace('pct', ''));
    return percentA - percentB;
  });
  const placements = sortedClaims.map((claim) => {
    const percent = Number(claim.slotType.replace('pct', ''));
    if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
      throw new Error(`The ad slot "${claim.slotType}" has an invalid percentage.`);
    }
    const startsAt = duration * percent / 100;
    return {
      slotType: claim.slotType,
      startsAt,
      endsAt: Math.min(duration, startsAt + BADGE_SECONDS),
      imageUrl: claim.imageUrl,
    };
  });
  for (let index = 1; index < placements.length; index += 1) {
    if (placements[index].startsAt < placements[index - 1].endsAt) {
      throw new Error('Selected ad slots overlap. Choose fewer slots or use a longer video.');
    }
  }

  const ffmpeg = new FFmpeg();
  const logs: string[] = [];
  const onLog = ({ message }: { message: string }) => logs.push(message);
  ffmpeg.on('log', onLog);
  let mounted = false;
  try {
    onProgress({ percent: 2, message: 'Loading browser video processor…' });
    await ffmpeg.load({
      coreURL: new URL('/ffmpeg/ffmpeg-core.js', window.location.origin).href,
      wasmURL: new URL('/ffmpeg/ffmpeg-core.wasm', window.location.origin).href,
    });

    await ffmpeg.createDir('/input');
    await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, '/input');
    mounted = true;
    const inputPath = `/input/${file.name}`;

    onProgress({ percent: 5, message: 'Checking source video codec…' });
    logs.length = 0;
    await ffmpeg.exec(['-hide_banner', '-i', inputPath, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-']);
    const sourceVideo = getCodecSettings(logs);
    const encoder = ENCODER_BY_CODEC[sourceVideo.codec];
    if (!encoder) {
      throw new Error(`Browser processing does not support the source codec "${sourceVideo.codec}". Use the local FFmpeg helper.`);
    }

    logs.length = 0;
    await ffmpeg.exec(['-hide_banner', '-encoders']);
    if (!logs.join('\n').includes(encoder)) {
      throw new Error(`The browser FFmpeg build cannot encode "${sourceVideo.codec}". Use the local FFmpeg helper.`);
    }

    const pieces: string[] = [];
    let cursor = 0;
    const totalPieces = placements.length * 2 + 1;
    let pieceIndex = 0;
    const reportPiece = (message: string) => {
      const startPercent = 8 + Math.round((pieceIndex / totalPieces) * 84);
      const piecePercent = 84 / totalPieces;
      onProgress({ percent: startPercent, message });
      return (progress: number) => {
        onProgress({
          percent: Math.min(92, startPercent + Math.round(piecePercent * progress)),
          message,
        });
      };
    };

    for (let index = 0; index < placements.length; index += 1) {
      const placement = placements[index];
      const imagePath = `/badge-${index}.png`;
      onProgress({ percent: 7, message: `Loading ad image for ${placement.slotType}…` });
      await ffmpeg.writeFile(imagePath, await fetchBadge(placement.imageUrl));

      if (placement.startsAt > cursor) {
        const segmentPath = `/piece-${String(pieces.length).padStart(3, '0')}.mkv`;
        const updateProgress = reportPiece(`Copying untouched video part ${pieceIndex + 1} of ${totalPieces}…`);
        await runCommand(ffmpeg, [
          '-ss', formatTime(cursor), '-i', inputPath,
          '-t', formatTime(placement.startsAt - cursor),
          '-map', '0:v:0', '-map', '0:a?',
          '-c', 'copy', '-avoid_negative_ts', 'make_zero',
          segmentPath,
        ], updateProgress);
        pieces.push(segmentPath);
        pieceIndex += 1;
      }

      const badgeDuration = placement.endsAt - placement.startsAt;
      const segmentPath = `/piece-${String(pieces.length).padStart(3, '0')}.mkv`;
      const updateProgress = reportPiece(`Rendering ${placement.slotType} badge segment ${pieceIndex + 1} of ${totalPieces}…`);
      await runCommand(ffmpeg, [
        '-ss', formatTime(placement.startsAt), '-i', inputPath,
        '-loop', '1', '-framerate', String(sourceVideo.frameRate), '-i', imagePath,
        '-t', formatTime(badgeDuration),
        '-filter_complex', buildOverlayFilter(width, height),
        '-map', '[outv]', '-map', '0:a?',
        ...buildEncoderArgs(sourceVideo, encoder),
        '-c:a', 'copy', '-avoid_negative_ts', 'make_zero',
        segmentPath,
      ], updateProgress);
      pieces.push(segmentPath);
      cursor = placement.endsAt;
      pieceIndex += 1;
      await ffmpeg.deleteFile(imagePath);
    }

    if (cursor < duration) {
      const segmentPath = `/piece-${String(pieces.length).padStart(3, '0')}.mkv`;
      const updateProgress = reportPiece(`Copying final untouched video part ${pieceIndex + 1} of ${totalPieces}…`);
      await runCommand(ffmpeg, [
        '-ss', formatTime(cursor), '-i', inputPath,
        '-t', formatTime(duration - cursor),
        '-map', '0:v:0', '-map', '0:a?',
        '-c', 'copy', '-avoid_negative_ts', 'make_zero',
        segmentPath,
      ], updateProgress);
      pieces.push(segmentPath);
    }

    const concatList = pieces.map((piece) => `file '${piece.slice(1)}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));
    onProgress({ percent: 94, message: 'Joining video and audio segments…' });
    const filename = `${file.name.replace(/\.[^.]+$/, '')}-with-ads.mkv`;
    const outputPath = '/processed-video.mkv';
    await runCommand(ffmpeg, [
      '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-map', '0',
      '-c', 'copy', outputPath,
    ], (progress) => onProgress({
      percent: 94 + Math.round(progress * 6),
      message: 'Joining video and audio segments…',
    }));
    const outputData = await ffmpeg.readFile(outputPath);
    if (typeof outputData === 'string') throw new Error('FFmpeg returned an invalid output file.');
    const blob = new Blob([new Uint8Array(outputData).buffer], { type: 'video/x-matroska' });
    onProgress({ percent: 100, message: 'Video is ready to download.' });
    return {
      blob,
      filename,
      placements: placements.map(({ slotType, startsAt, endsAt }) => ({ slotType, startsAt, endsAt })),
    };
  } finally {
    ffmpeg.off('log', onLog);
    if (mounted) await ffmpeg.unmount('/input').catch(() => {});
    ffmpeg.terminate();
  }
}
