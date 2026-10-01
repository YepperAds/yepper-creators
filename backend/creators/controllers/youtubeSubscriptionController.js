'use strict';

const { query, getClient } = require('../../config/db');
const Creator = require('../models/Creator');
const Payment = require('../../AdOwner/models/PaymentModel');
const { getSessionUserId } = require('./adSpaceController');
const {
  createFlutterwavePaymentPlan,
  generateFlutterwavePaymentUrl,
  generateUniqueTransactionRef,
  verifyFlutterwaveTransaction,
} = require('../../AdOwner/controllers/PaymentController');

const MONTHLY_PRICE_RWF = 20000;
const PLAN_KEY = `youtube_creator_monthly_${process.env.FLUTTERWAVE_TEST_MODE === 'false' ? 'live' : 'test'}`;

async function getOrCreatePlanId() {
  const configuredPlanId = process.env.FLW_YOUTUBE_CREATOR_PLAN_ID;
  if (configuredPlanId) return String(configuredPlanId);

  const existing = await query(
    `SELECT flutterwave_plan_id FROM youtube_creator_subscription_plans WHERE plan_key = $1`,
    [PLAN_KEY],
  );
  if (existing.rowCount) return existing.rows[0].flutterwave_plan_id;

  const createdPlanId = await createFlutterwavePaymentPlan({
    name: 'Yepper YouTube Creator Processing',
    amount: MONTHLY_PRICE_RWF,
    currency: 'RWF',
    interval: 'monthly',
  });
  await query(
    `INSERT INTO youtube_creator_subscription_plans (plan_key, flutterwave_plan_id)
     VALUES ($1, $2) ON CONFLICT (plan_key) DO NOTHING`,
    [PLAN_KEY, createdPlanId],
  );
  const saved = await query(
    `SELECT flutterwave_plan_id FROM youtube_creator_subscription_plans WHERE plan_key = $1`,
    [PLAN_KEY],
  );
  return saved.rows[0].flutterwave_plan_id;
}

async function recordSuccessfulCharge({ creatorId, transactionId, txRef, amount, planId }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const recorded = await client.query(
      `INSERT INTO youtube_creator_subscription_payments
         (flutterwave_transaction_id, creator_id, tx_ref, amount, status)
       VALUES ($1, $2, $3, $4, 'successful')
       ON CONFLICT (flutterwave_transaction_id) DO NOTHING
       RETURNING flutterwave_transaction_id`,
      [String(transactionId), creatorId, txRef || null, amount],
    );
    if (recorded.rowCount) {
      await client.query(
        `INSERT INTO youtube_creator_subscriptions
           (creator_id, status, current_period_end, flutterwave_plan_id, updated_at)
         VALUES ($1, 'active', NOW() + INTERVAL '1 month', $2, NOW())
         ON CONFLICT (creator_id) DO UPDATE SET
           status = 'active',
           current_period_end = GREATEST(COALESCE(youtube_creator_subscriptions.current_period_end, NOW()), NOW()) + INTERVAL '1 month',
           flutterwave_plan_id = EXCLUDED.flutterwave_plan_id,
           updated_at = NOW()`,
        [creatorId, String(planId)],
      );
    }
    await client.query('COMMIT');
    return recorded.rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function getPaymentMetadata(payment) {
  if (!payment?.metadata) return {};
  if (typeof payment.metadata === 'string') {
    try { return JSON.parse(payment.metadata); } catch { return {}; }
  }
  return payment.metadata;
}

exports.requireProcessingSubscription = async (req, res, next) => {
  if (req.params.provider !== 'youtube') return next();
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false, message: 'Log in to process a YouTube video' });
  try {
    const result = await query(
      `SELECT status, current_period_end FROM youtube_creator_subscriptions WHERE creator_id = $1`,
      [creatorId],
    );
    const subscription = result.rows[0];
    if (subscription?.status !== 'active' || new Date(subscription.current_period_end).getTime() <= Date.now()) {
      return res.status(402).json({
        success: false,
        subscriptionRequired: true,
        message: 'YouTube video processing requires an active RWF 20,000/month subscription. You can still publish manually for free.',
      });
    }
    return next();
  } catch (err) {
    console.error('[youtubeSubscription] processing gate error:', err);
    return res.status(500).json({ success: false, message: 'Could not verify processing subscription' });
  }
};

exports.getStatus = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false, message: 'Log in to check your subscription' });
  try {
    const result = await query(
      `SELECT status, current_period_end
       FROM youtube_creator_subscriptions WHERE creator_id = $1`,
      [creatorId],
    );
    const subscription = result.rows[0] || null;
    const active = subscription?.status === 'active'
      && new Date(subscription.current_period_end).getTime() > Date.now();
    return res.json({
      success: true,
      data: {
        active,
        monthlyPrice: MONTHLY_PRICE_RWF,
        currentPeriodEnd: subscription?.current_period_end || null,
      },
    });
  } catch (err) {
    console.error('[youtubeSubscription] getStatus error:', err);
    return res.status(500).json({ success: false, message: 'Could not load subscription status' });
  }
};

exports.initiate = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false, message: 'Log in to subscribe' });
  try {
    const statusRes = await query(
      `SELECT status, current_period_end FROM youtube_creator_subscriptions WHERE creator_id = $1`,
      [creatorId],
    );
    const current = statusRes.rows[0];
    if (current?.status === 'active' && new Date(current.current_period_end).getTime() > Date.now()) {
      return res.json({ success: true, active: true, currentPeriodEnd: current.current_period_end });
    }

    const creator = await Creator.findById(creatorId);
    if (!creator?.email) return res.status(404).json({ success: false, message: 'Creator account not found' });
    const planId = await getOrCreatePlanId();
    const txRef = generateUniqueTransactionRef('yt_creator_monthly', creatorId, planId);
    const paymentUrl = await generateFlutterwavePaymentUrl({
      tx_ref: txRef,
      amount: MONTHLY_PRICE_RWF,
      paymentPlan: planId,
      redirectPath: '/youtube-subscription-callback',
      customer: { email: creator.email, name: creator.full_name || 'Yepper creator' },
      customizations: { description: 'YouTube ad processing subscription — RWF 20,000/month' },
    });

    await Payment.create({
      paymentId: txRef,
      tx_ref: txRef,
      advertiserId: String(creatorId),
      webOwnerId: String(creatorId),
      amount: MONTHLY_PRICE_RWF,
      currency: 'RWF',
      status: 'pending',
      flutterwaveData: { paymentUrl },
      paymentMethod: 'flutterwave',
      metadata: { kind: 'youtube_creator_subscription', creatorId: String(creatorId), planId },
    });
    return res.json({ success: true, data: { paymentUrl, tx_ref: txRef } });
  } catch (err) {
    console.error('[youtubeSubscription] initiate error:', err);
    return res.status(502).json({ success: false, message: err.message || 'Could not start subscription checkout' });
  }
};

exports.verify = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false, message: 'Log in to verify payment' });
  const txRef = String(req.body?.tx_ref || '');
  if (!txRef) return res.status(400).json({ success: false, message: 'Payment reference required' });

  try {
    const payment = await Payment.findByTxRef(txRef);
    const metadata = getPaymentMetadata(payment);
    if (!payment || metadata.kind !== 'youtube_creator_subscription' || String(metadata.creatorId) !== String(creatorId)) {
      return res.status(404).json({ success: false, message: 'Subscription payment not found' });
    }
    if (payment.status !== 'successful') {
      const verified = await verifyFlutterwaveTransaction(req.body?.transaction_id || txRef);
      const data = verified?.data;
      if (verified?.status !== 'success' || data?.status !== 'successful'
        || String(data?.currency).toUpperCase() !== 'RWF'
        || Number(data?.amount) < MONTHLY_PRICE_RWF) {
        await Payment.update(payment.id, { status: 'failed' });
        return res.status(400).json({ success: false, message: 'Subscription payment was not successful' });
      }
      await Payment.update(payment.id, { status: 'successful', paidAt: new Date(), flutterwaveData: data });
      await recordSuccessfulCharge({
        creatorId,
        transactionId: data.id || txRef,
        txRef,
        amount: Number(data.amount),
        planId: metadata.planId,
      });
    }

    const statusRes = await query(
      `SELECT current_period_end FROM youtube_creator_subscriptions WHERE creator_id = $1`,
      [creatorId],
    );
    return res.json({ success: true, active: true, currentPeriodEnd: statusRes.rows[0]?.current_period_end || null });
  } catch (err) {
    console.error('[youtubeSubscription] verify error:', err);
    return res.status(500).json({ success: false, message: 'Could not verify subscription payment' });
  }
};

exports.webhook = async (req, res) => {
  const expectedHash = process.env.FLW_SECRET_HASH;
  const receivedHash = req.headers['verif-hash'];
  if (!expectedHash || receivedHash !== expectedHash) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
  }

  const event = req.body?.event || req.body?.['event.type'];
  const data = req.body?.data || {};
  if (event !== 'charge.completed' || data.status !== 'successful') {
    return res.status(200).json({ success: true, ignored: true });
  }

  try {
    let payment = data.tx_ref ? await Payment.findByTxRef(data.tx_ref) : null;
    let creatorId = null;
    let planId = null;
    const metadata = getPaymentMetadata(payment);
    if (metadata.kind === 'youtube_creator_subscription') {
      creatorId = metadata.creatorId;
      planId = metadata.planId;
    } else {
      const email = data.customer?.email;
      const flwPlanId = data.plan?.id || data.payment_plan;
      if (!email || !flwPlanId) return res.status(200).json({ success: true, ignored: true });
      const subRes = await query(
        `SELECT c.id AS creator_id, s.flutterwave_plan_id
         FROM creators c JOIN youtube_creator_subscriptions s ON s.creator_id = c.id
         WHERE LOWER(c.email) = LOWER($1) AND s.flutterwave_plan_id = $2`,
        [email, String(flwPlanId)],
      );
      creatorId = subRes.rows[0]?.creator_id;
      planId = subRes.rows[0]?.flutterwave_plan_id;
    }
    if (!creatorId || !planId) return res.status(200).json({ success: true, ignored: true });

    const verified = await verifyFlutterwaveTransaction(data.id || data.tx_ref);
    if (verified?.status !== 'success' || verified.data?.status !== 'successful'
      || String(verified.data?.currency).toUpperCase() !== 'RWF'
      || Number(verified.data?.amount) < MONTHLY_PRICE_RWF) {
      return res.status(200).json({ success: true, ignored: true });
    }
    if (payment && metadata.kind === 'youtube_creator_subscription' && payment.status !== 'successful') {
      await Payment.update(payment.id, { status: 'successful', paidAt: new Date(), flutterwaveData: verified.data });
    }
    const recorded = await recordSuccessfulCharge({
      creatorId,
      transactionId: verified.data.id || data.id || data.tx_ref,
      txRef: data.tx_ref,
      amount: Number(verified.data.amount),
      planId,
    });
    return res.json({ success: true, recorded });
  } catch (err) {
    console.error('[youtubeSubscription] webhook error:', err);
    return res.status(500).json({ success: false, message: 'Subscription webhook failed' });
  }
};

exports.createManualYoutubePost = async (req, res) => {
  const creatorId = getSessionUserId(req);
  if (!creatorId) return res.status(401).json({ success: false, message: 'Log in to prepare your YouTube post' });

  let slotTypes = [];
  try {
    slotTypes = Array.isArray(req.body?.claimedSlotTypes)
      ? req.body.claimedSlotTypes
      : JSON.parse(req.body?.claimedSlotTypes || '[]');
  } catch { slotTypes = []; }
  slotTypes = [...new Set(slotTypes.filter((slot) => typeof slot === 'string'))];
  if (!slotTypes.length) return res.status(400).json({ success: false, message: 'Download and include at least one advertiser ad image first' });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const claimsRes = await client.query(
      `SELECT id, advertiser_id, slot_type FROM youtube_ad_claims
       WHERE creator_id = $1 AND slot_type = ANY($2)
         AND status = 'pending' AND payment_status = 'paid'
       FOR UPDATE`,
      [creatorId, slotTypes],
    );
    if (!claimsRes.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No paid advertiser images are available for those positions' });
    }

    const claimIds = claimsRes.rows.map((claim) => claim.id);
    const existingPostRes = await client.query(
      `SELECT p.id, p.tracking_code, p.description
       FROM ad_video_posts p
       JOIN youtube_ad_video_claims c ON c.ad_video_post_id = p.id
       WHERE c.claim_id = ANY($1::int[]) AND p.status = 'pending_publish'
       ORDER BY p.id DESC LIMIT 1`,
      [claimIds],
    );
    if (existingPostRes.rowCount) {
      await client.query('COMMIT');
      const existingPost = existingPostRes.rows[0];
      return res.json({
        success: true,
        data: {
          postId: existingPost.id,
          trackingCode: existingPost.tracking_code,
          description: existingPost.description,
        },
      });
    }

    const seqRes = await client.query(
      `INSERT INTO ad_tracking_sequences (provider, last_id) VALUES ('youtube', 1)
       ON CONFLICT (provider) DO UPDATE SET last_id = ad_tracking_sequences.last_id + 1
       RETURNING last_id`,
    );
    const trackingCode = `#YPR-YT-${String(seqRes.rows[0].last_id).padStart(3, '0')}`;
    const title = String(req.body?.title || 'YouTube Ad Video').slice(0, 200);
    const description = String(req.body?.description || '').trim();
    const fullDescription = description ? `${description}\n\n${trackingCode}` : trackingCode;
    const postRes = await client.query(
      `INSERT INTO ad_video_posts (creator_id, provider, tracking_code, tracking_num, title, description, status)
       VALUES ($1, 'youtube', $2, $3, $4, $5, 'pending_publish') RETURNING id`,
      [creatorId, trackingCode, seqRes.rows[0].last_id, title, fullDescription],
    );
    const postId = postRes.rows[0].id;
    for (const claim of claimsRes.rows) {
      await client.query(
        `INSERT INTO youtube_ad_video_claims (ad_video_post_id, claim_id, advertiser_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [postId, claim.id, claim.advertiser_id],
      );
    }
    await client.query('COMMIT');
    return res.json({ success: true, data: { postId, trackingCode, description: fullDescription } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[youtubeSubscription] createManualYoutubePost error:', err);
    return res.status(500).json({ success: false, message: 'Could not prepare your YouTube post' });
  } finally {
    client.release();
  }
};

exports.getAdvertiserYoutubePosts = async (req, res) => {
  const advertiserId = getSessionUserId(req);
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Log in to view your YouTube ads' });
  try {
    const result = await query(
      `SELECT DISTINCT p.id, p.provider, p.tracking_code, p.platform_video_id, p.video_url,
              p.title, p.description, p.thumbnail_url, p.status, p.posted_at,
              p.views, p.likes, p.comments, sc.username AS channel_name
       FROM ad_video_posts p
       JOIN youtube_ad_video_claims c ON c.ad_video_post_id = p.id
       LEFT JOIN social_connections sc ON sc.creator_id = p.creator_id AND sc.provider = 'youtube'
       WHERE c.advertiser_id = $1 AND p.provider = 'youtube' AND p.status = 'live'
       ORDER BY p.posted_at DESC LIMIT 100`,
      [String(advertiserId)],
    );
    const posts = result.rows;
    const videoIds = posts.map((post) => post.platform_video_id).filter(Boolean);
    if (videoIds.length && process.env.YOUTUBE_API_KEY) {
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/videos');
        url.searchParams.set('part', 'snippet,statistics');
        url.searchParams.set('id', videoIds.join(','));
        url.searchParams.set('key', process.env.YOUTUBE_API_KEY);
        const response = await fetch(url);
        const data = await response.json().catch(() => null);
        const liveById = new Map((data?.items || []).map((item) => [item.id, item]));
        for (const post of posts) {
          const live = liveById.get(post.platform_video_id);
          if (!live) continue;
          post.views = Number(live.statistics?.viewCount || 0);
          post.likes = Number(live.statistics?.likeCount || 0);
          post.comments = Number(live.statistics?.commentCount || 0);
          post.thumbnail_url = live.snippet?.thumbnails?.high?.url
            || live.snippet?.thumbnails?.medium?.url
            || post.thumbnail_url;
          post.title = live.snippet?.title || post.title;
        }
      } catch (err) {
        console.error('[youtubeSubscription] advertiser post stats error:', err?.message);
      }
    }
    return res.json({ success: true, data: posts });
  } catch (err) {
    console.error('[youtubeSubscription] getAdvertiserYoutubePosts error:', err);
    return res.status(500).json({ success: false, message: 'Could not load your YouTube ads' });
  }
};