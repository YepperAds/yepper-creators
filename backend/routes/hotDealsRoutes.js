// routes/hotDealsRoutes.js — public listing + advertiser purchase.
// Admin CRUD for Hot Deals lives under /api/admin/hot-deals — see adminRoutes.js.
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/hotDealsController');
const { imageUpload } = require('../creators/controllers/adSpaceController');

router.get('/', ctrl.getPublicHotDeals);
router.post('/verify-callback', ctrl.verifyPurchase);
router.post('/:id/purchase', imageUpload.single('image'), ctrl.initiatePurchase);

module.exports = router;
