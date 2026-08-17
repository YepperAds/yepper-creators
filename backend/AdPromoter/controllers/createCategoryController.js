// createCategoryController.js  — PostgreSQL version (no Mongoose)
const { query, getClient } = require('../../config/db');
const AdCategory          = require('../models/CreateCategoryModel');
const { generateSiteScript } = require('./SiteScriptController');
const { Wallet, WalletTransaction } = require('../models/walletModel');
const User    = require('../../models/User');
const ImportAd = require('../../AdOwner/models/WebAdvertiseModel');
const Website = require('../models/CreateWebsiteModel');
const WebOwnerBalance = require('../models/WebOwnerBalanceModel');
const Payment = require('../../AdOwner/models/PaymentModel');
const Pricing = require('../../models/PricingModel');
const { getDimensions } = require('../utils/adSpaceLayout');
const sendEmailNotification = require('../../controllers/emailService');
const { getSessionUserId } = require('../../creators/controllers/adSpaceController');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Mirrors app/_lib/ad-spaces.ts's AD_SPACE_IMAGES/AD_SPACE_DESCRIPTIONS: same
// mockup images and fallback copy the dashboard shows, used here so an invite
// email shows the recipient the real placement instead of a generic banner.
// Video-only placements (pre-roll/mid-roll/pause) are YouTube ad spaces, not
// website ones, so they're deliberately not included.
const AD_SPACE_IMAGES = {
  'header':          '/ad-spaces/header.png',
  'above the fold':  '/ad-spaces/above-the-fold.png',
  'sticky sidebar':  '/ad-spaces/sticky-sidebar.png',
  'floating':        '/ad-spaces/floating.png',
  'modal':           '/ad-spaces/modal.png',
  'left rail':       '/ad-spaces/left-rail.png',
  'sidebar':         '/ad-spaces/sidebar.png',
  'inline content':  '/ad-spaces/inline-content.png',
  'beneath title':   '/ad-spaces/beneath-title.png',
  'pro footer':      '/ad-spaces/pro-footer.png',
};

const AD_SPACE_DESCRIPTIONS = {
  'header':          'Banner across the top of the page',
  'above the fold':  'Visible before the visitor scrolls',
  'sticky sidebar':  'Sidebar ad that follows as you scroll',
  'floating':        'Floats on screen as you scroll',
  'modal':           'Pop-up ad in its own window',
  'left rail':       'Ad along the left edge of the page',
  'sidebar':         'Ad in the side column',
  'inline content':  'Placed inside the article text',
  'beneath title':   'Just below the page title',
  'pro footer':      'Premium spot in the footer',
};

function lookupAdSpace(map, spaceType, categoryName) {
  const bySpace = spaceType ? map[String(spaceType).toLowerCase().trim()] : undefined;
  if (bySpace) return bySpace;
  const byName = categoryName ? map[String(categoryName).toLowerCase().trim()] : undefined;
  return byName || null;
}

function catToClient(c) {
  if (!c) return null;
  return {
    ...c,
    _id: c.id,
    categoryName: c.category_name,
    spaceType: c.space_type,
    websiteId: c.website_id,
    ownerId: c.owner_id,
    apiCodes: typeof c.api_codes === 'string' ? JSON.parse(c.api_codes) : (c.api_codes || {}),
    customAttributes: typeof c.custom_attributes === 'string' ? JSON.parse(c.custom_attributes) : (c.custom_attributes || {}),
    placementMode: c.placement_mode,
    placeholderDiv: c.placeholder_div,
    targetPath: c.target_path,
    detectedPages: typeof c.detected_pages === 'string' ? JSON.parse(c.detected_pages) : (c.detected_pages || []),
    recommendedSize: getDimensions(c.space_type),
    webOwnerEmail: c.web_owner_email,
    defaultLanguage: c.default_language,
    customization: typeof c.customization === 'string' ? JSON.parse(c.customization) : (c.customization || null),
    // Multi-tier ad spaces — null/absent means this space still sells at a
    // single flat price, same as before this feature existed.
    pricingTiers: typeof c.pricing_tiers === 'string' ? JSON.parse(c.pricing_tiers) : (c.pricing_tiers || null),
    adTierAssignments: typeof c.ad_tier_assignments === 'string' ? JSON.parse(c.ad_tier_assignments) : (c.ad_tier_assignments || {}),
    // Which of the 3 slots the owner picked to show publicly — null means
    // automatic (the cheapest still-open tier, see AdDisplayController).
    displayedTierKey: c.displayed_tier_key || null,
    // Where the injected script last found this space's div actually
    // rendering, as of the last real visitor's pageview (see
    // AdDisplayController.reportZoneDetected) — drives the dashboard's zone
    // map preview. Null until the site has been visited at least once.
    lastDetectedZone: c.last_detected_zone || null,
    lastReclassifiedAt: c.last_reclassified_at || null,
    // What the owner originally picked at creation — kept even after
    // zone-detection reclassification updates spaceType/categoryName to
    // match where the div actually renders, so the dashboard can show the
    // original pick as the headline with a note about what it's currently
    // acting as (see ZoneMapPreview / codeDisplay.tsx).
    originalSpaceType: c.original_space_type || c.space_type,
    originalCategoryName: c.original_category_name || c.category_name,
  };
}

// Adds advertiserPrice (listed price + margin) alongside the existing
// price/pricingTiers[].price fields — never replaces them, since owner-facing
// screens (the dashboard) still need the listed 100% number. Any advertiser-
// facing screen (the public ad-space widget, checkout, category browse) must
// read advertiserPrice, never price — showing the listed number anywhere an
// advertiser can see it is what ends up charging them more than they were shown.
function withAdvertiserPrice(client, marginPercent) {
  if (!client) return client;
  const factor = 1 + marginPercent / 100;
  return {
    ...client,
    advertiserPrice: Math.round(parseFloat(client.price) * factor),
    // The "custom" tier is the one owner-typed number in the system —
    // PaymentController.initiatePayment charges it literally as typed and
    // takes the margin OUT of it instead of adding margin on top (see the
    // note there), so its advertiserPrice must equal price exactly, not a
    // markup — otherwise this is exactly the bait-and-switch mismatch the
    // advertiserPrice field exists to prevent, just pointed the other way.
    pricingTiers: Array.isArray(client.pricingTiers)
      ? client.pricingTiers.map((t) => ({
          ...t,
          advertiserPrice: t.key === 'custom' ? Math.round(parseFloat(t.price)) : Math.round(parseFloat(t.price) * factor),
        }))
      : client.pricingTiers,
  };
}

const generateScriptTag = (categoryId) => {
  const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000';
  const src = `${BACKEND}/api/ads/script/${categoryId}`;
  return { script: `<script src="${src}" async></script>` };
};

// Shared by createCategory and duplicateCategory — every category gets the
// same per-framework snippet set keyed off its own id, whether it was typed
// in from scratch or cloned from another space.
function buildApiCodes(category) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const adSrc = `${backendUrl}/api/ads/script/${category.id}`;

  return {
    HTML: [
      `<!-- Yepper Ad: ${category.category_name} — Auto-Placement -->`,
      `<script src="${adSrc}" async></script>`,
    ].join('\n'),
    JavaScript: [
      `useEffect(() => {`,
      `  const s = document.createElement('script');`,
      `  s.src = '${adSrc}'; s.async = true;`,
      `  document.body.appendChild(s);`,
      `  return () => { try { document.body.removeChild(s); } catch(e){} };`,
      `}, []);`,
    ].join('\n'),
    PHP: [`<script src="${adSrc}" async></script>`].join('\n'),
    Python: [`ad_tag = '<script src="${adSrc}" async></script>'`].join('\n'),
    HTML_manual: [
      `<div data-yepper-space="${category.id}"></div>`,
      `<script src="${adSrc}" async></script>`,
    ].join('\n'),
    JavaScript_manual: [
      `// <div data-yepper-space="${category.id}"></div>`,
      `useEffect(() => {`,
      `  const s = document.createElement('script');`,
      `  s.src = '${adSrc}'; s.async = true;`,
      `  document.body.appendChild(s);`,
      `  return () => { try { document.body.removeChild(s); } catch(e){} };`,
      `}, []);`,
    ].join('\n'),
    PHP_manual: [
      `<div data-yepper-space="${category.id}"></div>`,
      `<script src="${adSrc}" async></script>`,
    ].join('\n'),
    Python_manual: [
      `placement_div = '<div data-yepper-space="${category.id}"></div>'`,
      `ad_script = '<script src="${adSrc}" async></script>'`,
    ].join('\n'),
  };
}

// ── Internal refund helper (PG transactions via pg client) ────────────────────
async function processInternalRefund({ client, payment, webOwnerId, advertiserId, amount, adId, categoryId, rejectionReason }) {
  const isSelfRejection = webOwnerId === advertiserId;

  if (isSelfRejection) {
    await client.query(
      `UPDATE payments SET internal_refund_processed=true, refunded_at=NOW(), refund_reason=$1, status='internally_refunded' WHERE id=$2`,
      [`Self-rejection: ${rejectionReason}`, payment.id]
    );
    return { success: true, selfRejection: true, refundAmount: amount };
  }

  // Get web owner wallet
  const { rows: [webOwnerWallet] } = await client.query(
    `SELECT * FROM wallets WHERE owner_id=$1 AND owner_type='webOwner' FOR UPDATE`, [webOwnerId]
  );
  if (!webOwnerWallet) throw new Error('Web owner wallet not found');
  if (webOwnerWallet.balance < amount) throw new Error(`Insufficient balance. Required: $${amount}, Available: $${webOwnerWallet.balance}`);

  // Get or create advertiser wallet
  let { rows: [advertiserWallet] } = await client.query(
    `SELECT * FROM wallets WHERE owner_id=$1 AND owner_type='advertiser' FOR UPDATE`, [advertiserId]
  );
  if (!advertiserWallet) {
    const ad = await ImportAd.findById(adId);
    const { rows: [newWallet] } = await client.query(
      `INSERT INTO wallets (owner_id, owner_email, owner_type, balance, total_earned) VALUES ($1,$2,'advertiser',0,0) RETURNING *`,
      [advertiserId, ad.ad_owner_email]
    );
    advertiserWallet = newWallet;
  }

  // Transfer funds
  const { rows: [updatedWebOwner] } = await client.query(
    `UPDATE wallets SET balance=balance-$1, last_updated=NOW() WHERE id=$2 RETURNING *`,
    [amount, webOwnerWallet.id]
  );
  const { rows: [updatedAdvertiser] } = await client.query(
    `UPDATE wallets SET balance=balance+$1, total_refunded=COALESCE(total_refunded,0)+$1, last_updated=NOW() WHERE id=$2 RETURNING *`,
    [amount, advertiserWallet.id]
  );

  // Create transaction records
  const { rows: [woTx] } = await client.query(
    `INSERT INTO wallet_transactions (wallet_id, payment_id, ad_id, amount, type, description, status) VALUES ($1,$2,$3,$4,'refund_debit',$5,'completed') RETURNING *`,
    [webOwnerWallet.id, payment.id, adId, -amount, `Refund processed - Ad rejected: ${rejectionReason}`]
  );
  await client.query(
    `INSERT INTO wallet_transactions (wallet_id, payment_id, ad_id, related_transaction_id, amount, type, description, status) VALUES ($1,$2,$3,$4,$5,'refund_credit',$6,'completed')`,
    [advertiserWallet.id, payment.id, adId, woTx.id, amount, `Refund received - Ad rejected by web owner: ${rejectionReason}`]
  );

  // Update payment
  await client.query(
    `UPDATE payments SET internal_refund_processed=true, refunded_at=NOW(), refund_reason=$1, status='refunded' WHERE id=$2`,
    [rejectionReason, payment.id]
  );

  return {
    success: true,
    selfRejection: false,
    refundAmount: amount,
    webOwnerNewBalance: updatedWebOwner.balance,
    advertiserNewBalance: updatedAdvertiser.balance
  };
}

// ── createCategory ────────────────────────────────────────────────────────────
exports.createCategory = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });

    const {
      websiteId, categoryName, description, price, customAttributes,
      spaceType, placementMode, userCount, instructions, visitorRange, tier, targetPath,
      pricingTiers,
    } = req.body;

    const userId = (req.user.userId || req.user.id || req.user._id)?.toString();
    if (!userId) return res.status(401).json({ message: 'User ID not found in auth data' });

    const userEmail = req.user.email;
    if (!userEmail) return res.status(401).json({ message: 'User email not found in auth data' });

    if (!websiteId || !categoryName || !price || !spaceType || !visitorRange || !tier) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: ['websiteId', 'categoryName', 'price', 'spaceType', 'visitorRange', 'tier'],
        received: { websiteId, categoryName, price, spaceType, visitorRange, tier }
      });
    }

    // New ad spaces always start at Starter pricing, no matter what tier
    // the client claims — self-reported traffic isn't trusted on day one.
    // A space stays at Starter for its first 3 days; after that,
    // promoteGracePeriodAdSpaces (see AdPromoter/utils/) moves it up to
    // whatever tier the website's real, script-tracked traffic has since
    // earned. This intentionally ignores the `tier`/`visitorRange` the
    // client sent — only used above for the "missing required fields" check.
    const canonical = Pricing.canonicalSpace(spaceType);
    let finalPrice = price;
    let starterTierRange = { min: 500, max: 2000 };
    try {
      const starterPrices = await Pricing.getTierPrices('starter');
      if (starterPrices && starterPrices[canonical] !== undefined) {
        finalPrice = starterPrices[canonical];
      }
      const starterMeta = Pricing.TIERS.find((t) => t.key === 'starter');
      if (starterMeta?.range) {
        const m = starterMeta.range.match(/([\d,]+)\s*–\s*([\d,]+)/);
        if (m) starterTierRange = { min: parseInt(m[1].replace(/,/g, ''), 10), max: parseInt(m[2].replace(/,/g, ''), 10) };
      }
    } catch (e) {
      console.error('Pricing lookup failed, using submitted price:', e.message);
    }

    // "Add the price you want": optional, replaces the old freely-editable
    // 3-tier split — omitting pricingTiers keeps every ad space's behavior
    // exactly as above (one Starter-then-promoted price). When present,
    // it's always exactly 3 fixed slots:
    //   custom  — the owner's own typed price, capped (see FLUTTERWAVE_MAX_CHARGE_RWF below)
    //   elite   — always the Elite price for this space type, server-computed, never client-editable
    //   current — always this website's real current tier's price for this
    //             space type (capped at Premium — Elite is reserved for the
    //             elite slot above), server-computed, never client-editable
    const TIER_ORDER = ['custom', 'elite', 'current'];
    const DEFAULT_DWELL_SECONDS = { custom: 35, elite: 20, current: 15 };
    // Flutterwave's real per-transaction ceiling for Rwanda mobile-money
    // collections is RWF 7,000,000 (confirmed against their own docs,
    // https://flutterwave.com/gb/support/payments/flutterwave-limits — card
    // payments are benchmarked to the same ~$5,000 USD figure). This is
    // "custom"'s only real constraint: elite/current are already bounded by
    // our own pricing_rules table, which never gets anywhere near this. A
    // margin buffer below the hard ceiling absorbs FX drift (Flutterwave's
    // own docs note local-currency limits move with the market) and leaves
    // no risk of a checkout ever needing to split into multiple Flutterwave
    // transactions — which would both cost the advertiser extra provider
    // fees per transaction and reopen the door to a double-charge bug.
    const FLUTTERWAVE_MAX_CHARGE_RWF = 6500000;
    let normalizedPricingTiers = null;
    if (Array.isArray(pricingTiers) && pricingTiers.length > 0) {
      if (pricingTiers.length > 3) {
        return res.status(400).json({ message: 'A maximum of 3 pricing tiers is supported.' });
      }
      const website = await Website.findById(websiteId);
      const realTier = website?.traffic_tier === 'elite' ? 'premium' : (website?.traffic_tier || 'starter');
      const [elitePrices, currentTierPrices] = await Promise.all([
        Pricing.getTierPrices('elite'),
        Pricing.getTierPrices(realTier),
      ]);
      const currentTierMeta = Pricing.TIERS.find((t) => t.key === realTier);
      // The custom tier is charged to the advertiser exactly as typed (see
      // PaymentController.initiatePayment — margin comes OUT of it, isn't
      // added on top), so the cap is just the Flutterwave ceiling itself,
      // not backed out through the margin factor the way it would be if the
      // typed number were a listed price getting marked up.
      const maxCustomListedPrice = FLUTTERWAVE_MAX_CHARGE_RWF;

      const seen = new Set();
      normalizedPricingTiers = [];
      for (const raw of pricingTiers) {
        const key = TIER_ORDER.includes(raw?.key) ? raw.key : null;
        if (!key || seen.has(key)) {
          return res.status(400).json({ message: 'Each pricing tier must have a unique key of custom, elite, or current.' });
        }
        seen.add(key);

        let tierPrice, label;
        if (key === 'custom') {
          tierPrice = Number(raw.price);
          label = raw.label || 'Custom';
          if (!Number.isFinite(tierPrice) || tierPrice <= 0) {
            return res.status(400).json({ message: 'The custom tier needs a real price above 0.' });
          }
          if (tierPrice > maxCustomListedPrice) {
            return res.status(400).json({
              message: `The custom tier can't be priced above RWF ${maxCustomListedPrice.toLocaleString()} — above that, the advertiser's charge at checkout would exceed what a single payment can process.`,
            });
          }
        } else if (key === 'elite') {
          tierPrice = elitePrices[canonical];
          label = 'Elite';
        } else {
          tierPrice = currentTierPrices[canonical];
          label = currentTierMeta?.label || realTier[0].toUpperCase() + realTier.slice(1);
        }
        if (!Number.isFinite(tierPrice)) {
          return res.status(400).json({ message: `No price configured for ${label} on this space type yet.` });
        }
        normalizedPricingTiers.push({
          key, label, price: tierPrice, maxSlots: 1,
          dwellSeconds: DEFAULT_DWELL_SECONDS[key],
        });
      }
      normalizedPricingTiers.sort((a, b) => TIER_ORDER.indexOf(a.key) - TIER_ORDER.indexOf(b.key));
    }

    const savedCategory = await AdCategory.create({
      ownerId: userId,
      websiteId,
      categoryName,
      description,
      price: finalPrice,
      spaceType,
      // Canonical form, so a later `spaceType !== originalSpaceType` check
      // (used to show "originally X, currently acting as Y" in the
      // dashboard) compares like-for-like instead of tripping on casing.
      originalSpaceType: canonical,
      originalCategoryName: categoryName,
      pricingTiers: normalizedPricingTiers,
      // A specific targetPath is what actually scopes this to one page (the
      // site-wide script matches it against location.pathname) — placementMode
      // is now just a derived label kept for backward compatibility with the
      // older manual/placeholder-div flow.
      placementMode: targetPath ? 'manual' : (placementMode || 'auto'),
      targetPath: targetPath || null,
      userCount: parseInt(userCount, 10) || 0,
      instructions,
      customAttributes: customAttributes || {},
      webOwnerEmail: userEmail,
      visitorRange: starterTierRange,
      tier: 'starter',
    });

    const finalCategory = await AdCategory.update(savedCategory.id, { apiCodes: buildApiCodes(savedCategory) });

    try { await generateSiteScript(websiteId); } catch(e) { console.error('Site script regen:', e.message); }

    res.status(201).json({ success: true, message: 'Ad space created successfully', category: finalCategory });

  } catch (error) {
    console.error('Error creating ad space:', error);

    // Unique constraint: same space name already exists for this website
    if (error.code === '23505') {
      const name = req.body?.categoryName || 'this type';
      return res.status(409).json({
        message: `An ad space named "${name}" already exists for this website. Choose a different space type or delete the existing one first.`,
      });
    }

    // FK violation: owner_id or website_id doesn't exist in referenced table
    if (error.code === '23503') {
      return res.status(400).json({
        message: 'Invalid website or owner reference. Please reload the page and try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }

    res.status(500).json({
      message: 'Failed to create ad space',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ── getActiveAds ──────────────────────────────────────────────────────────────
exports.getActiveAds = async (req, res) => {
  try {
    const webOwnerId = req.user.userId || req.user.id || req.user._id;
    const categories = await AdCategory.findByOwner(webOwnerId);
    const categoryIds = categories.map(c => c.id);
    const activeAds = await ImportAd.findActiveByCategories(categoryIds);
    res.status(200).json({ success: true, activeAds });
  } catch (error) {
    console.error('Error fetching active ads:', error);
    res.status(500).json({ error: 'Failed to fetch active ads' });
  }
};

// ── getPendingRejections ──────────────────────────────────────────────────────
exports.getPendingRejections = async (req, res) => {
  try {
    const webOwnerId = req.user.userId || req.user.id || req.user._id;
    const categories = await AdCategory.findByOwner(webOwnerId);
    const categoryIds = categories.map(c => c.id);
    const pendingAds = await ImportAd.findPendingByCategories(categoryIds, new Date());
    res.status(200).json({ success: true, pendingAds });
  } catch (error) {
    console.error('Error fetching pending rejections:', error);
    res.status(500).json({ error: 'Failed to fetch pending rejections' });
  }
};

// ── rejectAd ──────────────────────────────────────────────────────────────────
exports.rejectAd = async (req, res) => {
  const client = await getClient();
  try {
    const { adId, websiteId, categoryId } = req.params;
    const { rejectionReason } = req.body;
    const webOwnerId = req.user.userId || req.user.id || req.user._id;

    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return res.status(400).json({ error: 'Rejection reason must be at least 10 characters' });
    }

    await client.query('BEGIN');

    const ad = await ImportAd.findById(adId);
    const category = await AdCategory.findById(categoryId);

    const { rows: [payment] } = await client.query(
      `SELECT * FROM payments WHERE ad_id=$1 AND website_id=$2 AND category_id=$3 AND status='successful'`,
      [adId, websiteId, categoryId]
    );

    if (!ad || !category || !payment) throw new Error('Required records not found');
    if (category.owner_id !== webOwnerId.toString()) throw new Error('Unauthorized: not your category');

    // Parse websiteSelections from JSONB
    const selections = Array.isArray(ad.website_selections)
      ? ad.website_selections
      : JSON.parse(ad.website_selections || '[]');

    const selectionIndex = selections.findIndex(sel =>
      sel.websiteId === websiteId &&
      Array.isArray(sel.categories) && sel.categories.includes(categoryId) &&
      sel.approved === true && !sel.isRejected
    );
    if (selectionIndex === -1) throw new Error('Ad selection not found or already processed');

    const sel = selections[selectionIndex];
    const now = new Date();
    if (sel.rejectionDeadline) {
      const deadline = new Date(sel.rejectionDeadline);
      if (now > new Date(deadline.getTime() + 5 * 60 * 1000)) {
        throw new Error('Rejection window has expired.');
      }
    }
    if (payment.internal_refund_processed) throw new Error('Refund already processed');

    // Update selection
    selections[selectionIndex] = {
      ...sel,
      isRejected: true, rejectedAt: now, rejectedBy: webOwnerId,
      rejectionReason: rejectionReason.trim(), approved: false, status: 'rejected'
    };
    const hasActive = selections.some(s => s.status === 'active' && !s.isRejected);

    await client.query(
      `UPDATE import_ads SET website_selections=$1, available_for_reassignment=$2 WHERE id=$3`,
      [JSON.stringify(selections), !hasActive, adId]
    );

    // Remove ad from category's selected_ads and decrement user_count
    await client.query(
      `UPDATE ad_categories
       SET selected_ads = (
         SELECT COALESCE(jsonb_agg(el), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(selected_ads,'[]'::jsonb)) el
         WHERE el::text != $1::text
       ),
       user_count = GREATEST(0, COALESCE(user_count,0) - 1)
       WHERE id=$2`,
      [JSON.stringify(adId), categoryId]
    );

    await processInternalRefund({
      client, payment, webOwnerId,
      advertiserId: payment.advertiser_id,
      amount: payment.amount,
      adId, categoryId,
      rejectionReason: rejectionReason.trim()
    });

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Ad rejected and refund processed',
      rejectionReason: rejectionReason.trim(),
      timestamp: now.toISOString()
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject ad error:', error);
    res.status(400).json({ error: error.message || 'Failed to reject ad' });
  } finally {
    client.release();
  }
};

// ── getCategoryBookingStatus ──────────────────────────────────────────────────
exports.getCategoryBookingStatus = async (req, res) => {
  try {
    const category = await AdCategory.findById(req.params.categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const selectedAds = Array.isArray(category.selected_ads)
      ? category.selected_ads
      : JSON.parse(category.selected_ads || '[]');

    const maxSlots = category.user_count || 10;
    const currentSlots = selectedAds.length;
    const availableSlots = Math.max(0, maxSlots - currentSlots);

    // Get website name
    const website = await Website.findById(category.website_id);

    res.status(200).json({
      success: true,
      category: {
        id: category.id,
        name: category.category_name,
        price: category.price,
        websiteName: website?.website_name,
        maxSlots,
        currentSlots,
        availableSlots,
        isFullyBooked: currentSlots >= maxSlots,
        occupancyRate: maxSlots > 0 ? ((currentSlots / maxSlots) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Error getting booking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── resetUserCount ────────────────────────────────────────────────────────────
exports.resetUserCount = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { newUserCount } = req.body;

    if (!newUserCount || newUserCount < 0) {
      return res.status(400).json({ error: 'Invalid Input', message: 'User count must be non-negative' });
    }

    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(404).json({ error: 'Not Found', message: 'Category not found' });

    // Count currently approved ads for this category via JSONB
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM import_ads
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(website_selections) AS sel
         WHERE (sel->>'approved')::boolean = true
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(sel->'categories') cat_id
             WHERE cat_id = $1
           )
       )`,
      [categoryId]
    );
    const currentUserCount = parseInt(count, 10);

    if (newUserCount < currentUserCount) {
      return res.status(400).json({
        error: 'Invalid Reset',
        message: 'New user count cannot be less than current approved users'
      });
    }

    const updated = await AdCategory.update(categoryId, { userCount: newUserCount });
    res.status(200).json({ message: 'User count reset successfully', category: updated });

  } catch (error) {
    console.error('Error resetting user count:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

// ── deleteCategory ────────────────────────────────────────────────────────────
exports.deleteCategory = async (req, res) => {
  const client = await getClient();
  try {
    const { categoryId } = req.params;
    const { ownerId } = req.body;

    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    if (category.owner_id.toString() !== ownerId) return res.status(403).json({ message: 'Unauthorized' });

    // Check for active/confirmed ads via JSONB
    const activeAdIds = await AdCategory.findActiveAdIds(categoryId);

    if (activeAdIds.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete category with active or confirmed ads',
        affectedAds: activeAdIds
      });
    }

    await client.query('BEGIN');

    // Delete category
    await client.query(`DELETE FROM ad_categories WHERE id=$1`, [categoryId]);

    // Remove category reference from all import_ads website_selections
    await client.query(
      `UPDATE import_ads
       SET website_selections = (
         SELECT COALESCE(jsonb_agg(
           jsonb_set(sel, '{categories}', (
             SELECT COALESCE(jsonb_agg(cat), '[]'::jsonb)
             FROM jsonb_array_elements_text(sel->'categories') cat
             WHERE cat != $1
           ))
         ), '[]'::jsonb)
         FROM jsonb_array_elements(website_selections) AS sel
       )
       WHERE website_selections::text LIKE $2`,
      [categoryId, `%${categoryId}%`]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Category deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category', error: error.message });
  } finally {
    client.release();
  }
};

// ── sendCategoryInvite ────────────────────────────────────────────────────────
// The logged-in website owner emails a chosen recipient a direct link into
// booking this specific ad space — same link the advertiser flow itself uses
// (app/(adsense)/ad-owner/pages/direct-ad), which handles its own login/signup
// inline, so no separate /login?from= redirect is needed here.
exports.sendCategoryInvite = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
    const { categoryId } = req.params;
    const { email, tierKey } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }

    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const userId = (req.user.userId || req.user.id || req.user._id)?.toString();
    if (category.owner_id?.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // A tiered space has no single price/link — inviting for a specific slot
    // (the per-tier "Invite" button in the dashboard) needs that slot's own
    // price and its own deep link, same as the per-tier copy-link button.
    const tiers = Array.isArray(category.pricing_tiers) ? category.pricing_tiers : [];
    const tier = tierKey ? tiers.find((t) => t.key === tierKey) : null;

    const website = await Website.findById(category.website_id);
    const websiteName = website?.website_name || 'this website';
    const spaceName = tier
      ? `${category.category_name || category.space_type} — ${tier.label}`
      : (category.category_name || category.space_type);

    const link = `${FRONTEND_URL}/ad-owner/pages/direct-ad?websiteId=${category.website_id}&categoryId=${category.id}`
      + (tier ? `&tier=${encodeURIComponent(tier.key)}` : '');
    const subject = `Advertise on ${websiteName}`;
    const safeSpaceName   = escapeHtml(spaceName);
    const safeWebsiteName = escapeHtml(websiteName);
    const safeSpaceType   = escapeHtml(category.space_type || '');
    // Invite recipient is a prospective advertiser — must see the same
    // price checkout will actually charge, not the owner's listed price
    // (see withAdvertiserPrice's note on why these can never diverge). The
    // custom tier is the one exception: it's charged to the advertiser
    // exactly as the owner typed it, margin taken out rather than added on
    // top (see PaymentController.initiatePayment), so it's shown as-is here too.
    const { marginPercent } = await Pricing.getSettings();
    const price = tier && tier.key === 'custom'
      ? Number(tier.price || 0).toFixed(2)
      : (Number((tier ? tier.price : category.price) || 0) * (1 + marginPercent / 100)).toFixed(2);

    // Real mockup of this exact placement (same image the dashboard shows
    // when the owner picked it), so the recipient sees what they'd actually
    // be buying instead of a generic "AD" placeholder.
    const spaceImagePath = lookupAdSpace(AD_SPACE_IMAGES, category.space_type, category.category_name);
    const spaceImageUrl  = spaceImagePath ? `${FRONTEND_URL}${spaceImagePath}` : null;
    const spaceDescription = category.description
      || lookupAdSpace(AD_SPACE_DESCRIPTIONS, category.space_type, category.category_name)
      || 'A dedicated ad space on this site.';
    const safeSpaceDescription = escapeHtml(spaceDescription);

    // Where this space actually lives: the site's homepage, or the specific
    // page the owner scoped it to via the page picker (see
    // WebsitePagesPanel.tsx / AddNewCategory.tsx's "Where should this ad
    // appear?" field) — target_path is null for "All Pages".
    let siteUrl = website?.website_link || '';
    if (siteUrl && !/^https?:\/\//i.test(siteUrl)) siteUrl = `https://${siteUrl}`;
    const pageUrl = (siteUrl && category.target_path)
      ? `${siteUrl.replace(/\/+$/, '')}/${String(category.target_path).replace(/^\/+/, '')}`
      : siteUrl;

    const logoUrl = website?.image_url || '';

    // Card mirrors the actual on-site ad widget (see AdDisplayController.js's
    // availableSlotHtml/.sp-* markup): the real placement image up top, then
    // a white info panel with the real space details and two CTAs — see the
    // actual page this would run on, or go straight to booking it.
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;"><tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 2px 20px rgba(0,0,0,0.08);overflow:hidden;">
            <tr><td style="background:#000;padding:24px 40px;">
              <table cellpadding="0" cellspacing="0"><tr>
                ${logoUrl ? `<td style="padding-right:12px;"><img src="${logoUrl}" width="40" height="40" style="border-radius:8px;display:block;object-fit:cover;" alt=""/></td>` : ''}
                <td valign="middle">
                  <p style="margin:0;color:#fff;font-size:18px;font-weight:800;">${safeWebsiteName}</p>
                  <p style="margin:2px 0 0;color:#999;font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;">via Yepper</p>
                </td>
              </tr></table>
            </td></tr>

            <tr><td style="padding:32px 40px 0;">

              <!-- ── Ad space card — same shape as the live on-site ad widget ── -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:16px;overflow:hidden;border:1px solid #eee;">

                ${spaceImageUrl
                  ? `<tr><td style="background:#fff;"><img src="${spaceImageUrl}" width="600" style="display:block;width:100%;max-width:600px;height:auto;" alt="${safeSpaceName} placement preview"/></td></tr>`
                  : `<tr><td bgcolor="#f97316" style="background:linear-gradient(135deg,#fb7185,#f97316);padding:28px 16px;text-align:center;">
                      <span style="display:inline-block;background:rgba(0,0,0,0.35);color:#fff;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 10px;border-radius:99px;margin-bottom:12px;">📣 Ad space preview</span><br/>
                      <span style="display:inline-block;font-size:38px;font-weight:900;letter-spacing:.06em;color:#fff;text-shadow:0 4px 14px rgba(0,0,0,0.25);">AD</span>
                    </td></tr>`}

                <!-- Info panel — the real, current details for this space -->
                <tr><td style="background:#fff;padding:20px;">
                  <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#999;">${safeWebsiteName}${safeSpaceType ? ` · ${safeSpaceType}` : ''}</p>
                  <p style="margin:0 0 8px;font-size:17px;font-weight:800;color:#111;">${safeSpaceName}</p>
                  <p style="margin:0 0 14px;font-size:13px;color:#666;line-height:1.5;">${safeSpaceDescription}</p>
                  <p style="margin:0 0 18px;font-size:14px;color:#555;">Price: <strong style="color:#111;">RWF ${price}/month</strong></p>

                  <table cellpadding="0" cellspacing="0"><tr>
                    ${pageUrl ? `<td style="padding-right:10px;"><a href="${pageUrl}" style="display:inline-block;background:#fff;color:#111;padding:12px 22px;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;border:1px solid #ddd;">Visit the Website</a></td>` : ''}
                    <td><a href="${link}" style="display:inline-block;background:#000;color:#fff;padding:12px 22px;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;">Advertise →</a></td>
                  </tr></table>
                </td></tr>
              </table>

              <p style="color:#555;font-size:14px;line-height:1.6;margin:20px 0 0;">
                The "${safeSpaceName}" ad space on ${safeWebsiteName} is open. Book it to run your ad there.
              </p>
              <p style="color:#999;font-size:13px;line-height:1.5;margin:12px 0 32px;">
                "Advertise" takes you straight there — log in (or create an account) and you'll land right back here to finish booking it.
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
      return res.status(503).json({ message: 'Email sending is not configured on this server' });
    }
    return res.json({ success: true, message: 'Email sent' });
  } catch (error) {
    console.error('Error sending category invite:', error);
    res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
};

// ── getCategories (by ownerId param) ─────────────────────────────────────────
exports.getCategories = async (req, res) => {
  const { ownerId } = req.params;
  const page  = parseInt(req.query.page  || '1',  10);
  const limit = parseInt(req.query.limit || '10', 10);
  try {
    const all = await AdCategory.findByOwner(ownerId);
    const total = all.length;
    const categories = all.slice((page - 1) * limit, page * limit);
    res.status(200).json({ categories, totalPages: Math.ceil(total / limit), currentPage: page });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

// ── getCategoriesByWebsiteForAdvertisers ──────────────────────────────────────
exports.getCategoriesByWebsiteForAdvertisers = async (req, res) => {
  const { websiteId } = req.params;
  const page  = parseInt(req.query.page  || '1',  10);
  const limit = parseInt(req.query.limit || '10', 10);

  try {
    // Validate it's a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(websiteId)) {
      return res.status(400).json({ message: 'Invalid website ID' });
    }

    const { rows: categories } = await query(
      `SELECT ac.*,
         COALESCE((
           SELECT COUNT(*)::int
           FROM import_ads ia
           WHERE EXISTS (
             SELECT 1 FROM jsonb_array_elements(ia.website_selections) sel
             WHERE sel->>'websiteId' = $1
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements_text(sel->'categories') cat_id
                 WHERE cat_id = ac.id::text
               )
           )
         ), 0) AS current_user_count
       FROM ad_categories ac
       WHERE ac.website_id = $1::uuid
       ORDER BY ac.created_at DESC
       LIMIT $2 OFFSET $3`,
      [websiteId, limit, (page - 1) * limit]
    );

    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM ad_categories WHERE website_id=$1::uuid`, [websiteId]
    );

    const { marginPercent } = await Pricing.getSettings();

    // Multi-tier spaces: figure out, per tier, how many of its maxSlots are
    // taken. Reuses the same "active ad actually sold on this website+
    // category" definition as current_user_count above (one batched query
    // for every tiered category on this page, instead of N+1) and counts
    // each active ad against the tier ad_tier_assignments says it belongs to.
    const tieredCategoryIds = categories
      .filter(c => Array.isArray(c.pricing_tiers) || (typeof c.pricing_tiers === 'string' && c.pricing_tiers))
      .map(c => c.id);

    let activeAdsByCategoryId = {};
    if (tieredCategoryIds.length) {
      const { rows: activeAdRows } = await query(
        `SELECT ac.id AS category_id, ia.id AS ad_id
         FROM ad_categories ac
         JOIN import_ads ia ON EXISTS (
           SELECT 1 FROM jsonb_array_elements(ia.website_selections) sel
           WHERE sel->>'websiteId' = $1
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(sel->'categories') cat_id
               WHERE cat_id = ac.id::text
             )
         )
         WHERE ac.id = ANY($2::uuid[])`,
        [websiteId, tieredCategoryIds]
      );
      activeAdsByCategoryId = activeAdRows.reduce((acc, row) => {
        (acc[row.category_id] ||= []).push(row.ad_id);
        return acc;
      }, {});
    }

    // Add isFullyBooked flag — user_count defaults to 0 in the DB for newly
    // created ad spaces, but 0 means "not configured" everywhere else in this
    // file (see maxSlots fallbacks above), not "zero slots". Fall back to the
    // same default of 10 so a fresh ad space isn't shown as fully booked.
    // catToClient() maps the raw snake_case row (id, category_name, ...) to
    // the camelCase shape (_id, categoryName, ...) the advertiser UI expects —
    // without it, space._id/categoryName came back undefined.
    const enriched = categories.map(c => {
      const client = withAdvertiserPrice(catToClient(c), marginPercent);
      let tierAvailability = null;
      if (client.pricingTiers) {
        const activeAdIds = activeAdsByCategoryId[c.id] || [];
        const assignments = client.adTierAssignments || {};
        tierAvailability = client.pricingTiers.map(t => ({
          key: t.key,
          maxSlots: t.maxSlots,
          slotsTaken: activeAdIds.filter(adId => assignments[adId] === t.key).length,
        }));
      }
      return {
        ...client,
        isFullyBooked: client.pricingTiers
          ? tierAvailability.every(t => t.slotsTaken >= t.maxSlots)
          : c.current_user_count >= (c.user_count || 10),
        tierAvailability,
      };
    });

    res.status(200).json({ categories: enriched, totalPages: Math.ceil(parseInt(count) / limit), currentPage: page });

  } catch (error) {
    console.error('Error in getCategoriesByWebsiteForAdvertisers:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

// ── expressInterest ───────────────────────────────────────────────────────────
// Lightweight "I want this ad space" signal for admin-added prospect websites —
// no payment, no booking. Just records who wants what so the admin can go
// pitch the real site owner. See backend/controllers/prospectController.js.
exports.expressInterest = async (req, res) => {
  const { websiteId } = req.params;
  const { categoryIds } = req.body || {};

  const advertiserId = getSessionUserId(req);
  if (!advertiserId) return res.status(401).json({ success: false, message: 'Login required' });

  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Select at least one ad space' });
  }

  try {
    const categories = await AdCategory.findByWebsite(websiteId);
    const validIds = new Set(categories.map((c) => c.id));
    const invalid = categoryIds.filter((id) => !validIds.has(id));
    if (invalid.length) return res.status(400).json({ success: false, message: 'One or more ad spaces are invalid for this website' });

    for (const categoryId of categoryIds) {
      await query(
        `INSERT INTO prospect_interests (website_id, category_id, advertiser_id) VALUES ($1, $2, $3)`,
        [websiteId, categoryId, advertiserId]
      );
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error recording prospect interest:', error);
    res.status(500).json({ success: false, message: 'Failed to record interest', error: error.message });
  }
};

// ── getCategoriesByWebsite ────────────────────────────────────────────────────
exports.getCategoriesByWebsite = async (req, res) => {
  const { websiteId } = req.params;
  const page  = parseInt(req.query.page  || '1',  10);
  const limit = parseInt(req.query.limit || '10', 10);
  try {
    const all = await AdCategory.findByWebsite(websiteId);
    const total = all.length;
    const categories = all.slice((page - 1) * limit, page * limit).map(catToClient);  // ← map
    res.status(200).json({ categories, totalPages: Math.ceil(total / limit), currentPage: page });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

// ── getCategoryById ───────────────────────────────────────────────────────────
exports.getCategoryById = async (req, res) => {
  try {
    const category = await AdCategory.findById(req.params.categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    const { marginPercent } = await Pricing.getSettings();
    const client = withAdvertiserPrice(catToClient(category), marginPercent);
    // Multi-tier ad spaces: the direct-ad checkout page needs to know how
    // full each tier already is (to show "2/3 taken" and grey out a full
    // tier) — untiered spaces get tierAvailability: null, unchanged.
    let tierAvailability = null;
    if (client.pricingTiers) {
      const counts = await AdCategory.countActiveAdsByTier(category.id);
      tierAvailability = client.pricingTiers.map((t) => ({
        key: t.key, maxSlots: t.maxSlots, slotsTaken: counts[t.key] || 0,
      }));
    }
    res.status(200).json({ ...client, tierAvailability });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch category', error: error.message });
  }
};

// ── updateCategoryLanguage ────────────────────────────────────────────────────
exports.updateCategoryLanguage = async (req, res) => {
  try {
    const updated = await AdCategory.update(req.params.categoryId, { defaultLanguage: req.body.defaultLanguage });
    if (!updated) return res.status(404).json({ message: 'Category not found' });
    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating category language:', error);
    res.status(500).json({ message: 'Error updating category language', error: error.message });
  }
};

// ── updateCategoryPlacementMode ───────────────────────────────────────────────
// Only meaningful for Floating/ModalPic (see AUTO_RELIABLE in
// SiteScriptController.js / codeDisplay.tsx) — 'auto' bundles into the
// site-wide script and shows on every page; 'manual' opts out of that bundle
// and instead gets a page-scoped iframe embed the owner pastes only where
// they want it (see codeDisplay.tsx's Precise-Placement section).
exports.updateCategoryPlacementMode = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
    const { categoryId } = req.params;
    const { placementMode } = req.body;

    if (!['auto', 'manual'].includes(placementMode)) {
      return res.status(400).json({ message: 'placementMode must be "auto" or "manual"' });
    }

    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const userId = (req.user.userId || req.user.id || req.user._id)?.toString();
    if (category.owner_id?.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const updated = await AdCategory.update(categoryId, { placementMode });
    res.status(200).json(catToClient(updated));
  } catch (error) {
    console.error('Error updating category placement mode:', error);
    res.status(500).json({ message: 'Error updating category placement mode', error: error.message });
  }
};

// ── updateCategoryTargetPath ──────────────────────────────────────────────────
// Scopes an existing ad space to one of the website's registered pages (see
// Website.pages) — or back to every page with targetPath: null. The site-wide
// script matches this against location.pathname itself, so this is the whole
// "which page does this appear on" control — no snippet to re-paste.
exports.updateCategoryTargetPath = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
    const { categoryId } = req.params;
    const { targetPath } = req.body;

    if (targetPath !== null && typeof targetPath !== 'string') {
      return res.status(400).json({ message: 'targetPath must be a string path or null' });
    }

    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const userId = (req.user.userId || req.user.id || req.user._id)?.toString();
    if (category.owner_id?.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const updated = await AdCategory.update(categoryId, {
      targetPath: targetPath || null,
      placementMode: targetPath ? 'manual' : 'auto',
    });
    res.status(200).json(catToClient(updated));
  } catch (error) {
    console.error('Error updating category target path:', error);
    res.status(500).json({ message: 'Error updating category target path', error: error.message });
  }
};

// ── setDisplayedTier ─────────────────────────────────────────────────────────
// Multi-tier ad spaces only: which of the 3 slots shows publicly on the
// site right now. null resets to automatic (cheapest still-open tier — see
// AdDisplayController.displayAd, which also falls back to that same
// automatic behavior if the chosen tier is full or gone). Changeable any
// time — this is a display preference, not a booking, so there's nothing to
// undo when it changes.
exports.setDisplayedTier = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
    const { categoryId } = req.params;
    const { tierKey } = req.body;

    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const userId = (req.user.userId || req.user.id || req.user._id)?.toString();
    if (category.owner_id?.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const pricingTiers = typeof category.pricing_tiers === 'string'
      ? JSON.parse(category.pricing_tiers) : category.pricing_tiers;
    if (!Array.isArray(pricingTiers) || pricingTiers.length === 0) {
      return res.status(400).json({ message: 'This ad space is not split into tiers.' });
    }
    if (tierKey !== null && !pricingTiers.some((t) => t.key === tierKey)) {
      return res.status(400).json({ message: `tierKey must be one of: ${pricingTiers.map((t) => t.key).join(', ')}, or null.` });
    }

    const updated = await AdCategory.update(categoryId, { displayedTierKey: tierKey || null });
    res.status(200).json(catToClient(updated));
  } catch (error) {
    console.error('Error setting displayed tier:', error);
    res.status(500).json({ message: 'Error setting displayed tier', error: error.message });
  }
};

// ── duplicateCategory ─────────────────────────────────────────────────────────
// Clones a category's config into a brand-new one with its own id, own
// iframe/script, and empty inventory (no selected_ads carried over) — for
// when an owner wants the *same kind* of slot on a second page with its own
// independently-sold ads. Reusing one category's iframe/script on two pages
// doesn't do that: it's the same underlying inventory, so whatever's sold
// into it renders identically — and simultaneously — on every page it's
// pasted on. Duplicating gives the second page its own bookable space instead.
exports.duplicateCategory = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
    const { categoryId } = req.params;
    // pageLabel/targetPath come from picking one of the website's registered
    // pages (see Website.pages) — targetPath is what the site-wide script
    // actually matches against location.pathname; pageLabel just names the
    // duplicate. categoryName is kept as a fallback for older callers.
    const { categoryName, pageLabel, targetPath } = req.body;

    const source = await AdCategory.findById(categoryId);
    if (!source) return res.status(404).json({ message: 'Category not found' });

    const userId = (req.user.userId || req.user.id || req.user._id)?.toString();
    if (source.owner_id?.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const label = (pageLabel || categoryName || '').trim();
    const name = label ? `${source.category_name} — ${label}` : `${source.category_name} (copy)`;

    // Floating/ModalPic specifically default to the site-wide bundle (see
    // AUTO_RELIABLE in SiteScriptController.js) — a duplicate left in 'auto'
    // would join that bundle alongside the original and show on every page
    // twice. A duplicate only exists to serve a *different* page, so it
    // always starts page-scoped for these two types regardless of the
    // source's own mode; every other spaceType already ships as its own
    // independent iframe and placementMode has no bearing on it either way.
    const isPageScopedType = ['floating', 'modalpic'].includes((source.space_type || '').toLowerCase());

    const savedCategory = await AdCategory.create({
      ownerId: source.owner_id,
      websiteId: source.website_id,
      categoryName: name,
      description: source.description,
      price: source.price,
      spaceType: source.space_type,
      placementMode: (targetPath || isPageScopedType) ? 'manual' : (source.placement_mode || 'auto'),
      targetPath: targetPath || null,
      userCount: source.user_count,
      instructions: source.instructions,
      customAttributes: typeof source.custom_attributes === 'string' ? JSON.parse(source.custom_attributes) : (source.custom_attributes || {}),
      webOwnerEmail: source.web_owner_email,
      visitorRange: { min: source.visitor_range_min, max: source.visitor_range_max },
      tier: source.tier,
      defaultLanguage: source.default_language,
      customization: typeof source.customization === 'string' ? JSON.parse(source.customization) : source.customization,
    });

    const finalCategory = await AdCategory.update(savedCategory.id, { apiCodes: buildApiCodes(savedCategory) });

    try { await generateSiteScript(source.website_id); } catch(e) { console.error('Site script regen:', e.message); }

    res.status(201).json({ success: true, message: 'Ad space duplicated successfully', category: catToClient(finalCategory) });
  } catch (error) {
    console.error('Error duplicating category:', error);

    // Unique constraint on (owner_id, website_id, category_name) — hit if the
    // default "X (copy)" name (or a repeated custom label) is already taken.
    if (error.code === '23505') {
      return res.status(409).json({
        message: 'An ad space with that name already exists for this website. Give this copy a different label.',
      });
    }

    res.status(500).json({ message: 'Failed to duplicate ad space', error: error.message });
  }
};

// ── getPendingAds ─────────────────────────────────────────────────────────────
exports.getPendingAds = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const websites = await Website.findByOwner(ownerId);
    if (!websites.length) return res.status(403).json({ message: 'No websites found for this owner' });

    const websiteIds = websites.map(w => w.id.toString());

    const { rows: pendingAds } = await query(
      `SELECT * FROM import_ads
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(website_selections) AS sel
         WHERE (sel->>'approved')::boolean = false
           AND sel->>'websiteId' = ANY($1::text[])
       )`,
      [websiteIds]
    );

    const transformedAds = pendingAds.map(ad => {
      const selections = Array.isArray(ad.website_selections)
        ? ad.website_selections
        : JSON.parse(ad.website_selections || '[]');

      const validSelections = selections.filter(sel =>
        websiteIds.includes(sel.websiteId) && sel.approved === false
      );
      if (!validSelections.length) return null;

      const website = websites.find(w => w.id.toString() === validSelections[0]?.websiteId);
      return {
        _id: ad.id,
        businessName: ad.business_name,
        businessLink: ad.business_link,
        businessLocation: ad.business_location,
        adDescription: ad.ad_description,
        imageUrl: ad.image_url,
        videoUrl: ad.video_url,
        pdfUrl: ad.pdf_url,
        websiteDetails: validSelections.map(sel => ({
          website: website || { id: sel.websiteId },
          categories: sel.categories,
          approved: sel.approved
        }))
      };
    }).filter(Boolean);

    res.status(200).json(transformedAds);
  } catch (error) {
    console.error('Server error in getPendingAds:', error);
    res.status(500).json({ message: 'Error fetching pending ads', error: error.message });
  }
};

// ── approveAdForWebsite ───────────────────────────────────────────────────────
exports.approveAdForWebsite = async (req, res) => {
  try {
    const { adId, websiteId } = req.params;

    const ad = await ImportAd.findById(adId);
    const website = await Website.findById(websiteId);

    if (!ad || !website) return res.status(404).json({ message: `${!ad ? 'Ad' : 'Website'} not found` });

    const selections = Array.isArray(ad.website_selections)
      ? ad.website_selections
      : JSON.parse(ad.website_selections || '[]');

    const idx = selections.findIndex(sel => sel.websiteId === websiteId || sel.websiteId === websiteId.toString());
    if (idx === -1) return res.status(404).json({ message: 'Ad not associated with this website' });

    selections[idx] = { ...selections[idx], approved: true, approvedAt: new Date() };
    const allApproved = selections.every(sel => sel.approved);

    const updated = await ImportAd.update(adId, {
      websiteSelections: selections,
      ...(allApproved ? { confirmed: true } : {})
    });

    res.status(200).json({ message: 'Ad approved successfully', ad: updated, allApproved });

  } catch (error) {
    console.error('Ad approval error:', error);
    res.status(500).json({ message: 'Error processing approval', error: error.message });
  }
};

// ── getWebOwnerBalance ────────────────────────────────────────────────────────
exports.getWebOwnerBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const balance = await WebOwnerBalance.findOne({ userId });
    if (!balance) return res.status(404).json({ message: 'No balance found for this user' });

    res.status(200).json(balance);
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: 'Error fetching balance', error: error.message });
  }
};

// ── getDetailedEarnings ───────────────────────────────────────────────────────
exports.getDetailedEarnings = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const { rows: payments } = await query(
      `SELECT p.id, p.amount, p.currency, p.created_at AS payment_date,
              ia.business_name, ia.business_location, ia.business_link, ia.ad_owner_email AS advertiser_email,
              p.tx_ref AS payment_reference
       FROM payments p
       JOIN import_ads ia ON ia.id = p.ad_id
       WHERE p.web_owner_id=$1 AND p.status='successful' AND p.withdrawn=false
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const balanceRecord = await WebOwnerBalance.findOne({ userId });

    const groupedPayments = payments.reduce((acc, payment) => {
      const monthYear = new Date(payment.payment_date).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      if (!acc[monthYear]) acc[monthYear] = { totalAmount: 0, payments: [] };
      acc[monthYear].payments.push(payment);
      acc[monthYear].totalAmount += parseFloat(payment.amount);
      return acc;
    }, {});

    res.status(200).json({
      totalBalance: {
        totalEarnings: balanceRecord?.total_earnings || 0,
        availableBalance: balanceRecord?.available_balance || 0
      },
      monthlyEarnings: Object.entries(groupedPayments).map(([month, data]) => ({
        month, totalAmount: data.totalAmount, payments: data.payments
      }))
    });
  } catch (error) {
    console.error('Error fetching detailed earnings:', error);
    res.status(500).json({ message: 'Error fetching detailed earnings', error: error.message });
  }
};
