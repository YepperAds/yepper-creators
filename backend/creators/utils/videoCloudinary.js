'use strict';

const cloudinary = require('cloudinary').v2;
const { AD_FORMATS } = require('./adOverlay');
const { AD_WINDOW_SEC, getAdSlots } = require('./videoAdInjector');

function getVideoCloudinary() {
  const config = {
    cloud_name: process.env.VID_CLOUDINARY_NAME,
    api_key: process.env.VID_CLOUDINARY_KEY,
    api_secret: process.env.VID_CLOUDINARY_API_SECRET,
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) {
    throw new Error(`Video Cloudinary is not configured; missing ${missing.join(', ')}`);
  }

  return { client: cloudinary, config };
}

function buildVideoTransformations({ activeSlots, duration, sourceWidth }) {
  const transformations = [];

  for (const slot of activeSlots) {
    const format = AD_FORMATS[slot.claim.adType] || AD_FORMATS.corner;
    const sizes = format.sizes[slot.claim.adSize] || format.sizes.medium;
    const start = Number(slot.time.toFixed(3));
    const windowLength = Number(Math.min(AD_WINDOW_SEC, duration - slot.time).toFixed(3));
    const imageId = `authenticated:${slot.imagePublicId.replace(/\//g, ':')}`;

    if (slot.claim.adType === 'lbar') {
      transformations.push(
        { overlay: imageId },
        { width: Math.max(1, Math.round(sourceWidth * sizes.vRatio)), crop: 'scale' },
        { start_offset: String(start), duration: String(windowLength), gravity: 'west', flags: 'layer_apply' },
        { overlay: imageId },
        { width: Math.max(1, Math.round(sourceWidth * sizes.hRatio)), crop: 'scale' },
        { start_offset: String(start), duration: String(windowLength), gravity: 'south', flags: 'layer_apply' },
      );
      continue;
    }

    transformations.push(
      { overlay: imageId },
      { width: Math.max(1, Math.round(sourceWidth * sizes.ratio)), crop: 'scale' },
      {
        start_offset: String(start),
        duration: String(windowLength),
        gravity: 'south_east',
        x: 20,
        y: 20,
        flags: 'layer_apply',
      },
    );
  }

  return transformations;
}

async function uploadVideoCreative(videoCloudinary, config, imageUrl, publicId) {
  const result = await videoCloudinary.uploader.upload(imageUrl, {
    ...config,
    resource_type: 'image',
    type: 'authenticated',
    public_id: publicId,
    overwrite: true,
  });
  if (!result.public_id || !result.width) {
    throw new Error('Cloudinary did not return valid metadata for the ad creative');
  }
  return result;
}

async function renderVideoWithCloudinary({ srcPath, jobId, claims, onProgress }) {
  const { client: videoCloudinary, config } = getVideoCloudinary();
  let source;
  const uploadedCreatives = [];

  try {
    onProgress(42, 'Uploading video to the dedicated video processor…');
    source = await videoCloudinary.uploader.upload_large(srcPath, {
      ...config,
      resource_type: 'video',
      type: 'authenticated',
      public_id: `yepper/jobs/${jobId}/source`,
      overwrite: true,
      chunk_size: 20 * 1024 * 1024,
    });
    if (!source.public_id || !source.width || !source.duration) {
      throw new Error('Video processor did not return valid source-video metadata');
    }

    const activeSlots = getAdSlots(source.duration)
      .map((slot) => ({ ...slot, claim: claims.find((claim) => claim.slotType === slot.key) }))
      .filter((slot) => slot.claim && slot.time < source.duration)
      .sort((a, b) => a.time - b.time);
    if (!activeSlots.length) {
      throw new Error('Selected ad claims do not match any available slot in this video');
    }

    onProgress(55, 'Preparing ad creative(s)…');
    for (let index = 0; index < activeSlots.length; index += 1) {
      const slot = activeSlots[index];
      const creative = await uploadVideoCreative(
        videoCloudinary,
        config,
        slot.claim.imageUrl,
        `yepper/jobs/${jobId}/creative-${index}`,
      );
      slot.imagePublicId = creative.public_id;
      uploadedCreatives.push(creative.public_id);
    }

    const transformations = buildVideoTransformations({
      activeSlots,
      duration: source.duration,
      sourceWidth: source.width,
    });
    const transformationString = videoCloudinary.utils.generate_transformation_string(transformations);
    onProgress(65, 'Rendering the ad-injected video in Cloudinary…');

    const rendered = await videoCloudinary.uploader.explicit(source.public_id, {
      ...config,
      resource_type: 'video',
      type: 'authenticated',
      eager: [{ transformation: transformationString, format: 'mp4' }],
      eager_async: false,
    });
    const completedRender = rendered.eager?.find((item) => item.status === 'complete' || item.secure_url);
    if (!completedRender) {
      throw new Error('Cloudinary did not finish rendering the ad-injected video');
    }

    const outputUrl = videoCloudinary.url(source.public_id, {
      ...config,
      resource_type: 'video',
      type: 'authenticated',
      secure: true,
      sign_url: true,
      format: 'mp4',
      transformation: transformationString,
    });

    return {
      outputUrl,
      duration: source.duration,
      placements: activeSlots.map((slot) => ({
        slotType: slot.key,
        startsAt: slot.time,
        endsAt: Math.min(source.duration, slot.time + AD_WINDOW_SEC),
      })),
    };
  } catch (error) {
    const assets = [
      ...uploadedCreatives.map((publicId) => ({ publicId, resource_type: 'image' })),
      ...(source?.public_id ? [{ publicId: source.public_id, resource_type: 'video' }] : []),
    ];
    await Promise.all(assets.map(async ({ publicId, resource_type }) => {
      try {
        await videoCloudinary.uploader.destroy(publicId, {
          ...config,
          resource_type,
          type: 'authenticated',
          invalidate: true,
        });
      } catch (cleanupError) {
        console.error(`[videoCloudinary] Failed to clean up asset ${publicId}:`, cleanupError.message);
      }
    }));
    throw error;
  }
}

module.exports = { buildVideoTransformations, getVideoCloudinary, renderVideoWithCloudinary };
