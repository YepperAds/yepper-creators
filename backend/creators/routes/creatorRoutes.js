'use strict';

const express    = require('express');
const multer     = require('multer');
const os         = require('os');
const path       = require('path');
const router     = express.Router();
const controller = require('../controllers/creatorController');
const adSpaces   = require('../controllers/adSpaceController');

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename:    (req, file, cb) => cb(null, `ypr_ad_${file.fieldname}_${Date.now()}${path.extname(file.originalname) || (file.fieldname === 'adImage' ? '.png' : '.mp4')}`),
  }),
  limits:     { fileSize: 512 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'adImage') return file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Ad creative must be an image'));
    return file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('Only video files allowed'));
  },
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.get('/auth/creator/google',          controller.googleInitiate);
router.get('/auth/creator/google/callback', controller.googleCallback);
router.get('/auth/creator/session',         controller.getSession);
router.get('/auth/creator/check-username',  controller.checkUsername);
router.post('/auth/creator/logout',         controller.logout);

// ─── Public ────────────────────────────────────────────────────────────────────
router.get('/api/creators/public',              controller.getPublicCreators);

// ─── Social stats ─────────────────────────────────────────────────────────────
router.get('/api/social/stats',                 controller.getSocialStats);
router.get('/api/social/video-stats',           controller.getSocialVideoStats);
router.post('/api/social/disconnect/:provider', controller.disconnectSocial);
router.post('/api/social/refresh/:provider',    controller.refreshSocialStats);

// ─── Ad posts ─────────────────────────────────────────────────────────────────
router.post(
  '/api/social/post-ad/:provider',
  videoUpload.fields([{ name: 'video', maxCount: 1 }, { name: 'adImage', maxCount: 1 }]),
  controller.postAdVideo,
);
router.get('/api/social/ad-posts',              controller.getAdPosts);
router.get('/api/social/ad-overlay/estimate',   controller.estimateAdOverlay);

// ─── Ad spaces (advertiser claims a creator's intro/middle/end slot) ─────────
router.get('/api/social/youtube/ad-spaces/:creatorId',        adSpaces.getAdSpaces);
router.post(
  '/api/social/youtube/ad-spaces/:creatorId/claim',
  adSpaces.imageUpload.single('image'),
  adSpaces.claimAdSpace,
);
router.get('/api/social/ad-claims/pending',                   adSpaces.getPendingClaims);

// ─── Social OAuth ─────────────────────────────────────────────────────────────
router.get('/api/connect/:provider',          controller.socialConnect);
router.get('/api/connect/:provider/callback', controller.socialConnectCallback);

// ─── Notifications ────────────────────────────────────────────────────────────
router.get('/api/notifications',              controller.getNotifications);
router.post('/api/notifications/mark-read',   controller.markNotificationsRead);
router.delete('/api/notifications/:id',       controller.deleteNotification);
router.get('/api/notifications/stream',       controller.notificationsStream);

// ─── Website ─────────────────────────────────────────────────────────────────
router.get('/api/website',                    controller.getWebsite);
router.post('/api/website/start',             controller.startWebsite);
router.post('/api/website/verify',            controller.verifyWebsite);
router.post('/api/website/traffic/refresh',   controller.refreshTraffic);
router.delete('/api/website',                 controller.deleteWebsite);
router.post('/api/website/connect',           controller.connectWebsite);

// ─── Deprecated tracking stubs (410 Gone) ────────────────────────────────────
router.get('/api/website/tracker.js',         (req, res) => res.type('application/javascript').status(410).send(''));
router.options('/api/website/collect',        (req, res) => res.sendStatus(410));
router.use('/api/website/collect',            express.text({ type: 'text/plain', limit: '20kb' }));
router.post('/api/website/collect',           (req, res) => res.sendStatus(410));

// ─── Adsense bridge ───────────────────────────────────────────────────────────
router.get('/api/handoff/:token/data',        controller.getHandoffData);
router.post('/api/adsense/proceed',           controller.adsenseProceed);
router.get('/api/adsense/handoff/:token',     controller.redeemHandoff);

// ─── Wallet ───────────────────────────────────────────────────────────────────
router.get('/api/wallet',                     controller.getWallet);
router.get('/api/wallet/transactions',        controller.getWalletTransactions);

// ─── Webhooks ─────────────────────────────────────────────────────────────────
router.get('/api/webhooks/instagram',         controller.instagramWebhook);

module.exports = router;
