'use strict';

const cloudinary = require('../config/storage');

// Accepts either a plain URL (passed through as-is) or a base64 data URL,
// which gets uploaded to Cloudinary and turned into a real URL. Shared by
// the owner-facing and admin/prospect website creation flows so both store
// logos the same way.
async function resolveImageUrl(rawUrl) {
  if (!rawUrl) return '';
  if (!rawUrl.startsWith('data:')) return rawUrl;
  const fileName = `website-icon-${Date.now()}`;
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', folder: 'yepper_websites', public_id: fileName },
      (error, result) => {
        if (error) return reject(new Error(`Cloudinary: ${error.message}`));
        resolve(result.secure_url);
      }
    );
    const base64Data = rawUrl.replace(/^data:image\/\w+;base64,/, '');
    uploadStream.end(Buffer.from(base64Data, 'base64'));
  });
}

module.exports = { resolveImageUrl };
