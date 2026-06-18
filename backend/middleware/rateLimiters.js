// middleware/rateLimiters.js
const rateLimit = require('express-rate-limit');

// Email-sending endpoints (verification resend, password reset) — cheap to spam,
// costs real SMTP quota/reputation, and can be used to harass a third party's inbox.
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in a few minutes.' },
});

// Admin credential check — brute-forceable secret comparison.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'ERR_NODE_AUTH' },
});

module.exports = { emailLimiter, adminLoginLimiter };
