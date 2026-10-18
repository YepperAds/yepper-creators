'use strict';

const crypto = require('crypto');
const { query, getClient } = require('../../config/db');
const Creator = require('../models/Creator');
const Payment = require('../../AdOwner/models/PaymentModel');
const { Wallet } = require('../../AdPromoter/models/walletModel');
const {
  generateFlutterwavePaymentUrl,
  verifyFlutterwaveTransaction,
  upsertWallet,
  generateUniqueTransactionRef,
} = require('../../AdOwner/controllers/PaymentController');
const { priceFor } = require('../utils/youtubeTierPricing');
const { getSessionUserId } = require('./adSpaceController');
const { createNotification } = require('../utils/notificationUtils');

const CREATOR_SHARE = 0.70;
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

function safeUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function paymentMetadata(payment) {
  if (!payment?.metadata) return {};
  if (typeof payment.metadata === 'string') {
    try { return JSON.parse(payment.metadata); } catch { return {}; }
  }
  return payment.metadata;
}

function trackingUrl(token) {
  return `${FRONTEND_URL.replace(/\/+$/, '')}/tiktok/track/${token}`;
}

function extractTikTokVideoId(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== 'tiktok.com' && !hostname.endsWith('.tiktok.com')) return null;
    return parsed.pathname.match(/\/video\/(\d+)/)?.[1] || null;
  } catch {
    return null;
  }
}

async function getTikTokVideo(accessToken, videoId) {
  const url = new URL('https://open.tiktokapis.com/v2/video/query/');
  url.searchParams.set('fields', 'id,view_count,like_count,comment_count,share_count,create_time,share_url');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters: { video_ids: [videoId] } }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error?.code !== 'ok') {
    const error = new Error(payload?.error?.message || 'TikTok could not read this video. Reconnect TikTok with video.list access and try again.');
    error.status = 422;
    throw error;
  }
  return (payload?.data?.videos || []).find((video) => String(video.id) === String(videoId)) || null;
}

async function getCreatorTikTokToken(creatorId) {
  const connection = await query(
    `SELECT access_token, refresh_token, access_token_expires_at
     FROM social_connections WHERE creator_id = $1 AND provider = 'tiktok' LIMIT 1`,
    [creatorId],
  );
  const saved = connection.rows[0];
  if (!saved?.access_token) return null;
  if (!saved.refresh_token || (saved.access_token_expires_at && new Date(saved.access_token_expires_at).getTime() > Date.now() + 60_000)) {
    return saved.access_token;
  }
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: saved.refresh_token,
    }),
  });
  const tokenData = await response.json().catch(() => null);
  if (!response.ok || !tokenData?.access_token) return saved.access_token;
  await query(
    `UPDATE social_connections
     SET access_token = $1, refresh_token = COALESCE($2, refresh_token),
         access_token_expires_at = CASE WHEN $3::numeric > 0 THEN NOW() + ($3::text || ' seconds')::interval ELSE NULL END
     WHERE creator_id = $4 AND provider = 'tiktok'`,
    [tokenData.access_token, tokenData.refresh_token || null, Number(tokenData.expires_in || 0), creatorId],
  );
  return tokenData.access_token;
}

async function refreshVideoMetrics(sponsorship) {
  if (!sponsorship.tiktok_video_id) return sponsorship;
  if (sponsorship.last_stats_at && new Date(sponsorship.last_stats_at).getTime() > Date.now() - 15 * 60 * 1000) return sponsorship;
  const accessToken = await getCreatorTikTokToken(sponsorship.creator_id);
  if (!accessToken) return sponsorship;
  const video = await getTikTokVideo(accessToken, sponsorship.tiktok_video_id);
  if (!video) return sponsorship;
  const updated = await query(
    `UPDATE tiktok_sponsorships
     SET views = $1, likes = $2, comments = $3, last_stats_at = NOW(), updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [Number(video.view_count || 0), Number(video.like_count || 0), Number(video.comment_count || 0), sponsorship.id],
  );
  return updated.rows[0] || sponsorship;
}

exports.getQuote = async (req, res) => {
  if (!getSessionUserId(req)) return res.status(401).json({ success: false, message: 'Log in to view TikTok promotion pricing' });
  try {
    const creatorId = String(req.params.creatorId || '');
    const connection = await query(
      `SELECT followers_count, tiktok_profile FROM social_connections
       WHERE creator_id = $1 AND provider = 'tiktok' LIMIT 1`,
      [creatorId],
    );
    if (!connection.rowCount) return res.status(404).json({ success: false, message: 'TikTok account not found' });
    const profile = connection.rows[0].tiktok_profile || {};
    const monthlyCapacity = Number(profile.sponsoredPostsPerMonth || 0);
    const bookings = await query(
      `SELECT COUNT(*)::int AS count FROM tiktok_sponsorships
       WHERE creator_id = $1 AND payment_status = 'paid'
         AND status <> 'cancelled' AND created_at >= NOW() - INTERVAL '30 days'`,
      [creatorId],
    );
    const activeBooking = await query(
      `SELECT 1 FROM tiktok_sponsorships
       WHERE creator_id = $1 AND payment_status = 'paid'
         AND status IN ('pending_post', 'submitted')
         AND created_at >= NOW() - INTERVAL '30 days'
       LIMIT 1`,
      [creatorId],
    );
    const followerCount = Number(connection.rows[0].followers_count || 0);
    const priced = priceFor(followerCount, '30 seconds', 'corner');
    return res.json({
      success: true,
      data: {
        followers: followerCount,
        tier: priced?.tier || 'Test',
        amount: priced?.amount || 0,
        monthlyCapacity,
        remainingCapacity: activeBooking.rowCount ? 0 : Math.max(0, monthlyCapacity - Number(bookings.rows[0]?.count || 0)),
      },
    });
  } catch (err) {
    console.error('[tiktokSponsorship] getQuote error:', err);
    return res.status(500).json({ success: false, message: 'Could not load TikTok promotion pricing' });
  }
};

exports.initiate = async (req, res) => {
  const advertiserId = getSessionUserId(req);
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Log in to book a TikTok promotion' });

  const creatorId = String(req.params.creatorId || '');
  const brandName = String(req.body?.brandName || '').trim();
  const campaignBrief = String(req.body?.campaignBrief || '').trim();
  const destinationUrl = safeUrl(req.body?.destinationUrl);
  if (!brandName || brandName.length > 160) return res.status(400).json({ success: false, message: 'Brand name is required (160 characters max)' });
  if (!campaignBrief || campaignBrief.length > 2000) return res.status(400).json({ success: false, message: 'Campaign brief is required (2,000 characters max)' });
  if (!destinationUrl) return res.status(400).json({ success: false, message: 'Enter a valid http or https destination link' });
  if (String(advertiserId) === creatorId) return res.status(400).json({ success: false, message: 'You cannot book a promotion on your own account' });

  try {
    const connection = await query(
      `SELECT followers_count, tiktok_profile FROM social_connections
       WHERE creator_id = $1 AND provider = 'tiktok' LIMIT 1`,
      [creatorId],
    );
    if (!connection.rowCount) return res.status(404).json({ success: false, message: 'TikTok account not found' });
    const profile = connection.rows[0].tiktok_profile || {};
    const monthlyCapacity = Number(profile.sponsoredPostsPerMonth || 0);
    if (!Number.isInteger(monthlyCapacity) || monthlyCapacity < 1) {
      return res.status(409).json({ success: false, message: 'This creator has not opened sponsored-post capacity yet' });
    }
    const recentBookings = await query(
      `SELECT COUNT(*)::int AS count FROM tiktok_sponsorships
       WHERE creator_id = $1 AND payment_status = 'paid'
         AND status <> 'cancelled' AND created_at >= NOW() - INTERVAL '30 days'`,
      [creatorId],
    );
    const activeBooking = await query(
      `SELECT 1 FROM tiktok_sponsorships
       WHERE creator_id = $1 AND payment_status = 'paid'
         AND status IN ('pending_post', 'submitted')
         AND created_at >= NOW() - INTERVAL '30 days'
       LIMIT 1`,
      [creatorId],
    );
    if (activeBooking.rowCount) {
      return res.status(409).json({ success: false, message: 'This creator has an active bio-link campaign this month; book again when it ends' });
    }
    if (recentBookings.rows[0]?.count >= monthlyCapacity) {
      return res.status(409).json({ success: false, message: 'This creator has reached their stated sponsored-post capacity for this month' });
    }

    const priced = priceFor(Number(connection.rows[0].followers_count || 0), '30 seconds', 'corner');
    if (!priced) return res.status(400).json({ success: false, message: 'Could not calculate the TikTok post price' });
    const amount = priced.amount;
    const creatorEarnings = Math.round(amount * CREATOR_SHARE);
    const yepperCut = amount - creatorEarnings;
    const advertiser = await Creator.findById(advertiserId);
    if (!advertiser?.email) return res.status(404).json({ success: false, message: 'Advertiser account not found' });
    const txRef = generateUniqueTransactionRef('tt_sponsor', advertiserId, creatorId);
    const token = crypto.randomBytes(18).toString('hex');
    const wallet = await Wallet.findByOwner(String(advertiserId), 'advertiser');
    const walletBalance = wallet ? Number.parseFloat(wallet.balance) || 0 : 0;

    if (wallet && walletBalance >= amount) {
      const client = await getClient();
      let sponsorshipId;
      try {
        await client.query('BEGIN');
        const lockedWallet = await client.query(
          `SELECT id, balance FROM wallets WHERE id = $1 FOR UPDATE`,
          [wallet.id],
        );
        if (!lockedWallet.rowCount || Number.parseFloat(lockedWallet.rows[0].balance) < amount) {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, message: 'Wallet balance changed. Please retry your booking.' });
        }
        const sponsorship = await client.query(
          `INSERT INTO tiktok_sponsorships
             (creator_id, advertiser_id, brand_name, campaign_brief, destination_url, tracking_token,
              amount, creator_earnings, yepper_cut, payment_status, status, tx_ref)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'paid','pending_post',$10) RETURNING id`,
          [creatorId, String(advertiserId), brandName, campaignBrief, destinationUrl, token, amount, creatorEarnings, yepperCut, txRef],
        );
        sponsorshipId = sponsorship.rows[0].id;
        await client.query(
          `UPDATE wallets SET balance = balance - $1, total_spent = total_spent + $1, last_updated = NOW() WHERE id = $2`,
          [amount, wallet.id],
        );
        await upsertWallet(client, String(creatorId), 'webOwner', null, creatorEarnings, creatorEarnings, 0);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      await Payment.create({
        paymentId: txRef, tx_ref: txRef, advertiserId: String(advertiserId), webOwnerId: String(creatorId),
        amount, currency: 'RWF', status: 'successful', walletApplied: amount, amountPaid: 0,
        paymentMethod: 'wallet_only',
        metadata: { kind: 'tiktok_sponsorship', sponsorshipId, creatorId, creatorEarnings, yepperCut },
        paidAt: new Date(),
      });
      createNotification(creatorId, 'tiktok_sponsorship', 'New TikTok sponsored post', `${brandName} booked a paid TikTok promotion.`, { sponsorshipId }).catch(() => {});
      return res.json({ success: true, allPaid: true, data: { sponsorshipId, amount, trackingUrl: trackingUrl(token) } });
    }

    const sponsorship = await query(
      `INSERT INTO tiktok_sponsorships
         (creator_id, advertiser_id, brand_name, campaign_brief, destination_url, tracking_token,
          amount, creator_earnings, yepper_cut, payment_status, status, tx_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','pending_payment',$10) RETURNING id`,
      [creatorId, String(advertiserId), brandName, campaignBrief, destinationUrl, token, amount, creatorEarnings, yepperCut, txRef],
    );
    const sponsorshipId = sponsorship.rows[0].id;
    let paymentUrl;
    try {
      paymentUrl = await generateFlutterwavePaymentUrl({
        tx_ref: txRef,
        amount,
        redirectPath: '/youtube-payment-callback?kind=tiktok',
        customer: { email: advertiser.email, name: advertiser.full_name || 'Advertiser' },
        customizations: { description: `TikTok sponsored post for ${brandName} (${priced.tier})` },
      });
    } catch (err) {
      await query(`UPDATE tiktok_sponsorships SET status = 'cancelled', payment_status = 'cancelled' WHERE id = $1`, [sponsorshipId]);
      throw err;
    }
    await Payment.create({
      paymentId: txRef, tx_ref: txRef, advertiserId: String(advertiserId), webOwnerId: String(creatorId),
      amount, currency: 'RWF', status: 'pending', flutterwaveData: { paymentUrl },
      amountPaid: amount, paymentMethod: 'flutterwave',
      metadata: { kind: 'tiktok_sponsorship', sponsorshipId, creatorId, creatorEarnings, yepperCut },
    });
    return res.json({ success: true, allPaid: false, data: { sponsorshipId, amount, paymentUrl } });
  } catch (err) {
    console.error('[tiktokSponsorship] initiate error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Could not initiate TikTok sponsorship' });
  }
};

exports.verifyPayment = async (req, res) => {
  const identifier = req.body?.transaction_id || req.body?.tx_ref;
  if (!identifier) return res.status(400).json({ success: false, message: 'Transaction reference required' });
  try {
    let payment = req.body?.tx_ref ? await Payment.findByTxRef(req.body.tx_ref) : null;
    if (!payment && req.body?.transaction_id) payment = await Payment.findByPaymentId(String(req.body.transaction_id));
    if (!payment || paymentMetadata(payment).kind !== 'tiktok_sponsorship') {
      return res.status(404).json({ success: false, message: 'TikTok sponsorship payment not found' });
    }
    if (payment.status === 'successful') return res.json({ success: true, message: 'TikTok sponsorship is paid' });

    const verified = await verifyFlutterwaveTransaction(identifier);
    const data = verified?.data;
    if (verified?.status !== 'success' || data?.status !== 'successful'
      || String(data?.tx_ref) !== String(payment.tx_ref)
      || String(data?.currency).toUpperCase() !== 'RWF'
      || Number(data?.amount) < Number(payment.amount)) {
      await Payment.update(payment.id, { status: 'failed' });
      await query(`UPDATE tiktok_sponsorships SET payment_status = 'cancelled', status = 'cancelled' WHERE tx_ref = $1`, [payment.tx_ref]);
      return res.status(400).json({ success: false, message: 'TikTok sponsorship payment could not be verified' });
    }

    const metadata = paymentMetadata(payment);
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const marked = await client.query(
        `UPDATE tiktok_sponsorships SET payment_status = 'paid', status = 'pending_post', updated_at = NOW()
         WHERE tx_ref = $1 AND payment_status = 'pending' RETURNING id`,
        [payment.tx_ref],
      );
      if (!marked.rowCount) {
        await client.query('ROLLBACK');
        return res.json({ success: true, message: 'TikTok sponsorship is already active' });
      }
      await client.query(
        `UPDATE payments SET status = 'successful', paid_at = NOW(), flutterwave_data = $1 WHERE id = $2`,
        [JSON.stringify(data), payment.id],
      );
      const creatorEarnings = Number(metadata.creatorEarnings || 0);
      if (creatorEarnings > 0) {
        await upsertWallet(client, String(metadata.creatorId), 'webOwner', null, creatorEarnings, creatorEarnings, 0);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    createNotification(metadata.creatorId, 'tiktok_sponsorship', 'New TikTok sponsored post', 'A paid TikTok promotion is ready in your dashboard.', { sponsorshipId: metadata.sponsorshipId }).catch(() => {});
    return res.json({ success: true, message: 'Payment successful. Your TikTok sponsorship is active.' });
  } catch (err) {
    console.error('[tiktokSponsorship] verifyPayment error:', err);
    return res.status(500).json({ success: false, message: 'Could not verify TikTok sponsorship payment' });
  }
};

exports.getPendingForCreator = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false, message: 'Log in to view sponsored posts' });
  try {
    const result = await query(
            `SELECT id, creator_id, tiktok_video_id, last_stats_at, brand_name, campaign_brief,
              destination_url, tracking_token, amount, status, video_url, views, likes,
              comments, clicks, created_at, posted_at
       FROM tiktok_sponsorships
       WHERE creator_id = $1 AND payment_status = 'paid' AND status <> 'cancelled'
       ORDER BY created_at DESC LIMIT 50`,
      [creatorId],
    );
    const refreshedRows = await Promise.all(result.rows.map(async (row) => {
      if (!row.tiktok_video_id) return row;
      try { return await refreshVideoMetrics(row); }
      catch (err) {
        console.error('[tiktokSponsorship] creator task stats refresh error:', err.message);
        return row;
      }
    }));
    return res.json({
      success: true,
      data: refreshedRows.map((row) => ({
        id: row.id,
        brandName: row.brand_name,
        campaignBrief: row.campaign_brief,
        destinationUrl: row.destination_url,
        trackingUrl: trackingUrl(row.tracking_token),
        amount: Number(row.amount),
        status: row.status,
        videoUrl: row.video_url,
        views: Number(row.views || 0),
        likes: Number(row.likes || 0),
        comments: Number(row.comments || 0),
        clicks: Number(row.clicks || 0),
        createdAt: row.created_at,
        postedAt: row.posted_at,
      })),
    });
  } catch (err) {
    console.error('[tiktokSponsorship] getPendingForCreator error:', err);
    return res.status(500).json({ success: false, message: 'Could not load TikTok sponsorships' });
  }
};

exports.submitVideo = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false, message: 'Log in to submit a TikTok post' });
  const videoUrl = safeUrl(req.body?.videoUrl);
  const videoId = extractTikTokVideoId(videoUrl);
  if (!videoId) return res.status(400).json({ success: false, message: 'Enter a public TikTok video link with a video ID' });
  if (req.body?.linkAdded !== true) return res.status(400).json({ success: false, message: 'Confirm that you added the campaign tracking link to your TikTok bio' });

  try {
    const sponsorshipRes = await query(
      `SELECT id FROM tiktok_sponsorships
       WHERE id = $1 AND creator_id = $2 AND payment_status = 'paid' AND status = 'pending_post' LIMIT 1`,
      [req.params.id, creatorId],
    );
    if (!sponsorshipRes.rowCount) return res.status(404).json({ success: false, message: 'No active TikTok sponsorship is awaiting a post' });
    const accessToken = await getCreatorTikTokToken(creatorId);
    if (!accessToken) return res.status(409).json({ success: false, message: 'Reconnect TikTok with the approved video.list scope before submitting a post' });
    const video = await getTikTokVideo(accessToken, videoId);
    if (!video) return res.status(422).json({ success: false, message: 'That video was not found in the connected TikTok account' });

    const result = await query(
      `UPDATE tiktok_sponsorships
       SET tiktok_video_id = $1, video_url = $2, views = $3, likes = $4, comments = $5,
           link_added = TRUE, status = 'submitted', posted_at = NOW(), last_stats_at = NOW(), updated_at = NOW()
       WHERE id = $6 AND creator_id = $7 AND status = 'pending_post' RETURNING id, views, likes, comments, clicks, video_url`,
      [videoId, video.share_url || videoUrl, Number(video.view_count || 0), Number(video.like_count || 0), Number(video.comment_count || 0), req.params.id, creatorId],
    );
    if (!result.rowCount) return res.status(409).json({ success: false, message: 'This sponsorship was already submitted' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[tiktokSponsorship] submitVideo error:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Could not verify TikTok video' });
  }
};

exports.getAdvertiserReports = async (req, res) => {
  const advertiserId = getSessionUserId(req);
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Log in to view TikTok campaign results' });
  try {
    const result = await query(
            `SELECT id, creator_id, tiktok_video_id, last_stats_at, brand_name, amount, status,
              video_url, views, likes, comments, clicks, created_at, posted_at
       FROM tiktok_sponsorships
       WHERE advertiser_id = $1 AND creator_id = $2 AND payment_status = 'paid'
       ORDER BY created_at DESC LIMIT 20`,
      [String(advertiserId), req.params.creatorId],
    );
    const campaigns = await Promise.all(result.rows.map(async (row) => {
      let current = row;
      if (row.tiktok_video_id) {
        try { current = await refreshVideoMetrics(row); }
        catch (err) { console.error('[tiktokSponsorship] report refresh error:', err.message); }
      }
      return {
        id: current.id,
        brandName: current.brand_name,
        amount: Number(current.amount),
        status: current.status,
        videoUrl: current.video_url,
        views: Number(current.views || 0),
        likes: Number(current.likes || 0),
        comments: Number(current.comments || 0),
        clicks: Number(current.clicks || 0),
        createdAt: current.created_at,
        postedAt: current.posted_at,
      };
    }));
    return res.json({ success: true, data: campaigns });
  } catch (err) {
    console.error('[tiktokSponsorship] getAdvertiserReports error:', err);
    return res.status(500).json({ success: false, message: 'Could not load TikTok campaign results' });
  }
};

exports.trackClick = async (req, res) => {
  try {
    const result = await query(
      `UPDATE tiktok_sponsorships SET clicks = clicks + 1, updated_at = NOW()
       WHERE tracking_token = $1 AND payment_status = 'paid' AND status <> 'cancelled'
       RETURNING destination_url`,
      [req.params.token],
    );
    if (!result.rowCount) return res.status(404).send('This campaign link is no longer active.');
    res.set('Cache-Control', 'no-store');
    return res.redirect(302, result.rows[0].destination_url);
  } catch (err) {
    console.error('[tiktokSponsorship] trackClick error:', err);
    return res.status(500).send('Could not open this campaign link.');
  }
};