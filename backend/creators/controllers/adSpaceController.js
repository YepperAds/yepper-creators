'use strict';

const jwt    = require('jsonwebtoken');
const multer = require('multer');
const { query }  = require('../../config/db');
const cloudinary  = require('../../config/storage');
const { AD_FORMATS, AD_TYPES, AD_SIZES } = require('../utils/adOverlay');
const { getYoutubeTierPricing } = require('../utils/youtubeTierPricing');
const sendEmailNotification = require('../../controllers/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const JWT_SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return process.env.JWT_SECRET;
};

// Creators and advertisers share the same yepper_session JWT cookie — this
// just returns whatever userId is in it; callers decide what kind of account
// that id is expected to belong to. Cross-origin requests (e.g. the claim
// image upload, which bypasses the size-limited Vercel proxy) carry the same
// JWT as an Authorization: Bearer header instead, since the SameSite=Lax
// cookie set at login never reaches this backend's own domain.
function getSessionUserId(req) {
  const authHeader = req.headers?.authorization;
  const val = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) || req.cookies?.yepper_session;
  if (!val) return null;
  try {
    const decoded = jwt.verify(val, JWT_SECRET());
    return decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}
exports.getSessionUserId = getSessionUserId;

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
exports.uploadCreativeToCloudinary = uploadCreativeToCloudinary;
exports.SLOT_TYPES = SLOT_TYPES;
exports.SLOT_LABELS = SLOT_LABELS;

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

    const subsRes = await query(
      `SELECT followers_count FROM social_connections WHERE creator_id = $1 AND provider = 'youtube' LIMIT 1`,
      [creatorId],
    );
    const subscribers = Number(subsRes.rows[0]?.followers_count || 0);
    const { tier, rows: pricingRows } = getYoutubeTierPricing(subscribers);

    return res.json({
      success: true,
      data: {
        adType,
        adTypeLabel: AD_FORMATS[adType]?.label,
        adTypeDescription: AD_FORMATS[adType]?.description,
        slots,
        tier,
        pricingRows,
      },
    });
  } catch (err) {
    console.error('[adSpaces] getAdSpaces error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load ad spaces' });
  }
};

// POST /api/social/youtube/ad-spaces/send-invite — the logged-in creator
// emails a chosen recipient a direct link into claiming an ad slot on their
// own channel. Mirrors adminSendDealEmail's link-deep-link pattern: clicking
// it lands the recipient on the dashboard's advertise panel with this
// creator's "Collaborate" modal already open (see AdvertiseBrowser.tsx's
// `creatorId` query param), logging in first via /login?from= if needed.
exports.sendAdSpaceInvite = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false, message: 'Log in to send an invite' });

  const { email } = req.body;
  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: 'Recipient email is required' });
  }

  try {
    const creatorRes = await query(
      `SELECT c.full_name, sc.username AS channel_name
       FROM creators c
       LEFT JOIN social_connections sc ON sc.creator_id = c.id AND sc.provider = 'youtube'
       WHERE c.id = $1`,
      [creatorId],
    );
    if (!creatorRes.rowCount) return res.status(404).json({ success: false, message: 'Creator not found' });
    const channelName = creatorRes.rows[0].channel_name || creatorRes.rows[0].full_name || 'this channel';

    const target = `/?panel=advertise&creatorId=${creatorId}`;
    const link = `${FRONTEND_URL}/login?from=${encodeURIComponent(target)}`;
    const subject = `Advertise on ${channelName}`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;"><tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 2px 20px rgba(0,0,0,0.08);overflow:hidden;">
            <tr><td style="background:#000;padding:28px 40px;"><h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Yepper</h1></td></tr>
            <tr><td style="padding:40px;">
              <p style="color:#333;font-size:19px;margin:0 0 16px 0;font-weight:700;">${subject}</p>
              <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
                A YouTube ad slot is open on ${channelName}. Claim it to run your ad in one of their videos.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="center" style="padding:0 0 32px 0;">
                  <a href="${link}" style="display:inline-block;background:#000;color:#fff;padding:16px 36px;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">
                    Advertise on ${channelName} →
                  </a>
                </td></tr>
              </table>
              <p style="color:#999;font-size:13px;line-height:1.5;margin:0;">
                Clicking the button takes you straight there — log in (or create an account) and you'll land right back here to claim a slot.
              </p>
            </td></tr>
            <tr><td style="background:#fafafa;border-top:1px solid #eee;padding:20px 40px;">
              <p style="color:#bbb;font-size:12px;margin:0;text-align:center;">
                © ${new Date().getFullYear()} Yepper · <a href="${FRONTEND_URL}/privacy-policy" style="color:#bbb;">Privacy Policy</a>
              </p>
            </td></tr>
          </table>
        </td></tr></table>
      </body></html>`;

    const result = await sendEmailNotification(String(email).trim(), subject, html);
    if (result && result.skipped) {
      return res.status(503).json({ success: false, message: 'Email sending is not configured on this server' });
    }
    return res.json({ success: true, message: 'Email sent' });
  } catch (err) {
    console.error('[adSpaces] sendAdSpaceInvite error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send email' });
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

// Claiming a slot now requires payment — see
// youtubeClaimPaymentController.initiateClaimPayment (POST .../claim/initiate),
// which prices the claim from the creator's subscriber tier, charges the
// advertiser, and only then inserts the youtube_ad_claims row.

// GET /api/social/ad-claims/pending — the logged-in creator's own pending,
// PAID claims, used by the upload modal to offer real advertiser creatives.
// Unpaid claims (still mid-checkout) aren't offered yet.
exports.getPendingClaims = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false });
  try {
    const result = await query(
      `SELECT id, slot_type, image_url, ad_type, ad_size, created_at FROM youtube_ad_claims WHERE creator_id = $1 AND status = 'pending' AND payment_status = 'paid'`,
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
