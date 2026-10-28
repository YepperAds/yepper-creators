'use strict';

const {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  CreateJobCommand,
  DescribeEndpointsCommand,
  GetJobCommand,
  MediaConvertClient,
} = require('@aws-sdk/client-mediaconvert');
const sharp = require('sharp');
const { AD_FORMATS } = require('./adOverlay');
const { AD_WINDOW_SEC, getAdSlots } = require('./videoAdInjector');

const MULTIPART_PART_SIZE = 32 * 1024 * 1024;
const MAX_PARTS = 10000;
const s3Clients = new Map();
const mediaConvertClients = new Map();
const endpoints = new Map();

function getAwsVideoConfig() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  const bucket = process.env.AWS_S3_VIDEO_BUCKET;
  const roleArn = process.env.AWS_MEDIACONVERT_ROLE_ARN;
  const missing = [
    !region && 'AWS_REGION',
    !bucket && 'AWS_S3_VIDEO_BUCKET',
    !roleArn && 'AWS_MEDIACONVERT_ROLE_ARN',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`AWS long-video processing is not configured; missing ${missing.join(', ')}`);
  }
  return { region, bucket, roleArn };
}

function getS3Client(region) {
  if (!s3Clients.has(region)) s3Clients.set(region, new S3Client({ region }));
  return s3Clients.get(region);
}

async function getMediaConvertClient(region) {
  if (mediaConvertClients.has(region)) return mediaConvertClients.get(region);

  let endpoint = process.env.AWS_MEDIACONVERT_ENDPOINT;
  if (!endpoint) {
    if (!endpoints.has(region)) {
      const discoveryClient = new MediaConvertClient({ region });
      const response = await discoveryClient.send(new DescribeEndpointsCommand({ MaxResults: 1 }));
      const discovered = response.Endpoints?.[0]?.Url;
      if (!discovered) throw new Error('AWS MediaConvert did not return a regional API endpoint');
      endpoints.set(region, discovered);
      discoveryClient.destroy();
    }
    endpoint = endpoints.get(region);
  }

  const client = new MediaConvertClient({ region, endpoint });
  mediaConvertClients.set(region, client);
  return client;
}

function getObjectUrl(bucket, key) {
  return `s3://${bucket}/${key}`;
}

function makeMultipartKey(creatorId, jobId, filename) {
  const extension = filename.toLowerCase().match(/\.(mp4|mov|m4v|mkv|webm)$/)?.[0] || '.mp4';
  return `yepper/ad-video-inputs/${creatorId}/${jobId}/source${extension}`;
}

function getMultipartPartCount(fileSize) {
  return Math.ceil(fileSize / MULTIPART_PART_SIZE);
}

function normalizeMediaConvertPriority(priority) {
  const parsedPriority = Number(priority);
  if (!Number.isFinite(parsedPriority)) return 0;
  return Math.max(0, Math.min(10, Math.trunc(parsedPriority)));
}

async function createVideoMultipartUpload({ creatorId, jobId, filename, contentType }) {
  const { region, bucket } = getAwsVideoConfig();
  const key = makeMultipartKey(creatorId, jobId, filename);
  const result = await getS3Client(region).send(new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || 'video/mp4',
    Metadata: { creatorid: String(creatorId), jobid: String(jobId) },
  }));
  if (!result.UploadId) throw new Error('S3 did not return a multipart upload ID');
  return { bucket, key, uploadId: result.UploadId, partSize: MULTIPART_PART_SIZE };
}

async function createPartUploadUrl({ bucket, key, uploadId, partNumber }) {
  const { region } = getAwsVideoConfig();
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PARTS) {
    throw new Error(`Multipart part number must be between 1 and ${MAX_PARTS}`);
  }
  return getSignedUrl(getS3Client(region), new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  }), { expiresIn: 3600 });
}

async function completeVideoMultipartUpload({ bucket, key, uploadId, parts }) {
  const { region } = getAwsVideoConfig();
  if (!Array.isArray(parts) || !parts.length || parts.length > MAX_PARTS) {
    throw new Error('Multipart upload has an invalid parts list');
  }
  const sortedParts = [...parts]
    .map((part) => ({ ETag: part.ETag, PartNumber: Number(part.PartNumber) }))
    .sort((a, b) => a.PartNumber - b.PartNumber);
  if (sortedParts.some((part, index) => !part.ETag || part.PartNumber !== index + 1)) {
    throw new Error('Multipart upload parts must have consecutive numbers and ETags');
  }
  await getS3Client(region).send(new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: sortedParts },
  }));
}

async function getCompletedVideoSize({ bucket, key }) {
  const { region } = getAwsVideoConfig();
  const result = await getS3Client(region).send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return result.ContentLength;
}

async function abortVideoMultipartUpload({ bucket, key, uploadId }) {
  const { region } = getAwsVideoConfig();
  await getS3Client(region).send(new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  }));
}

async function uploadPngOverlay({ bucket, key, imageUrl, width }) {
  const url = new URL(imageUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('Ad creative must be stored on the trusted Cloudinary image host');
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Could not fetch ad creative (HTTP ${response.status})`);
  const maxImageSize = 20 * 1024 * 1024;
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxImageSize) {
    throw new Error('Ad creative exceeds the 20 MiB limit');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Ad creative response had no readable body');
  const chunks = [];
  let sourceSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sourceSize += value.byteLength;
    if (sourceSize > maxImageSize) {
      await reader.cancel();
      throw new Error('Ad creative exceeds the 20 MiB limit');
    }
    chunks.push(Buffer.from(value));
  }
  const source = Buffer.concat(chunks, sourceSize);

  const pipeline = sharp(source, { limitInputPixels: 40_000_000 });
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Ad creative has invalid image dimensions');
  const overlay = await pipeline
    .resize({ width: Math.max(1, Math.round(width)), withoutEnlargement: true })
    .png()
    .toBuffer();
  const { region } = getAwsVideoConfig();
  await getS3Client(region).send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: overlay,
    ContentType: 'image/png',
  }));
  const overlayMetadata = await sharp(overlay).metadata();
  return { key, width: overlayMetadata.width, height: overlayMetadata.height };
}

async function buildMediaConvertInsertableImages({ claims, duration, width, height, bucket, creatorId, jobId }) {
  const overlays = [];
  const slots = getAdSlots(duration)
    .map((slot) => ({ ...slot, claim: claims.find((claim) => claim.slotType === slot.key) }))
    .filter((slot) => slot.claim && slot.time < duration)
    .sort((a, b) => a.time - b.time);
  if (!slots.length) throw new Error('Selected ad claims do not match any available slot in this video');

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const format = AD_FORMATS[slot.claim.adType] || AD_FORMATS.corner;
    const sizes = format.sizes[slot.claim.adSize] || format.sizes.medium;
    const startMilliseconds = Math.round(slot.time * 1000);
    const durationMilliseconds = Math.round(Math.min(AD_WINDOW_SEC, duration - slot.time) * 1000);
    const common = {
      Duration: durationMilliseconds,
      FadeIn: 0,
      FadeOut: 0,
      Opacity: 100,
      StartTime: `${String(Math.floor(startMilliseconds / 3_600_000)).padStart(2, '0')}:${String(Math.floor(startMilliseconds / 60_000) % 60).padStart(2, '0')}:${String(Math.floor(startMilliseconds / 1000) % 60).padStart(2, '0')}:00`,
      Layer: index,
    };

    if (slot.claim.adType === 'lbar') {
      const vertical = await uploadPngOverlay({
        bucket,
        key: `yepper/ad-video-overlays/${creatorId}/${jobId}/overlay-${index}-vertical.png`,
        imageUrl: slot.claim.imageUrl,
        width: width * sizes.vRatio,
      });
      overlays.push({
        ...common,
        ImageInserterInput: getObjectUrl(bucket, vertical.key),
        ImageX: 0,
        ImageY: Math.max(0, Math.round((height - vertical.height) / 2)),
        Width: vertical.width,
        Height: vertical.height,
      });

      const horizontal = await uploadPngOverlay({
        bucket,
        key: `yepper/ad-video-overlays/${creatorId}/${jobId}/overlay-${index}-horizontal.png`,
        imageUrl: slot.claim.imageUrl,
        width: width * sizes.hRatio,
      });
      overlays.push({
        ...common,
        Layer: index + slots.length,
        ImageInserterInput: getObjectUrl(bucket, horizontal.key),
        ImageX: Math.max(0, Math.round((width - horizontal.width) / 2)),
        ImageY: Math.max(0, height - horizontal.height),
        Width: horizontal.width,
        Height: horizontal.height,
      });
    } else {
      const corner = await uploadPngOverlay({
        bucket,
        key: `yepper/ad-video-overlays/${creatorId}/${jobId}/overlay-${index}.png`,
        imageUrl: slot.claim.imageUrl,
        width: width * sizes.ratio,
      });
      overlays.push({
        ...common,
        ImageInserterInput: getObjectUrl(bucket, corner.key),
        ImageX: Math.max(0, width - corner.width - 20),
        ImageY: Math.max(0, height - corner.height - 20),
        Width: corner.width,
        Height: corner.height,
      });
    }
  }

  return {
    overlays,
    placements: slots.map((slot) => ({
      slotType: slot.key,
      startsAt: slot.time,
      endsAt: Math.min(duration, slot.time + AD_WINDOW_SEC),
    })),
  };
}

function buildMediaConvertSettings({ bucket, inputKey, outputPrefix, overlays }) {
  return {
    TimecodeConfig: { Source: 'ZEROBASED' },
    Inputs: [{
      FileInput: getObjectUrl(bucket, inputKey),
      AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } },
      VideoSelector: { TimecodeSource: 'ZEROBASED' },
    }],
    OutputGroups: [{
      Name: 'MP4',
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: { Destination: `${getObjectUrl(bucket, outputPrefix)}/` },
      },
      Outputs: [{
        NameModifier: '-yepper-ad',
        ContainerSettings: {
          Container: 'MP4',
          Mp4Settings: { MoovPlacement: 'PROGRESSIVE_DOWNLOAD' },
        },
        VideoDescription: {
          Width: 1920,
          Height: 1080,
          ScalingBehavior: 'DEFAULT',
          VideoPreprocessors: { ImageInserter: { InsertableImages: overlays } },
          CodecSettings: {
            Codec: 'H_264',
            H264Settings: {
              RateControlMode: 'QVBR',
              QvbrSettings: { QvbrQualityLevel: 9 },
              MaxBitrate: 20_000_000,
              QualityTuningLevel: 'SINGLE_PASS',
              FramerateControl: 'SPECIFIED',
              FramerateNumerator: 30,
              FramerateDenominator: 1,
              GopSize: 2,
              GopSizeUnits: 'SECONDS',
              CodecProfile: 'HIGH',
              CodecLevel: 'AUTO',
            },
          },
        },
        AudioDescriptions: [{
          AudioSourceName: 'Audio Selector 1',
          CodecSettings: {
            Codec: 'AAC',
            AacSettings: {
              Bitrate: 192000,
              CodingMode: 'CODING_MODE_2_0',
              SampleRate: 48000,
            },
          },
        }],
      }],
    }],
  };
}

async function submitMediaConvertJob({ roleArn, settings, jobId, priority = 0 }) {
  const { region } = getAwsVideoConfig();
  const client = await getMediaConvertClient(region);
  const response = await client.send(new CreateJobCommand({
    Role: roleArn,
    Priority: normalizeMediaConvertPriority(priority),
    UserMetadata: { yepperJobId: String(jobId) },
    Settings: settings,
    StatusUpdateInterval: 'SECONDS_60',
  }));
  if (!response.Job?.Id) throw new Error('AWS MediaConvert did not return a job ID');
  return response.Job.Id;
}

async function getMediaConvertJob(jobId) {
  const { region } = getAwsVideoConfig();
  const client = await getMediaConvertClient(region);
  const response = await client.send(new GetJobCommand({ Id: jobId }));
  if (!response.Job) throw new Error(`AWS MediaConvert job ${jobId} was not found`);
  return response.Job;
}

async function createOutputDownloadUrl({ bucket, key, filename = 'yepper-ad-video.mp4' }) {
  const { region } = getAwsVideoConfig();
  return getSignedUrl(getS3Client(region), new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename.replace(/["\\]/g, '')}"`,
  }), { expiresIn: 900 });
}

module.exports = {
  MULTIPART_PART_SIZE,
  abortVideoMultipartUpload,
  buildMediaConvertInsertableImages,
  buildMediaConvertSettings,
  completeVideoMultipartUpload,
  createOutputDownloadUrl,
  createPartUploadUrl,
  createVideoMultipartUpload,
  getAwsVideoConfig,
  getCompletedVideoSize,
  getMediaConvertJob,
  getMultipartPartCount,
  normalizeMediaConvertPriority,
  submitMediaConvertJob,
};
