'use strict';

const jwt    = require('jsonwebtoken');
const multer = require('multer');
const { query }  = require('../../config/db');
const cloudinary  = require('../../config/storage');
const { AD_FORMATS, AD_TYPES, AD_SIZES } = require('../utils/adOverlay');

const JWT_SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return process.env.JWT_SECRET;
};

// Creators and advertisers share the same yepper_session JWT cookie — this
// just returns whatever userId is in it; callers decide what kind of account
// that id is expected to belong to.
function getSessionUserId(req) {
  const val = req.cookies?.yepper_session;
  if (!val) return null;
  try {
    const decoded = jwt.verify(val, JWT_SECRET());
    return decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}

const SLOT_TYPES  = ['intro', 'middle', 'end'];
const SLOT_LABELS = { intro: 'After intro (5:00)', middle: 'Middle', end: 'Near the end (80%)' };

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files allowed'))),
});

function uploadCreativeToCloudinary(file) {
  const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', folder: 'yepper_creator_ads', public_id: fileName },
      (err, result) => (err ? reject(err) : resolve(result.secure_url)),
    );
    stream.end(file.buffer);
  });
}

exports.imageUpload = imageUpload;
exports.SLOT_TYPES = SLOT_TYPES;

// GET /api/social/youtube/ad-formats — format/size catalog, with descriptions,
// so the claim UI doesn't have to hardcode any of this.
exports.getAdFormats = (req, res) => {
  const types = AD_TYPES.map((type) => ({
    type,
    label: AD_FORMATS[type].label,
    description: AD_FORMATS[type].description,
    sizes: AD_SIZES.filter((size) => AD_FORMATS[type].sizes[size]),
  }));
  return res.json({ success: true, data: { types } });
};

// GET /api/social/youtube/ad-spaces/:creatorId — public: shows each slot's
// open/claimed status, plus the creator's fixed ad format (chosen on their
// own dashboard — advertisers don't get to pick it). No other creative
// details leak to advertisers who didn't make the claim.
exports.getAdSpaces = async (req, res) => {
  const { creatorId } = req.params;
  try {
    const creatorRes = await query(`SELECT ad_type_preference FROM creators WHERE id = $1`, [creatorId]);
    if (!creatorRes.rowCount) return res.status(404).json({ success: false, message: 'Creator not found' });
    const adType = creatorRes.rows[0].ad_type_preference || 'corner';

    const claimed = await query(
      `SELECT slot_type FROM youtube_ad_claims WHERE creator_id = $1 AND status = 'pending'`,
      [creatorId],
    );
    const claimedSet = new Set(claimed.rows.map((r) => r.slot_type));
    const slots = SLOT_TYPES.map((slotType) => ({
      slotType,
      label: SLOT_LABELS[slotType],
      status: claimedSet.has(slotType) ? 'claimed' : 'open',
    }));
    return res.json({
      success: true,
      data: {
        adType,
        adTypeLabel: AD_FORMATS[adType]?.label,
        adTypeDescription: AD_FORMATS[adType]?.description,
        slots,
      },
    });
  } catch (err) {
    console.error('[adSpaces] getAdSpaces error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load ad spaces' });
  }
};

// GET /api/social/youtube/ad-type-preference — the logged-in creator's own
// current ad format choice.
exports.getAdTypePreference = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false });
  try {
    const result = await query(`SELECT ad_type_preference FROM creators WHERE id = $1`, [creatorId]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'Creator not found' });
    return res.json({ success: true, data: { adType: result.rows[0].ad_type_preference || 'corner' } });
  } catch (err) {
    console.error('[adSpaces] getAdTypePreference error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load ad type preference' });
  }
};

// POST /api/social/youtube/ad-type-preference — the creator sets ONE ad
// format for their whole channel; every future claim uses it.
exports.setAdTypePreference = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false });
  const { adType } = req.body;
  if (!AD_TYPES.includes(adType)) return res.status(400).json({ success: false, message: 'Invalid ad type' });
  try {
    await query(`UPDATE creators SET ad_type_preference = $1 WHERE id = $2`, [adType, creatorId]);
    return res.json({ success: true, data: { adType } });
  } catch (err) {
    console.error('[adSpaces] setAdTypePreference error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save ad type preference' });
  }
};

// POST /api/social/youtube/ad-spaces/:creatorId/claim — an advertiser claims
// an open slot by uploading their creative to it. The visual format (corner
// badge vs L-bar) is whatever the creator already set — advertisers only
// choose a size and upload the image.
exports.claimAdSpace = async (req, res) => {
  const advertiserId = getSessionUserId(req);
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Log in to claim an ad space' });

  const { creatorId } = req.params;
  const { slotType } = req.body;
  const adSize = AD_SIZES.includes(req.body.adSize) ? req.body.adSize : 'medium';
  if (!SLOT_TYPES.includes(slotType)) return res.status(400).json({ success: false, message: 'Invalid slot type' });
  if (!req.file) return res.status(400).json({ success: false, message: 'No ad image uploaded' });

  try {
    const creatorRes = await query(`SELECT ad_type_preference FROM creators WHERE id = $1`, [creatorId]);
    if (!creatorRes.rowCount) return res.status(404).json({ success: false, message: 'Creator not found' });
    const adType = creatorRes.rows[0].ad_type_preference || 'corner';

    const imageUrl = await uploadCreativeToCloudinary(req.file);

    await query(
      `INSERT INTO youtube_ad_claims (creator_id, advertiser_id, slot_type, image_url, ad_type, ad_size) VALUES ($1, $2, $3, $4, $5, $6)`,
      [creatorId, String(advertiserId), slotType, imageUrl, adType, adSize],
    );

    return res.json({ success: true, data: { slotType, imageUrl, adType, adSize } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'That ad space was just claimed by someone else' });
    console.error('[adSpaces] claimAdSpace error:', err);
    return res.status(500).json({ success: false, message: 'Failed to claim ad space' });
  }
};

// GET /api/social/ad-claims/pending — the logged-in creator's own pending
// claims, used by the upload modal to offer real advertiser creatives.
exports.getPendingClaims = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false });
  try {
    const result = await query(
      `SELECT id, slot_type, image_url, ad_type, ad_size, created_at FROM youtube_ad_claims WHERE creator_id = $1 AND status = 'pending'`,
      [creatorId],
    );
    return res.json({
      success: true,
      data: result.rows.map((r) => ({
        id: r.id, slotType: r.slot_type, imageUrl: r.image_url,
        adType: r.ad_type, adSize: r.ad_size, createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[adSpaces] getPendingClaims error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load pending claims' });
  }
};
