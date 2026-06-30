// AdCategoryRoutes.js — PostgreSQL version
const express  = require('express');
const router   = express.Router();
const AdCategory  = require('../models/CreateCategoryModel');
const categoryController   = require('../controllers/createCategoryController');
const WalletController     = require('../controllers/WalletController');
const WithdrawalController = require('../controllers/WithdrawalController');
const adRejectionController = require('../controllers/AdRejectionController');
const authMiddleware  = require('../../middleware/authmiddleware');
const earningsController = require('../controllers/earningsController');
const {
  resolveAllSlots, TEMPLATES, FONTS, SHADOWS,
  MIN_WIDTH, MAX_WIDTH, MIN_HEIGHT, MAX_HEIGHT, MAX_SLOTS,
  MIN_IMAGE_HEIGHT, MAX_IMAGE_HEIGHT, MIN_IMAGE_WIDTH_PCT, MAX_IMAGE_WIDTH_PCT,
  clampNumber,
} = require('../utils/adCustomization');

// ── PUBLIC ───────────────────────────────────────────────────────────────────

router.get('/space/:categoryId', async (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    const category = await AdCategory.findById(req.params.categoryId);
    if (!category) return res.status(404).json({ error: 'Space not found' });
    // Return only public fields
    res.json({
      id: category.id,
      categoryName: category.category_name,
      spaceType: category.space_type,
      price: category.price,
      defaultLanguage: category.default_language,
      placementMode: category.placement_mode,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch space' });
  }
});

router.get('/ads/customization/:categoryId', async (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.header('Expires', '0');
    const category = await AdCategory.findById(req.params.categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    // Slots are resolved (defaults + template + overrides flattened) here so
    // every renderer just consumes ready-to-use bundles — no template/default
    // logic duplicated across the three rendering surfaces.
    const { slots, fontImports } = resolveAllSlots(category.customization, category.user_count);
    res.json({ slots, fontImports, timestamp: Date.now() });
  } catch (error) {
    console.error('Error fetching customization:', error);
    res.status(500).json({ error: 'Failed to fetch customization' });
  }
});

router.get('/category/:categoryId', categoryController.getCategoryById);

// Advertiser-facing ad-space browse for a website — read-only, doesn't touch
// req.user, and is called both by logged-in advertisers (AdvertiseBrowser)
// and the admin Hot Deal builder (which has no advertiser session at all).
// Was sitting behind authMiddleware below, so the admin builder's unauthenticated
// request 401'd and silently rendered an empty ad-space dropdown.
router.get('/:websiteId/advertiser', categoryController.getCategoriesByWebsiteForAdvertisers);

// ── AUTHENTICATED ────────────────────────────────────────────────────────────

router.use(authMiddleware);

router.post('/', categoryController.createCategory);
router.get('/', categoryController.getCategories);

router.get('/earnings/:categoryId', earningsController.getCategoryEarnings);
router.get('/pending-rejections', adRejectionController.getPendingRejections);
router.get('/active-ads', categoryController.getActiveAds);

router.get('/wallet', WalletController.getWallet);
router.get('/wallet/transactions', WalletController.getWalletTransactions);
router.post('/wallet/:ownerType/withdrawal-request', WithdrawalController.createWithdrawalRequest);
router.get('/wallet/:ownerType/withdrawal-requests', WithdrawalController.getUserWithdrawalRequests);
router.get('/wallet/:ownerType/balance', WalletController.getWalletBalance);
router.get('/wallet/:ownerType/transactions', WalletController.getTransactionHistory);
router.patch('/wallet/withdrawal-request/:requestId/cancel', WithdrawalController.cancelWithdrawalRequest);

router.get('/admin/withdrawal-requests', WithdrawalController.getAllWithdrawalRequests);
router.patch('/admin/withdrawal-request/:requestId/process', WithdrawalController.processWithdrawalRequest);

// Direct category lookup (duplicate route kept for compatibility)
router.get('/categoriees/:categoryId', async (req, res) => {
  try {
    const category = await AdCategory.findById(req.params.categoryId);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching category' });
  }
});

// Customization save
router.put('/categoriees/:categoryId/customization', async (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', 'https://www.yepper.cc');
    res.header('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    res.header('Access-Control-Allow-Credentials', 'true');

    const { categoryId } = req.params;
    const { slotIndex, customization, reset } = req.body;
    const idx = parseInt(slotIndex, 10);
    if (!Number.isInteger(idx) || idx < 0 || idx >= MAX_SLOTS) {
      return res.status(400).json({ error: 'Invalid slotIndex' });
    }

    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const ownerId = category.owner_id?.toString();
    const userId  = (req.user.id || req.user._id || req.user.userId)?.toString();
    if (ownerId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    // Each ad slot is styled independently — picking a template/color for
    // slot 0 must never bleed into slot 1's look — so this can only ever
    // touch the one slot the dashboard is currently editing.
    const maxSlots = Math.max(1, category.user_count || 1);
    if (idx >= maxSlots) {
      return res.status(400).json({ error: `This category only has ${maxSlots} ad space(s) configured` });
    }

    const existing = category.customization || {};
    const slots = { ...(existing.slots || {}) };

    if (reset) {
      delete slots[String(idx)];
    } else {
      if (!customization || typeof customization !== 'object') {
        return res.status(400).json({ error: 'Invalid customization payload' });
      }
      const sanitized = { ...customization };
      if (sanitized.template && !TEMPLATES[sanitized.template]) delete sanitized.template;
      if (sanitized.fontFamily && !FONTS[sanitized.fontFamily]) delete sanitized.fontFamily;
      if (sanitized.shadow && !SHADOWS[sanitized.shadow]) delete sanitized.shadow;
      // Server-side floor/ceiling — not just the dashboard slider's min/max —
      // so a direct API call can't shrink an ad box to near-invisible to
      // dodge showing ads it's still being paid to show.
      if ('width' in sanitized) {
        const w = clampNumber(sanitized.width, MIN_WIDTH, MAX_WIDTH);
        if (w === undefined) delete sanitized.width; else sanitized.width = w;
      }
      if ('height' in sanitized) {
        const h = clampNumber(sanitized.height, MIN_HEIGHT, MAX_HEIGHT);
        if (h === undefined) delete sanitized.height; else sanitized.height = h;
      }
      // Same reasoning — an uncapped image can blow the whole card out of
      // proportion (or be shrunk to nothing to dodge view counts).
      if ('imageHeight' in sanitized) {
        const ih = clampNumber(sanitized.imageHeight, MIN_IMAGE_HEIGHT, MAX_IMAGE_HEIGHT);
        if (ih === undefined) delete sanitized.imageHeight; else sanitized.imageHeight = ih;
      }
      if ('imageWidthPercent' in sanitized) {
        const iw = clampNumber(sanitized.imageWidthPercent, MIN_IMAGE_WIDTH_PCT, MAX_IMAGE_WIDTH_PCT);
        if (iw === undefined) delete sanitized.imageWidthPercent; else sanitized.imageWidthPercent = iw;
      }
      slots[String(idx)] = sanitized;
    }

    const merged = { ...existing, slots };
    const updated = await AdCategory.update(categoryId, { customization: merged });

    res.json({ success: true, message: 'Customization saved successfully', customization: updated.customization, timestamp: Date.now() });
  } catch (error) {
    console.error('Error saving customization:', error);
    res.status(500).json({ error: 'Failed to save customization', message: error.message });
  }
});

router.patch('/category/:categoryId/language', categoryController.updateCategoryLanguage);
router.get('/pending/:ownerId', categoryController.getPendingAds);
router.put('/approve/:adId/website/:websiteId', categoryController.approveAdForWebsite);
router.post('/reject/:adId/:websiteId/:categoryId', adRejectionController.rejectAd);
router.put('/:categoryId/reset-user-count', categoryController.resetUserCount);
router.post('/:categoryId/send-invite', categoryController.sendCategoryInvite);
router.delete('/:categoryId', categoryController.deleteCategory);

// ── WILDCARD — must be last ──────────────────────────────────────────────────
router.get('/:websiteId', categoryController.getCategoriesByWebsite);

module.exports = router;
