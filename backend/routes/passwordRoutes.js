const express = require('express');
const router = express.Router();
const passwordController = require('../controllers/passwordController');
const { emailLimiter } = require('../middleware/rateLimiters');

router.post('/forgot-password', emailLimiter, passwordController.forgotPassword);
router.post('/waitlist-forgot-password', emailLimiter, passwordController.waitlistForgotPassword);
router.post('/reset-password', passwordController.resetPassword);

module.exports = router;