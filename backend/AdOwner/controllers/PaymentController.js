// PaymentController.js — Flutterwave integration (PostgreSQL)
const crypto = require('crypto');
const axios = require('axios');
const Creator = require('../../creators/models/Creator');
const Payment = require('../models/PaymentModel');
const ImportAd = require('../models/WebAdvertiseModel');
const AdCategory = require('../../AdPromoter/models/CreateCategoryModel');
const Website = require('../../AdPromoter/models/CreateWebsiteModel');
const Pricing = require('../../models/PricingModel');
const { Wallet, WalletTransaction } = require('../../AdPromoter/models/walletModel');
const { getClient } = require('../../config/db');

// ─── Flutterwave helpers ───────────────────────────────────────────────────
const FLW_TEST_MODE = process.env.FLUTTERWAVE_TEST_MODE !== 'false';
const FLW_TEST_SECRET_KEY = process.env.FLW_TEST_SECRET_KEY;
const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

const flwHeaders = () => ({
  Authorization: `Bearer ${FLW_TEST_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

const createFlutterwaveLink = async ({
  tx_ref, amount, currency = 'RWF', customer, description, redirect_url,
  payment_options = 'card,mobilemoney',
}) => {
  if (!FLW_TEST_SECRET_KEY) throw new Error('Flutterwave secret key is not set.');
  console.log(`[Flutterwave] createLink — mode=${FLW_TEST_MODE ? 'SANDBOX' : 'LIVE'} amount=${amount} ${currency} ref=${tx_ref}`);
  let response;
  try {
    response = await axios.post(
      `${FLW_BASE_URL}/payments`,
      { tx_ref, amount, currency, redirect_url, payment_options,
        customer: { email: customer.email, name: customer.name },
        customizations: { title: 'Yepper Ads', description, logo: process.env.BRAND_LOGO_URL || '' },
        meta: { source: 'yepper', sandbox: FLW_TEST_MODE } },
      { headers: flwHeaders(), timeout: 30000 }
    );
  } catch (axiosErr) {
    console.error('[Flutterwave] API call failed:', { status: axiosErr.response?.status, data: axiosErr.response?.data });
    throw new Error(axiosErr.response?.data?.message || `Flutterwave API error: ${axiosErr.message}`);
  }
  if (response.data.status === 'success') {
    const url = response.data.data?.link;
    console.log('[Flutterwave] payment link created:', url);
    return url;
  }
  throw new Error(`Flutterwave link creation failed: ${response.data.message || 'Unknown error'}`);
};

const verifyFlutterwaveTransaction = async (identifier) => {
  const isNumericId = /^\d+$/.test(String(identifier));
  if (isNumericId) {
    const response = await axios.get(`${FLW_BASE_URL}/transactions/${identifier}/verify`, { headers: flwHeaders(), timeout: 30000 });
    return response.data;
  }
  const response = await axios.get(`${FLW_BASE_URL}/transactions`, { params: { tx_ref: identifier }, headers: flwHeaders(), timeout: 30000 });
  if (response.data.status === 'success' && Array.isArray(response.data.data) && response.data.data.length > 0) {
    return { status: 'success', data: response.data.data[0] };
  }
  return { status: 'error', data: null };
};
exports.verifyFlutterwaveTransaction = verifyFlutterwaveTransaction;

const generateUniqueTransactionRef = (prefix, userId, additionalData = '') => {
  const timestamp = Date.now();
  const nanoTime = process.hrtime.bigint().toString();
  const random = crypto.randomBytes(8).toString('hex');
  const counter = Math.floor(Math.random() * 9999);
  const hash = crypto.createHash('sha256')
    .update(`${userId}_${additionalData}_${timestamp}_${nanoTime}_${random}_${counter}`)
    .digest('hex').substring(0, 12);
  return `${prefix}_${userId}_${hash}_${timestamp}_${counter}`;
};
exports.generateUniqueTransactionRef = generateUniqueTransactionRef;

// Helper: get available refund total for a user
const getAllAvailableRefunds = async (userId) => {
  const refunds = await Payment.findAvailableRefunds(userId);
  return refunds.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
};
exports.getAllAvailableRefunds = getAllAvailableRefunds;

// Helper: upsert wallet balance
const upsertWallet = async (client, ownerId, ownerType, ownerEmail, incBalance, incEarned, incSpent) => {
  await client.query(
    `INSERT INTO wallets (owner_id, owner_type, owner_email, balance, total_earned, total_spent, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (owner_id, owner_type) DO UPDATE SET
       balance = wallets.balance + $4,
       total_earned = wallets.total_earned + $5,
       total_spent = wallets.total_spent + $6,
       last_updated = NOW()
     RETURNING *`,
    [ownerId, ownerType, ownerEmail || '', incBalance || 0, incEarned || 0, incSpent || 0]
  );
};
exports.upsertWallet = upsertWallet;

// Helper: parse website_selections from postgres row
const parseSelections = (ad) => {
  if (!ad) return [];
  const ws = ad.website_selections;
  if (!ws) return [];
  if (Array.isArray(ws)) return ws;
  try { return JSON.parse(ws); } catch { return []; }
};

// Helper: update website_selections on an ad row via client
const updateAdSelections = async (client, adId, websiteSelections) => {
  await client.query(
    `UPDATE import_ads SET website_selections = $1 WHERE id = $2`,
    [JSON.stringify(websiteSelections), adId]
  );
};

// ─── initiatePayment (bulk) ────────────────────────────────────────────────
exports.initiatePayment = async (req, res) => {
  try {
    const { adId, selections } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;
    console.log('[initiatePayment] adId:', adId, 'userId:', userId, 'selections:', JSON.stringify(selections));

    if (!Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: 'At least one ad placement must be selected' });
    }

    const ad = await ImportAd.findById(adId);
    console.log('[initiatePayment] ad:', ad ? 'found user_id='+ad.user_id : 'NOT FOUND');
    if (!ad) return res.status(404).json({ error: 'Ad not found' });
    if (ad.user_id.toString() !== userId.toString()) {
      console.log('[initiatePayment] UNAUTHORIZED ad.user_id:', ad.user_id, '!== userId:', userId);
      return res.status(403).json({ error: 'Unauthorized access to ad' });
    }

    const websiteSelections = parseSelections(ad);
    console.log('[initiatePayment] parsed websiteSelections:', JSON.stringify(websiteSelections));
    let totalAmount = 0;
    const validatedSelections = [];
    const categoryDetails = [];

    // Flat margin for now — the "drops to 25/20/15% for top performers" idea
    // from the pricing sheet isn't built yet, on purpose (holding off until
    // asked for). Same margin for every selection in this bulk request.
    const { marginPercent } = await Pricing.getSettings();

    for (const selection of selections) {
      const { websiteId, categoryId } = selection;
      const existing = websiteSelections.find(
        (sel) => sel.websiteId === websiteId && Array.isArray(sel.categories) &&
          sel.categories.includes(categoryId) && sel.status === 'active'
      );
      console.log('[initiatePayment] checking websiteId:', websiteId, 'categoryId:', categoryId, 'existing:', !!existing);
      if (existing) continue;

      const category = await AdCategory.findById(categoryId);
      const website = await Website.findById(websiteId);
      console.log('[initiatePayment] category:', !!category, 'website:', !!website);
      if (!category || !website) {
        return res.status(404).json({ error: `Category or website not found for: ${categoryId}` });
      }

      // "All Pages" ad spaces (target_path IS NULL) let the advertiser pick
      // which pages the ad actually shows on — but only from pages where the
      // site-wide script has actually detected the category's placeholder
      // div (ad_categories.detected_pages, populated by the reportSpaceSeen
      // beacon), NOT the owner's self-reported websites.pages list. An owner
      // can register 6 pages but only ever have pasted the div on 1 — the
      // advertiser shouldn't be asked (or charged more) for pages the ad can
      // never actually render on. Picking 2+ real placements doubles the price.
      const detectedPages = Array.isArray(category.detected_pages)
        ? category.detected_pages
        : (typeof category.detected_pages === 'string' ? JSON.parse(category.detected_pages || '[]') : []);
      const pageSelectionEligible = category.target_path == null && detectedPages.length >= 2;

      let selectedPages = null;
      let priceMultiplier = 1;
      if (pageSelectionEligible) {
        const validPaths = new Set(detectedPages);
        const requested = Array.isArray(selection.selectedPages)
          ? [...new Set(selection.selectedPages.filter((p) => validPaths.has(p)))]
          : [];
        selectedPages = requested.length > 0 ? requested : detectedPages;
        priceMultiplier = selectedPages.length >= 2 ? 2 : 1;
      }

      // Multi-tier ad spaces ("Shared / Featured / Exclusive"): pick the
      // price from the tier the advertiser chose, server-side — never trust
      // a client-sent price, same principle as basePrice below for
      // untiered spaces. A category without pricing_tiers behaves exactly
      // as before (tierKey stays null, basePrice comes from category.price).
      const pricingTiers = typeof category.pricing_tiers === 'string'
        ? JSON.parse(category.pricing_tiers) : category.pricing_tiers;
      let tierKey = null;
      let basePrice;
      if (Array.isArray(pricingTiers) && pricingTiers.length > 0) {
        const chosenTier = pricingTiers.find((t) => t.key === selection.tierKey);
        if (!chosenTier) {
          return res.status(400).json({
            error: `This ad space sells in tiers — pick one of: ${pricingTiers.map((t) => t.key).join(', ')}.`,
          });
        }
        const tierCounts = await AdCategory.countActiveAdsByTier(categoryId);
        if ((tierCounts[chosenTier.key] || 0) >= chosenTier.maxSlots) {
          return res.status(409).json({ error: `The "${chosenTier.label}" tier for this ad space is fully booked. Pick a different tier.` });
        }
        tierKey = chosenTier.key;
        basePrice = parseFloat(chosenTier.price);
      } else {
        basePrice = parseFloat(category.price);
      }
      // Margin direction depends on who set the price. For every
      // system-computed price (Elite, Current, untiered/Starter — anything
      // the owner never typed themselves) listedPrice is the owner's 100%
      // cut and the margin is added ON TOP for the advertiser, same as
      // always. The "custom" tier is the one number an owner actually types
      // in and expects to see honored literally — so for that one, the
      // typed price IS what the advertiser sees and pays, and Yepper's cut
      // comes OUT of it instead: the owner's wallet credit (listedPrice) is
      // the derived, smaller figure this time. Either way the wallet only
      // ever gets credited listedPrice; see the metadata.listedPrice read at
      // every "payment succeeded" site — that code doesn't need to know
      // which direction produced it.
      let listedPrice, chargedPrice;
      if (tierKey === 'custom') {
        chargedPrice = basePrice * priceMultiplier;
        listedPrice  = chargedPrice * (1 - marginPercent / 100);
      } else {
        listedPrice  = basePrice * priceMultiplier;
        chargedPrice = listedPrice * (1 + marginPercent / 100);
      }

      totalAmount += chargedPrice;
      validatedSelections.push({
        websiteId,
        categoryId,
        webOwnerId: website.owner_id,
        price: chargedPrice,
        listedPrice,
        categoryName: category.category_name,
        websiteName: website.website_name,
        selectedPages,
        tierKey,
      });
      categoryDetails.push({
        categoryName: category.category_name,
        websiteName: website.website_name,
        price: chargedPrice,
        webOwnerId: website.owner_id,
      });
    }

    if (validatedSelections.length === 0) {
      return res.status(400).json({ error: 'All selected placements are already paid for' });
    }

    const baseReference = `bulk_${adId}_${Date.now()}`;
    const tx_ref = `${baseReference}_flw`;

    for (let index = 0; index < validatedSelections.length; index++) {
      const selection = validatedSelections[index];
      await Payment.create({
        paymentId: `${baseReference}_${index}`,
        tx_ref: index === 0 ? tx_ref : `${baseReference}_${index}`,
        baseReference,
        adId,
        advertiserId: userId,
        webOwnerId: selection.webOwnerId,
        websiteId: selection.websiteId,
        categoryId: selection.categoryId,
        amount: selection.price,
        currency: 'RWF',
        status: 'pending',
        metadata: {
          bulkPaymentIndex: index,
          totalInGroup: validatedSelections.length,
          isGroupPayment: true,
          categoryName: selection.categoryName,
          websiteName: selection.websiteName,
          selectedPages: selection.selectedPages,
          tierKey: selection.tierKey,
          // The owner's 100% cut — wallet crediting reads this, not
          // `amount` (which includes Yepper's margin on top).
          listedPrice: selection.listedPrice,
        },
      });
    }

    res.status(200).json({
      success: true,
      baseReference,
      tx_ref,
      totalAmount,
      selectionsCount: validatedSelections.length,
      categoryDetails,
      sandboxMode: FLW_TEST_MODE,
    });
  } catch (error) {
    console.error('Bulk payment initiation error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ─── verifyPayment ─────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.body;
    const identifier = transaction_id || tx_ref;
    if (!identifier) return res.status(400).json({ error: 'Transaction ID or reference required' });

    // Check DB first — if webhook already processed this, return success immediately
    // without re-querying Flutterwave (avoids 400 race condition in sandbox/live)
    let earlyCheck = null;
    if (transaction_id) earlyCheck = await Payment.findByPaymentId(String(transaction_id));
    if (!earlyCheck && tx_ref) earlyCheck = await Payment.findByTxRef(tx_ref);
    if (earlyCheck?.status === 'successful') {
      return res.status(200).json({ success: true, message: 'Payment already processed successfully', payment: earlyCheck });
    }

    const flwResponse = await verifyFlutterwaveTransaction(identifier);
    const flwData = flwResponse.data;

    if (flwResponse.status === 'success' && flwData?.status === 'successful') {
      let primaryPayment = await Payment.findByTxRef(flwData.tx_ref || identifier);
      if (!primaryPayment) primaryPayment = await Payment.findByPaymentId(String(flwData.id || identifier));
      if (!primaryPayment) return res.status(404).json({ error: 'Payment record not found' });
      if (primaryPayment.status === 'successful') {
        return res.status(200).json({ success: true, message: 'Payment already processed', payment: primaryPayment });
      }

      const allPayments = await Payment.findByBaseReference(primaryPayment.base_reference);
      const client = await getClient();
      try {
        await client.query('BEGIN');

        const ad = await client.query(`SELECT * FROM import_ads WHERE id = $1`, [primaryPayment.ad_id]);
        if (!ad.rows[0]) throw new Error('Ad not found');
        const adRow = ad.rows[0];
        const websiteSelections = parseSelections(adRow);

        const advertiser = await Creator.findById(primaryPayment.advertiser_id);
        const totalAmount = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        await upsertWallet(client, primaryPayment.advertiser_id, 'advertiser', advertiser?.email, 0, 0, totalAmount);

        const rejectionDeadline = new Date();
        rejectionDeadline.setMinutes(rejectionDeadline.getMinutes() + 2);

        for (const payment of allPayments) {
          await client.query(
            `UPDATE payments SET status = 'successful', paid_at = NOW(), payment_id = $1, flutterwave_data = $2 WHERE id = $3`,
            [`${flwData.id}_${payment.id}`, JSON.stringify(flwData), payment.id]
          );

          const category = await AdCategory.findById(payment.category_id);
          const website = await Website.findById(payment.website_id);
          if (!category || !website) continue;

          const selIdx = websiteSelections.findIndex(
            (sel) => sel.websiteId === payment.website_id &&
              Array.isArray(sel.categories) && sel.categories.includes(payment.category_id)
          );

          // Keyed by categoryId since one website_selections entry can cover
          // several categories bought on the same site — selectedPages only
          // applies to the specific "All Pages" ad space this payment is for.
          const selectedPagesForThisCategory = payment.metadata?.selectedPages || null;

          if (selIdx !== -1) {
            Object.assign(websiteSelections[selIdx], {
              status: 'active', approved: true, approvedAt: new Date().toISOString(),
              publishedAt: new Date().toISOString(), paymentId: payment.id,
              rejectionDeadline: rejectionDeadline.toISOString(),
              pagesByCategory: {
                ...(websiteSelections[selIdx].pagesByCategory || {}),
                [payment.category_id]: selectedPagesForThisCategory,
              },
            });
          } else {
            websiteSelections.push({
              websiteId: payment.website_id, categories: [payment.category_id],
              approved: true, approvedAt: new Date().toISOString(),
              publishedAt: new Date().toISOString(), paymentId: payment.id,
              status: 'active', rejectionDeadline: rejectionDeadline.toISOString(),
              pagesByCategory: { [payment.category_id]: selectedPagesForThisCategory },
            });
          }

          await client.query(
            `UPDATE ad_categories SET selected_ads = array_append(COALESCE(selected_ads, ARRAY[]::uuid[]), $1)
             WHERE id = $2 AND NOT ($1 = ANY(COALESCE(selected_ads, ARRAY[]::uuid[])))`,
            [payment.ad_id, payment.category_id]
          );

          // Multi-tier ad spaces: record which tier this ad bought into, so
          // rotation/fill-checking knows which Shared/Featured/Exclusive
          // bucket it belongs to. No-op (stays untouched) for ordinary
          // single-price spaces, where tierKey is never set at checkout.
          if (payment.metadata?.tierKey) {
            await client.query(
              `UPDATE ad_categories SET ad_tier_assignments = ad_tier_assignments || jsonb_build_object($1::text, $2::text)
               WHERE id = $3`,
              [payment.ad_id, payment.metadata.tierKey, payment.category_id]
            );
          }

          const webOwnerEmail = category.web_owner_email;
          // Owner gets credited their listed (100%) price, not payment.amount
          // — amount includes Yepper's margin on top, which the advertiser
          // paid but the owner never sees. Falls back to payment.amount for
          // payments created before this split existed (metadata.listedPrice
          // absent), so nothing old silently under-credits to zero.
          const ownerCredit = parseFloat(payment.metadata?.listedPrice ?? payment.amount);
          const wallet = await client.query(
            `INSERT INTO wallets (owner_id, owner_type, owner_email, balance, total_earned, total_spent, last_updated)
             VALUES ($1, 'webOwner', $2, $3, $3, 0, NOW())
             ON CONFLICT (owner_id, owner_type) DO UPDATE SET
               balance = wallets.balance + $3, total_earned = wallets.total_earned + $3, last_updated = NOW()
             RETURNING *`,
            [website.owner_id, webOwnerEmail || '', ownerCredit]
          );

          await client.query(
            `INSERT INTO wallet_transactions (wallet_id, payment_id, ad_id, amount, type, description, status)
             VALUES ($1, $2, $3, $4, 'credit', $5, 'completed')`,
            [wallet.rows[0].id, payment.id, payment.ad_id, ownerCredit,
             `Payment for ad: ${adRow.business_name} - ${category.category_name}`]
          );
        }

        await client.query(
          `UPDATE import_ads SET website_selections = $1, confirmed = true WHERE id = $2`,
          [JSON.stringify(websiteSelections), adRow.id]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      res.status(200).json({
        success: true,
        message: `Payment verified and ${allPayments.length} ad placements published successfully`,
        paymentsProcessed: allPayments.length,
      });
    } else {
      const failedPayment = await Payment.findByTxRef(identifier);
      if (failedPayment?.base_reference) {
        const grouped = await Payment.findByBaseReference(failedPayment.base_reference);
        for (const p of grouped) {
          await Payment.update(p.id, { status: 'failed' });
        }
      }
      res.status(400).json({ success: false, message: 'Payment verification failed', details: flwData });
    }
  } catch (error) {
    console.error('Bulk payment verification error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ─── verifyPaymentNonTransactional ─────────────────────────────────────────
exports.verifyPaymentNonTransactional = async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.body;
    const identifier = transaction_id || tx_ref;
    if (!identifier) return res.status(400).json({ error: 'Transaction ID or reference required' });

    const flwResponse = await verifyFlutterwaveTransaction(identifier);
    const flwData = flwResponse.data;

    if (flwResponse.status === 'success' && flwData?.status === 'successful') {
      let payment = await Payment.findByTxRef(flwData.tx_ref || identifier);
      if (!payment) payment = await Payment.findByPaymentId(String(flwData.id || identifier));
      if (!payment) return res.status(404).json({ error: 'Payment record not found' });
      if (payment.status === 'successful')
        return res.status(200).json({ success: true, message: 'Payment already processed', payment });

      const updated = await Payment.update(payment.id, {
        paymentId: String(flwData.id || identifier),
        status: 'successful',
        paidAt: new Date(),
        flutterwaveData: flwData,
      });

      if (!updated) return res.status(404).json({ error: 'Payment update failed' });

      try {
        const ad = await ImportAd.findById(payment.ad_id);
        if (ad) {
          const websiteSelections = parseSelections(ad);
          const selIdx = websiteSelections.findIndex(
            (sel) => sel.websiteId === payment.website_id &&
              Array.isArray(sel.categories) && sel.categories.includes(payment.category_id)
          );
          const rejectionDeadline = new Date();
          rejectionDeadline.setMinutes(rejectionDeadline.getMinutes() + 2);
          if (selIdx !== -1) {
            Object.assign(websiteSelections[selIdx], {
              status: 'active', approved: true, approvedAt: new Date().toISOString(),
              publishedAt: new Date().toISOString(), paymentId: payment.id,
              rejectionDeadline: rejectionDeadline.toISOString(),
            });
          } else {
            websiteSelections.push({
              websiteId: payment.website_id, categories: [payment.category_id],
              approved: true, approvedAt: new Date().toISOString(),
              publishedAt: new Date().toISOString(), paymentId: payment.id,
              status: 'active', rejectionDeadline: rejectionDeadline.toISOString(),
            });
          }
          await ImportAd.update(ad.id, { websiteSelections, confirmed: true });
        }

        const advertiser = await Creator.findById(payment.advertiser_id);
        if (advertiser) {
          await Wallet.create({ ownerId: payment.advertiser_id, ownerEmail: advertiser.email, ownerType: 'advertiser' });
          const w = await Wallet.findByOwner(payment.advertiser_id, 'advertiser');
          if (w) await Wallet.update(w.id, { totalSpent: w.total_spent + parseFloat(payment.amount) });
        }

        const category = await AdCategory.findById(payment.category_id);
        const website = await Website.findById(payment.website_id);
        if (website) {
          const ownerEmail = category?.web_owner_email;
          // Owner's listed (100%) price, not payment.amount — see the same
          // note in verifyPayment above.
          const ownerCredit = parseFloat(payment.metadata?.listedPrice ?? payment.amount);
          const ww = await Wallet.create({ ownerId: website.owner_id, ownerEmail: ownerEmail || '', ownerType: 'webOwner' });
          const ownerWallet = await Wallet.findByOwner(website.owner_id, 'webOwner');
          if (ownerWallet) {
            await Wallet.update(ownerWallet.id, {
              balance: ownerWallet.balance + ownerCredit,
              totalEarned: ownerWallet.total_earned + ownerCredit,
            });
            await WalletTransaction.create({
              walletId: ownerWallet.id, paymentId: payment.id, adId: payment.ad_id,
              amount: ownerCredit, type: 'credit',
              description: `Payment for ad: ${ad?.business_name || 'Unknown'} on category: ${category?.category_name || 'Unknown'}`,
            });
          }
        }
      } catch (updateError) {
        console.error('Post-payment update error:', updateError);
      }

      res.status(200).json({ success: true, message: 'Payment verified and ad published successfully', payment: updated });
    } else {
      const failed = await Payment.findByTxRef(identifier);
      if (failed) await Payment.update(failed.id, { status: 'failed' });
      res.status(400).json({ success: false, message: 'Payment verification failed', details: flwData });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ─── generateFlutterwavePaymentUrl ────────────────────────────────────────
exports.generateFlutterwavePaymentUrl = async (paymentData) => {
  try {
    if (!FLW_TEST_SECRET_KEY) throw new Error('Flutterwave API key not configured.');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return await createFlutterwaveLink({
      tx_ref: paymentData.tx_ref,
      amount: paymentData.amount,
      currency: 'RWF',
      redirect_url: `${frontendUrl}${paymentData.redirectPath || '/payment-callback2'}`,
      customer: paymentData.customer,
      description: paymentData.customizations?.description || 'Ad payment',
    });
  } catch (error) {
    console.error('Flutterwave payment URL generation error:', error.response?.data || error.message);
    if (error.response?.status === 401) throw new Error('Flutterwave authentication failed.');
    if (error.response?.status === 400) throw new Error('Invalid payment data.');
    throw new Error('Payment URL generation failed. Please try again later.');
  }
};

exports.generateXentriPayPaymentUrl = exports.generateFlutterwavePaymentUrl;

// ─── handleProcessWallet ───────────────────────────────────────────────────
exports.handleProcessWallet = async (req, res) => {
  const client = await getClient();
  try {
    const { selections, isReassignment = false } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;

    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: 'No selections provided' });
    }

    const wallet = await Wallet.findByOwner(userId, 'advertiser');
    const walletBalance = wallet ? parseFloat(wallet.balance) : 0;

    // Same margin split as initiatePayment: the advertiser's wallet is
    // charged listedPrice + margin, the owner is only ever credited
    // listedPrice. See Pricing.getSettings() / the note there for why this
    // isn't the "drops for top performers" version yet.
    const { marginPercent } = await Pricing.getSettings();

    let totalCost = 0;
    const processedSelections = [];

    for (const selection of selections) {
      const ad = await ImportAd.findById(selection.adId);
      const category = await AdCategory.findById(selection.categoryId);
      const website = await Website.findById(selection.websiteId);

      if (!ad) return res.status(404).json({ error: 'Ad not found', adId: selection.adId });
      if (!category) return res.status(404).json({ error: 'Category not found', categoryId: selection.categoryId });
      if (!website) return res.status(404).json({ error: 'Website not found', websiteId: selection.websiteId });
      if (ad.user_id !== userId) return res.status(403).json({ error: 'Unauthorized access to ad' });

      const listedPrice = parseFloat(category.price) || 0;
      const price = listedPrice * (1 + marginPercent / 100);
      totalCost += price;
      processedSelections.push({ ...selection, ad, category, website, price, listedPrice });
    }

    const buildPaymentUrl = async (amount, baseRef, customerEmail, customerName, desc) => {
      return await exports.generateFlutterwavePaymentUrl({
        tx_ref: baseRef, amount,
        customer: { email: customerEmail, name: customerName || 'User' },
        customizations: { description: desc },
      });
    };

    // Hybrid or wallet-only for reassignment
    if (isReassignment && walletBalance < totalCost) {
      const walletToUse = Math.min(walletBalance, totalCost);
      const remainingAmount = totalCost - walletToUse;
      const baseHybridRef = generateUniqueTransactionRef('hybrid_reassignment_base', userId, `${selections.length}_${totalCost}`);

      for (let i = 0; i < processedSelections.length; i++) {
        const sel = processedSelections[i];
        const individualTxRef = generateUniqueTransactionRef('hybrid_reassignment_item', userId, `${sel.adId}_${sel.categoryId}_${i}`);
        await Payment.create({
          advertiserId: userId, tx_ref: individualTxRef, baseReference: baseHybridRef,
          amount: sel.price, paymentType: 'hybrid_reassignment', status: 'pending',
          adId: sel.adId, websiteId: sel.websiteId, categoryId: sel.categoryId,
          webOwnerId: sel.category.owner_id, paymentId: `pending_${individualTxRef}`,
          isReassignment: true, walletApplied: walletToUse * (sel.price / totalCost),
          amountPaid: remainingAmount * (sel.price / totalCost),
          metadata: { selectionIndex: i, totalSelections: processedSelections.length, hybridPayment: true, listedPrice: sel.listedPrice },
        });
      }

      const paymentUrl = await buildPaymentUrl(remainingAmount, baseHybridRef, req.user.email, req.user.name, `Reassignment for ${processedSelections.length} categories`);
      return res.status(200).json({
        success: true, allPaid: false,
        message: `${walletToUse.toFixed(2)} from wallet. Pay ${remainingAmount.toFixed(2)} via card/MoMo.`,
        summary: { totalCost, walletUsed: walletToUse, cardAmount: remainingAmount, refundUsed: 0, isReassignment: true },
        paymentUrl, tx_ref: baseHybridRef, paymentCount: processedSelections.length,
      });
    }

    if (!isReassignment && walletBalance < totalCost) {
      const availableRefunds = await getAllAvailableRefunds(userId);
      const walletToUse = Math.min(walletBalance, totalCost);
      const remainingAfterWallet = totalCost - walletToUse;
      const refundToUse = Math.min(availableRefunds, remainingAfterWallet);
      const remainingAmount = remainingAfterWallet - refundToUse;
      const baseHybridRef = generateUniqueTransactionRef('hybrid_base', userId, `${selections.length}_${totalCost}`);

      for (let i = 0; i < processedSelections.length; i++) {
        const sel = processedSelections[i];
        const individualTxRef = generateUniqueTransactionRef('hybrid_item', userId, `${sel.adId}_${sel.categoryId}_${i}`);
        await Payment.create({
          advertiserId: userId, tx_ref: individualTxRef, baseReference: baseHybridRef,
          amount: sel.price, paymentType: 'hybrid', status: 'pending',
          adId: sel.adId, websiteId: sel.websiteId, categoryId: sel.categoryId,
          webOwnerId: sel.category.owner_id, paymentId: `pending_${individualTxRef}`,
          isReassignment: false, walletApplied: walletToUse * (sel.price / totalCost),
          refundApplied: refundToUse * (sel.price / totalCost),
          amountPaid: remainingAmount * (sel.price / totalCost),
          metadata: { selectionIndex: i, totalSelections: processedSelections.length, hybridPayment: true, listedPrice: sel.listedPrice },
        });
      }

      const paymentUrl = await buildPaymentUrl(remainingAmount, baseHybridRef, req.user.email, req.user.name, `Payment for ${processedSelections.length} categories`);
      return res.status(200).json({
        success: true, allPaid: false,
        message: `${(walletToUse + refundToUse).toFixed(2)} applied. Pay ${remainingAmount.toFixed(2)} via card/MoMo.`,
        summary: { totalCost, walletUsed: walletToUse, cardAmount: remainingAmount, refundUsed: refundToUse, isReassignment: false },
        paymentUrl, tx_ref: baseHybridRef, paymentCount: processedSelections.length,
      });
    }

    // Full wallet payment
    const baseWalletRef = generateUniqueTransactionRef(isReassignment ? 'wallet_reassignment_base' : 'wallet_base', userId, `${selections.length}_${totalCost}`);

    await client.query('BEGIN');
    try {
      if (wallet) {
        await client.query(
          `UPDATE wallets SET balance = balance - $1, total_spent = total_spent + $1, last_updated = NOW() WHERE id = $2`,
          [totalCost, wallet.id]
        );
      }

      for (let i = 0; i < processedSelections.length; i++) {
        const sel = processedSelections[i];
        const individualTxRef = generateUniqueTransactionRef(
          isReassignment ? 'wallet_reassignment_item' : 'wallet_item',
          userId, `${sel.adId}_${sel.categoryId}_${i}`
        );
        await Payment.create({
          advertiserId: userId, tx_ref: individualTxRef, baseReference: baseWalletRef,
          amount: sel.price, paymentType: isReassignment ? 'wallet_reassignment' : 'wallet',
          status: 'successful', adId: sel.adId, websiteId: sel.websiteId,
          categoryId: sel.categoryId, webOwnerId: sel.category.owner_id,
          paymentId: individualTxRef, isReassignment, walletApplied: sel.price,
          amountPaid: 0, paidAt: new Date(),
          metadata: { selectionIndex: i, totalSelections: processedSelections.length, fullWalletPayment: true, listedPrice: sel.listedPrice },
        });

        const adRow = await ImportAd.findById(sel.adId);
        if (adRow) {
          const wsArr = parseSelections(adRow);
          const selIdx = wsArr.findIndex(s => s.websiteId === sel.websiteId && Array.isArray(s.categories) && s.categories.includes(sel.categoryId));
          if (selIdx !== -1) {
            wsArr[selIdx] = { ...wsArr[selIdx], approved: true, approvedAt: new Date().toISOString(), status: 'active', publishedAt: new Date().toISOString() };
          }
          await client.query(`UPDATE import_ads SET website_selections = $1 WHERE id = $2`, [JSON.stringify(wsArr), sel.adId]);
        }

        await client.query(
          `UPDATE ad_categories SET selected_ads = array_append(COALESCE(selected_ads, ARRAY[]::uuid[]), $1)
           WHERE id = $2 AND NOT ($1 = ANY(COALESCE(selected_ads, ARRAY[]::uuid[])))`,
          [sel.adId, sel.categoryId]
        );
        // NOTE: this wallet-payment path doesn't resolve a tier price yet
        // (see initiatePayment for that) — sel.tierKey is never set today,
        // so this is a no-op until wallet checkout gains tier support too.
        if (sel.tierKey) {
          await client.query(
            `UPDATE ad_categories SET ad_tier_assignments = ad_tier_assignments || jsonb_build_object($1::text, $2::text) WHERE id = $3`,
            [sel.adId, sel.tierKey, sel.categoryId]
          );
        }

        await client.query(
          `INSERT INTO wallets (owner_id, owner_type, owner_email, balance, total_earned, total_spent, last_updated)
           VALUES ($1, 'webOwner', $2, $3, $3, 0, NOW())
           ON CONFLICT (owner_id, owner_type) DO UPDATE SET balance = wallets.balance + $3, total_earned = wallets.total_earned + $3, last_updated = NOW()`,
          [sel.category.owner_id, sel.category.web_owner_email || '', sel.listedPrice]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const updatedWallet = await Wallet.findByOwner(userId, 'advertiser');
    res.status(200).json({
      success: true, allPaid: true,
      message: `All payments processed via wallet. Remaining: ${parseFloat(updatedWallet?.balance || 0).toFixed(2)}`,
      summary: { totalCost, walletUsed: totalCost, cardAmount: 0, refundUsed: 0, isReassignment, remainingBalance: updatedWallet?.balance || 0 },
      tx_ref: baseWalletRef, paymentCount: processedSelections.length,
    });
  } catch (error) {
    console.error('Handle process wallet error:', error);
    res.status(500).json({ error: 'Wallet payment failed', message: error.message });
  } finally {
    client.release();
  }
};

// ─── calculatePaymentBreakdown ─────────────────────────────────────────────
exports.calculatePaymentBreakdown = async (req, res) => {
  try {
    const { selections, isReassignment = false } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;
    if (!selections || !Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: 'No selections provided' });
    }

    const wallet = await Wallet.findByOwner(userId, 'advertiser');
    const walletBalance = wallet ? parseFloat(wallet.balance) : 0;
    const availableRefunds = isReassignment ? 0 : await getAllAvailableRefunds(userId);

    let totalCost = 0;
    const categoryDetails = [];
    for (const selection of selections) {
      const category = await AdCategory.findById(selection.categoryId);
      const website = await Website.findById(selection.websiteId);
      if (category && website) {
        const price = parseFloat(category.price) || 0;
        totalCost += price;
        categoryDetails.push({ ...selection, price, categoryName: category.category_name, websiteName: website.website_name });
      }
    }

    let paidFromWallet = 0, paidFromRefunds = 0, needsExternalPayment = 0;
    if (isReassignment) {
      paidFromWallet = Math.min(walletBalance, totalCost);
      needsExternalPayment = Math.max(0, totalCost - walletBalance);
    } else {
      if (walletBalance >= totalCost) {
        paidFromWallet = totalCost;
      } else {
        paidFromWallet = walletBalance;
        const remaining = totalCost - walletBalance;
        paidFromRefunds = Math.min(availableRefunds, remaining);
        needsExternalPayment = remaining - paidFromRefunds;
      }
    }

    res.status(200).json({
      success: true,
      breakdown: categoryDetails,
      summary: {
        totalCost, walletBalance, availableRefunds: isReassignment ? 0 : availableRefunds,
        paidFromWallet, paidFromRefunds: isReassignment ? 0 : paidFromRefunds,
        needsExternalPayment, canAffordAll: needsExternalPayment === 0, isReassignment,
        paymentGateway: 'Flutterwave', sandboxMode: FLW_TEST_MODE,
      },
    });
  } catch (error) {
    console.error('Payment breakdown error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ─── initiatePaymentWithRefund ─────────────────────────────────────────────
exports.initiatePaymentWithRefund = async (req, res) => {
  try {
    const { adId, websiteId, categoryId, useRefundOnly = false, expectedRefund = 0, isReassignment = false } = req.body;
    const userId = req.user.userId || req.user.id || req.user._id;

    const ad = await ImportAd.findById(adId);
    const category = await AdCategory.findById(categoryId);
    const website = await Website.findById(websiteId);
    if (!ad || !category || !website)
      return res.status(404).json({ error: 'Ad, category, or website not found' });
    if (ad.user_id !== userId)
      return res.status(403).json({ error: 'Unauthorized access to ad' });
    if (isReassignment && (useRefundOnly || expectedRefund > 0))
      return res.status(400).json({ error: 'Refunds not allowed for reassignment', code: 'REFUND_NOT_ALLOWED_FOR_REASSIGNMENT' });

    const wallet = await Wallet.findByOwner(userId, 'advertiser');
    const walletBalance = wallet ? parseFloat(wallet.balance) : 0;
    // Same margin split as initiatePayment — listedPrice is the owner's
    // 100% cut, categoryPrice is what the advertiser actually owes.
    const { marginPercent } = await Pricing.getSettings();
    const listedPrice   = parseFloat(category.price);
    const categoryPrice = listedPrice * (1 + marginPercent / 100);
    let walletForThis = isReassignment ? Math.min(walletBalance, categoryPrice) : 0;
    let refundForThis = (!isReassignment && useRefundOnly && expectedRefund > 0)
      ? Math.min(expectedRefund, await getAllAvailableRefunds(userId), categoryPrice) : 0;
    let remainingAmount = Math.max(0, categoryPrice - walletForThis - refundForThis);
    const tx_ref = generateUniqueTransactionRef('flw', userId, adId + '_' + categoryId);

    if (remainingAmount <= 0.01) {
      const payment = await Payment.create({
        paymentId: tx_ref, tx_ref, adId, advertiserId: userId,
        webOwnerId: website.owner_id, websiteId, categoryId,
        amount: categoryPrice, currency: 'RWF', status: 'successful',
        walletApplied: walletForThis, refundApplied: isReassignment ? 0 : refundForThis,
        amountPaid: 0, paymentMethod: walletForThis > 0 ? 'wallet_only' : 'refund_only',
        isReassignment, paidAt: new Date(),
        metadata: { listedPrice },
      });
      return res.status(200).json({ success: true, allPaid: true, paymentId: payment.id, tx_ref, walletApplied: walletForThis, refundApplied: isReassignment ? 0 : refundForThis, amountPaid: 0, totalCost: categoryPrice });
    }

    const paymentUrl = await exports.generateFlutterwavePaymentUrl({
      tx_ref, amount: remainingAmount,
      customer: { email: ad.ad_owner_email, name: ad.business_name },
      customizations: { description: `Ad space: ${category.category_name} on ${website.website_name}` },
    });

    const payment = await Payment.create({
      paymentId: tx_ref, tx_ref, adId, advertiserId: userId,
      webOwnerId: website.owner_id, websiteId, categoryId,
      amount: categoryPrice, currency: 'RWF', status: 'pending',
      flutterwaveData: { paymentUrl }, walletApplied: walletForThis,
      refundApplied: isReassignment ? 0 : refundForThis, amountPaid: remainingAmount,
      paymentMethod: walletForThis > 0 ? 'wallet_hybrid' : refundForThis > 0 ? 'refund_hybrid' : 'flutterwave',
      isReassignment,
      metadata: { listedPrice },
    });

    res.status(200).json({ success: true, paymentUrl, paymentId: payment.id, tx_ref, walletApplied: walletForThis, refundApplied: isReassignment ? 0 : refundForThis, amountPaid: remainingAmount, totalCost: categoryPrice, isReassignment });
  } catch (error) {
    console.error('initiatePaymentWithRefund error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

// ─── handleWebhook ─────────────────────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
  try {
    const secretHash = process.env.FLW_SECRET_HASH;
    const signature = req.headers['verif-hash'];
    if (secretHash && (!signature || signature !== secretHash)) {
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }
    const payload = req.body;
    const event = payload.event || payload['event.type'];
    const data = payload.data || payload;

    if (event === 'charge.completed' || event === 'CARD_TRANSACTION') {
      if (data?.status === 'successful') {
        // YouTube ad-slot claims are verified through their own dedicated
        // endpoint (youtubeClaimPaymentController.verifyClaimPayment), which
        // the advertiser's browser hits on redirect back from checkout —
        // verifyPayment below doesn't know about youtube_ad_claims, so skip it
        // here rather than have it error out on a payment shaped differently
        // from the website-ad flow it expects.
        const existing = data.tx_ref ? await Payment.findByTxRef(data.tx_ref) : null;
        if (existing?.metadata?.kind === 'youtube_claim') {
          return res.status(200).json({ status: 'acknowledged', event, kind: 'youtube_claim' });
        }
        const fakeReq = { body: { transaction_id: String(data.id), tx_ref: data.tx_ref } };
        const fakeRes = { status: (code) => ({ json: (d) => console.log(`Webhook verify result ${code}:`, d) }) };
        await exports.verifyPayment(fakeReq, fakeRes);
      } else {
        const reference = data?.tx_ref;
        if (reference) {
          const p = await Payment.findByTxRef(reference);
          if (p) await Payment.update(p.id, { status: 'failed' });
        }
      }
      return res.status(200).json({ status: 'success', event });
    }
    res.status(200).json({ status: 'acknowledged', event });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// ─── Misc endpoints ────────────────────────────────────────────────────────
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const wallet = await Wallet.findByOwner(userId, 'advertiser');
    res.status(200).json({ success: true, walletBalance: wallet ? parseFloat(wallet.balance) : 0, hasWallet: !!wallet });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.getRefundCredits = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const refunds = await Payment.findAvailableRefunds(userId);
    const total = refunds.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    res.status(200).json({ success: true, totalAvailableRefunds: total, refundDetails: refunds, refundCount: refunds.length });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

exports.getAdvertiserRefundBalance = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id || req.user._id;
    const refundDetails = await Payment.findRefundsByAdvertiser(userId);
    const total = refundDetails.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    res.status(200).json({
      success: true, totalAvailableRefunds: total, refundCount: refundDetails.length,
      refundDetails: refundDetails.map(p => ({
        paymentId: p.id, amount: p.amount, refundedAt: p.refunded_at,
        refundReason: p.refund_reason, businessName: p.ad_business_name || 'Unknown Business',
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.validateCategoryData = async (req, res) => {
  try {
    const { categoryId, websiteId } = req.body;
    const [category, website] = await Promise.all([AdCategory.findById(categoryId), Website.findById(websiteId)]);
    if (!category) return res.status(404).json({ error: 'Category not found', categoryId });
    if (!website) return res.status(404).json({ error: 'Website not found', websiteId });
    const validation = {
      isValid: true, errors: [],
      data: { categoryId: category.id, categoryName: category.category_name, price: category.price, websiteId: website.id, websiteName: website.website_name },
    };
    if (!category.category_name) { validation.isValid = false; validation.errors.push('Category name missing'); }
    if (!category.price || category.price <= 0) { validation.isValid = false; validation.errors.push(`Invalid price: ${category.price}`); }
    if (!website.website_name) { validation.isValid = false; validation.errors.push('Website name missing'); }
    res.status(200).json(validation);
  } catch (error) {
    res.status(500).json({ error: 'Validation failed', message: error.message });
  }
};

exports.completeAdPlacement = async (adId, websiteId, categoryId, paymentId, client, tierKey) => {
  const ad = await ImportAd.findById(adId);
  const category = await AdCategory.findById(categoryId);
  const website = await Website.findById(websiteId);
  const websiteSelections = parseSelections(ad);
  const selIdx = websiteSelections.findIndex(sel => sel.websiteId === websiteId && Array.isArray(sel.categories) && sel.categories.includes(categoryId));
  const rejectionDeadline = new Date();
  rejectionDeadline.setMinutes(rejectionDeadline.getMinutes() + 2);

  if (selIdx !== -1) {
    Object.assign(websiteSelections[selIdx], { status: 'active', approved: true, approvedAt: new Date().toISOString(), publishedAt: new Date().toISOString(), paymentId, rejectionDeadline: rejectionDeadline.toISOString(), isRejected: false });
  } else {
    websiteSelections.push({ websiteId, categories: [categoryId], approved: true, approvedAt: new Date().toISOString(), publishedAt: new Date().toISOString(), paymentId, status: 'active', rejectionDeadline: rejectionDeadline.toISOString(), isRejected: false });
  }

  await client.query(`UPDATE import_ads SET website_selections = $1, available_for_reassignment = false WHERE id = $2`, [JSON.stringify(websiteSelections), adId]);
  await client.query(`UPDATE ad_categories SET selected_ads = array_append(COALESCE(selected_ads, ARRAY[]::uuid[]), $1) WHERE id = $2 AND NOT ($1 = ANY(COALESCE(selected_ads, ARRAY[]::uuid[])))`, [adId, categoryId]);
  if (tierKey) {
    await client.query(
      `UPDATE ad_categories SET ad_tier_assignments = ad_tier_assignments || jsonb_build_object($1::text, $2::text) WHERE id = $3`,
      [adId, tierKey, categoryId]
    );
  }

  await client.query(
    `INSERT INTO wallets (owner_id, owner_type, owner_email, balance, total_earned, total_spent, last_updated)
     VALUES ($1, 'webOwner', $2, $3, $3, 0, NOW())
     ON CONFLICT (owner_id, owner_type) DO UPDATE SET balance = wallets.balance + $3, total_earned = wallets.total_earned + $3, last_updated = NOW()`,
    [website.owner_id, category.web_owner_email || '', parseFloat(category.price)]
  );
};

exports.debugRoutes = (req, res) => {
  res.json({ success: true, message: 'Payment routes are working (Flutterwave)', paymentGateway: 'Flutterwave', sandboxMode: FLW_TEST_MODE });
};