'use strict';

// Paying to claim a YouTube creator's ad slot. Priced server-side from the
// creator's own subscriber count (never trusts a client-sent amount), then
// settled through the same wallet/refund/Flutterwave machinery the
// website-ad flow already uses (see AdOwner/controllers/PaymentController.js)
// — just kept in its own file since youtube_ad_claims has a different shape
// than import_ads/ad_categories and shouldn't be wedged into that code.

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
const { AD_SIZES } = require('../utils/adOverlay');
const { validateBusinessCategories } = require('../utils/businessCategories');
const { getSessionUserId, uploadCreativeToCloudinary, SLOT_TYPES } = require('./adSpaceController');

const CREATOR_SHARE = 0.70; // creator keeps 70%, Yepper takes the rest

// POST /api/social/youtube/ad-spaces/:creatorId/claim/initiate
// multipart form: image, slotType, adSize, durationBand
exports.initiateClaimPayment = async (req, res) => {
  const advertiserId = getSessionUserId(req);
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Log in to claim an ad space' });

  const { creatorId } = req.params;
  const { slotType, durationBand, businessCategoryOther } = req.body;
  const adSize = AD_SIZES.includes(req.body.adSize) ? req.body.adSize : 'medium';
  if (!SLOT_TYPES.includes(slotType)) return res.status(400).json({ success: false, message: 'Invalid slot type' });
  if (!req.file) return res.status(400).json({ success: false, message: 'No ad image uploaded' });

  // Same business-category requirement as buying website ad space — sent as
  // a JSON-stringified array, same shape as businessCategories on /api/web-advertise.
  let businessCategories;
  try {
    businessCategories = JSON.parse(req.body.businessCategories || '[]');
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid businessCategories' });
  }
  const categoryError = validateBusinessCategories(businessCategories, businessCategoryOther);
  if (categoryError) return res.status(400).json({ success: false, message: categoryError });

  try {
    const creatorRes = await query(`SELECT ad_type_preference FROM creators WHERE id = $1`, [creatorId]);
    if (!creatorRes.rowCount) return res.status(404).json({ success: false, message: 'Creator not found' });
    const adType = creatorRes.rows[0].ad_type_preference || 'corner';

    const subsRes = await query(
      `SELECT followers_count FROM social_connections WHERE creator_id = $1 AND provider = 'youtube' LIMIT 1`,
      [creatorId],
    );
    const subscribers = Number(subsRes.rows[0]?.followers_count || 0);
    // Price follows the creator's own fixed ad_type (corner/lbar) — the
    // advertiser doesn't get a separate "ad kind" choice.
    const priced = priceFor(subscribers, durationBand, adType);
    if (!priced) return res.status(400).json({ success: false, message: 'Invalid duration' });
    const { tier, amount: totalCost } = priced;

    const advertiser = await Creator.findById(advertiserId);
    const wallet = await Wallet.findByOwner(String(advertiserId), 'advertiser');
    const walletBalance = wallet ? parseFloat(wallet.balance) : 0;

    const walletToUse = Math.min(walletBalance, totalCost);
    const remainingAmount = totalCost - walletToUse;

    const creatorEarnings = Math.round(totalCost * CREATOR_SHARE);
    const yepperCut = totalCost - creatorEarnings;

    const imageUrl = await uploadCreativeToCloudinary(req.file);

    const claimColumns = `creator_id, advertiser_id, slot_type, image_url, ad_type, ad_size,
       duration_band, tier, amount, creator_earnings, yepper_cut, currency,
       business_categories, business_category_other, tx_ref`;
    const claimValues = [
      creatorId, String(advertiserId), slotType, imageUrl, adType, adSize,
      durationBand, tier, totalCost, creatorEarnings, yepperCut, 'RWF',
      JSON.stringify(businessCategories), businessCategoryOther || null,
    ];

    if (remainingAmount <= 0.01) {
      // Fully covered by wallet balance — finalize immediately.
      const tx_ref = generateUniqueTransactionRef('yt_claim_wallet', advertiserId, `${creatorId}_${slotType}`);
      const client = await getClient();
      let claimId;
      try {
        await client.query('BEGIN');

        const claimRes = await client.query(
          `INSERT INTO youtube_ad_claims (${claimColumns}, payment_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'paid') RETURNING id`,
          [...claimValues, tx_ref],
        );
        claimId = claimRes.rows[0].id;

        if (walletToUse > 0) {
          await client.query(
            `UPDATE wallets SET balance = balance - $1, total_spent = total_spent + $1, last_updated = NOW() WHERE id = $2`,
            [walletToUse, wallet.id],
          );
        }
        if (creatorEarnings > 0) {
          await upsertWallet(client, String(creatorId), 'webOwner', null, creatorEarnings, creatorEarnings, 0);
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      await Payment.create({
        paymentId: tx_ref, tx_ref, advertiserId: String(advertiserId), webOwnerId: String(creatorId),
        amount: totalCost, currency: 'RWF', status: 'successful',
        walletApplied: walletToUse, amountPaid: 0,
        paymentMethod: 'wallet_only',
        metadata: { kind: 'youtube_claim', claimId, creatorId, slotType, adSize, durationBand, adType, tier, creatorEarnings, yepperCut, businessCategories, businessCategoryOther },
        paidAt: new Date(),
      });

      return res.status(200).json({
        success: true, allPaid: true, tier, totalCost,
        walletApplied: walletToUse,
        data: { slotType, imageUrl, adType, adSize, claimId },
      });
    }

    // Needs external payment — insert the claim now (locks the slot via the
    // existing unique-pending-per-slot index) with payment_status='pending',
    // and send the advertiser to Flutterwave for the remainder.
    const tx_ref = generateUniqueTransactionRef('yt_claim_flw', advertiserId, `${creatorId}_${slotType}`);
    let claimId;
    try {
      const claimRes = await query(
        `INSERT INTO youtube_ad_claims (${claimColumns}, payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending') RETURNING id`,
        [...claimValues, tx_ref],
      );
      claimId = claimRes.rows[0].id;
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ success: false, message: 'That ad space was just claimed by someone else' });
      throw err;
    }

    const paymentUrl = await generateFlutterwavePaymentUrl({
      tx_ref, amount: remainingAmount,
      redirectPath: '/youtube-payment-callback',
      customer: { email: advertiser?.email, name: advertiser?.full_name || 'Advertiser' },
      customizations: { description: `YouTube ad slot — ${slotType} (${durationBand}, ${adType})` },
    });

    await Payment.create({
      paymentId: tx_ref, tx_ref, advertiserId: String(advertiserId), webOwnerId: String(creatorId),
      amount: totalCost, currency: 'RWF', status: 'pending',
      flutterwaveData: { paymentUrl }, walletApplied: walletToUse,
      amountPaid: remainingAmount,
      paymentMethod: walletToUse > 0 ? 'wallet_hybrid' : 'flutterwave',
      metadata: { kind: 'youtube_claim', claimId, creatorId, slotType, adSize, durationBand, adType, tier, creatorEarnings, yepperCut },
    });

    return res.status(200).json({
      success: true, allPaid: false, tier, totalCost,
      walletApplied: walletToUse, amountPaid: remainingAmount,
      paymentUrl, tx_ref, data: { slotType, imageUrl, adType, adSize, claimId },
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'That ad space was just claimed by someone else' });
    console.error('[youtubeClaimPayment] initiateClaimPayment error:', err);
    return res.status(500).json({ success: false, message: 'Failed to initiate payment' });
  }
};

// POST /api/social/youtube/ad-spaces/claim/verify — called by the
// youtube-payment-callback page once the advertiser returns from Flutterwave.
exports.verifyClaimPayment = async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.body;
    const identifier = transaction_id || tx_ref;
    if (!identifier) return res.status(400).json({ success: false, message: 'Transaction reference required' });

    let payment = tx_ref ? await Payment.findByTxRef(tx_ref) : null;
    if (!payment && transaction_id) payment = await Payment.findByPaymentId(String(transaction_id));
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });
    if (payment.metadata?.kind !== 'youtube_claim') {
      return res.status(400).json({ success: false, message: 'Not a YouTube ad-slot payment' });
    }
    if (payment.status === 'successful') {
      return res.status(200).json({ success: true, message: 'Payment already processed' });
    }

    const flwResponse = await verifyFlutterwaveTransaction(identifier);
    const flwData = flwResponse.data;

    if (flwResponse.status === 'success' && flwData?.status === 'successful') {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE payments SET status = 'successful', paid_at = NOW(), flutterwave_data = $1 WHERE id = $2`,
          [JSON.stringify(flwData), payment.id],
        );
        await client.query(`UPDATE youtube_ad_claims SET payment_status = 'paid' WHERE tx_ref = $1`, [payment.tx_ref]);

        // Wallet was only checked at initiate time, not yet debited — commit
        // that portion now that the gateway side has actually succeeded.
        const walletApplied = parseFloat(payment.wallet_applied || 0);
        if (walletApplied > 0) {
          await client.query(
            `UPDATE wallets SET balance = balance - $1, total_spent = total_spent + $1, last_updated = NOW()
             WHERE owner_id = $2 AND owner_type = 'advertiser'`,
            [walletApplied, payment.advertiser_id],
          );
        }

        const creatorEarnings = parseFloat(payment.metadata?.creatorEarnings || 0);
        if (creatorEarnings > 0) {
          await upsertWallet(client, String(payment.web_owner_id), 'webOwner', null, creatorEarnings, creatorEarnings, 0);
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      return res.status(200).json({ success: true, message: 'Payment verified — ad slot claimed.' });
    }

    await Payment.update(payment.id, { status: 'failed' });
    await query(
      `UPDATE youtube_ad_claims SET status = 'cancelled', payment_status = 'cancelled' WHERE tx_ref = $1`,
      [payment.tx_ref],
    );
    return res.status(400).json({ success: false, message: 'Payment verification failed', details: flwData });
  } catch (err) {
    console.error('[youtubeClaimPayment] verifyClaimPayment error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
};
