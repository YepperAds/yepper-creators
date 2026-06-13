// authRoutes.js
const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authmiddleware');

const router = express.Router();

// Manual register/login disabled — use Google OAuth only
router.post('/register', (req, res) => res.status(405).json({ success: false, message: 'Registration disabled. Use Google Sign-In.' }));
router.post('/register-waitlist', (req, res) => res.status(405).json({ success: false, message: 'Registration disabled. Use Google Sign-In.' }));
router.post('/login', (req, res) => res.status(405).json({ success: false, message: 'Manual login disabled. Use Google Sign-In.' }));

// Verify email
router.get('/verify-email', authController.verifyEmail);
router.get('/verify-waitlist-email', authController.verifyWaitlistEmail);

// Resend verification
router.post('/resend-verification', authController.resendVerification);
router.post('/resend-waitlist-verification', authController.resendWaitlistVerification);

// Get profile (protected route)
router.get('/profile', authMiddleware, authController.getProfile);

// Get user (protected route)
router.get('/me', authMiddleware, authController.getCurrentUser);

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/webmasters.readonly',
    ],
    accessType: 'offline',
    prompt: 'consent',   // always show consent so refresh_token is returned
  })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/google/failure' }),
  authController.googleSuccess
);

router.get('/google/failure', authController.googleFailure);

// [YEPPER-MERGE] Google profile exchange — called by Next.js /api/auth/google/callback
// Receives a verified Google profile from Next.js and returns a Yepper JWT.
router.post('/google-exchange', authController.googleExchange);
router.post('/complete-profile', authMiddleware, authController.completeProfile);

module.exports = router;