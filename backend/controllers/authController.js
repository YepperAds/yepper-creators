// authController.js (PostgreSQL) - using creators as main user table
const Creator = require('../creators/models/Creator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmailNotification = require('./emailService');
const { createNotification } = require('../creators/utils/notificationUtils');

// Generate JWT Token — embeds user fields so middleware never needs a DB lookup
const generateToken = (userOrId) => {
  // Accept either a plain userId string (legacy) or a full user object
  const isObject = userOrId && typeof userOrId === 'object';
  const payload = {
    userId:     isObject ? (userOrId.id || userOrId._id) : userOrId,
    email:      isObject ? userOrId.email      : undefined,
    name:       isObject ? (userOrId.full_name || userOrId.name) : undefined,
    username:   isObject ? userOrId.username : undefined,
    whatTheyDo: isObject ? (userOrId.what_they_do || userOrId.whatTheyDo) : undefined,
  };
  // Remove undefined keys to keep the token clean
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// ─── Email helpers ────────────────────────────────────────────────────────────

const buildVerificationHtml = (verificationUrl) => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:20px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:white;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
          <tr><td style="padding:40px;">
            <h1 style="color:#333;font-size:24px;font-weight:bold;margin:0 0 10px 0;text-align:center;">Verify Your Email Address</h1>
            <p style="color:#666;font-size:16px;line-height:1.5;margin:0 0 30px 0;text-align:center;">
              Welcome! Please verify your email address to complete your account setup.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:20px 0;">
                <a href="${verificationUrl}" style="display:inline-block;background-color:#000;color:white;padding:16px 32px;text-decoration:none;font-weight:600;font-size:16px;border-radius:4px;">
                  Verify Email Address
                </a>
              </td></tr>
            </table>
            <p style="color:#999;font-size:14px;text-align:center;margin-top:30px;">This link expires in 1 hour.</p>
            <p style="color:#999;font-size:12px;text-align:center;margin-top:20px;">If you didn't create an account, you can safely ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
`;

const sendVerificationEmail = async (email, token, returnUrl = null) => {
  let verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  if (returnUrl) verificationUrl += `&returnUrl=${encodeURIComponent(returnUrl)}`;

  try {
    const result = await sendEmailNotification(email, 'Verify Your Email Address', buildVerificationHtml(verificationUrl));
    if (result && result.skipped) {
      console.warn('Email sending skipped (SMTP not configured)');
      return result;
    }
    return result.info || result;
  } catch (err) {
    console.error('Email error:', err);
    throw err;
  }
};

const sendWaitlistVerificationEmail = async (email, token, returnUrl = null) => {
  let verificationUrl = `${process.env.WAITLIST_FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  if (returnUrl) verificationUrl += `&returnUrl=${encodeURIComponent(returnUrl)}`;

  try {
    const result = await sendEmailNotification(email, 'Verify Your Email Address', buildVerificationHtml(verificationUrl));
    if (result && result.skipped) {
      console.warn('Email sending skipped (SMTP not configured)');
      return result;
    }
    return result.info || result;
  } catch (err) {
    console.error('Email error:', err);
    throw err;
  }
};

const maskEmail = (email) => {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) return `${localPart[0]}*****@${domain}`;
  const visibleChars = Math.min(2, localPart.length - 1);
  return `${localPart.substring(0, visibleChars)}*****@${domain}`;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

exports.register = async (req, res) => {
  try {
    const { name, email, password, returnUrl } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      if (existingUser.is_verified) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists and is verified. Please sign in instead.',
        });
      } else {
        // Delete the unverified user and allow re-registration
        await User.delete(existingUser.id);
        console.log('Deleted unverified user for re-registration:', email);
      }
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    const user = await User.create({
      name,
      email,
      password,
      verificationToken,
      verificationTokenExpires,
      isVerified: false,
    });

    try {
      await sendVerificationEmail(email, verificationToken, returnUrl);
      res.status(201).json({
        success: true,
        requiresVerification: true,
        maskedEmail: maskEmail(email),
        message: 'Account created successfully. Please check your email to verify your account and get started.',
      });
    } catch (emailError) {
      await User.delete(user.id);
      console.error('Email sending failed:', emailError);
      res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again later.' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration. Please try again.' });
  }
};

exports.registerWaitlist = async (req, res) => {
  try {
    const { name, email, password, returnUrl } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      if (existingUser.is_verified) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists and is verified. Please sign in instead.',
        });
      } else {
        await User.delete(existingUser.id);
        console.log('Deleted unverified user for re-registration:', email);
      }
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 3600000);

    const user = await User.create({
      name,
      email,
      password,
      verificationToken,
      verificationTokenExpires,
      isVerified: false,
    });

    try {
      await sendWaitlistVerificationEmail(email, verificationToken, returnUrl);
      res.status(201).json({
        success: true,
        requiresVerification: true,
        maskedEmail: maskEmail(email),
        message: 'Account created successfully. Please check your email to verify your account and get started.',
      });
    } catch (emailError) {
      await User.delete(user.id);
      console.error('Email sending failed:', emailError);
      res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again later.' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration. Please try again.' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token, returnUrl } = req.query;

    if (!token) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-error?reason=missing_token`);
    }

    const user = await User.findByVerificationToken(token);
    if (!user || new Date(user.verification_token_expires) < new Date()) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-error?reason=invalid_token`);
    }

    await User.update(user.id, {
      isVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
    });

    const authToken = generateToken({ ...user, is_verified: true });

    let redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-success?token=${authToken}&auto_login=true`;
    if (returnUrl) redirectUrl += '&fromDirectAdvertise=true';

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Email verification error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-error?reason=server_error`);
  }
};

exports.verifyWaitlistEmail = async (req, res) => {
  try {
    const { token, returnUrl } = req.query;

    if (!token) {
      return res.redirect(`${process.env.WAITLIST_FRONTEND_URL || 'http://localhost:3000'}/verify-error?reason=missing_token`);
    }

    const user = await User.findByVerificationToken(token);
    if (!user || new Date(user.verification_token_expires) < new Date()) {
      return res.redirect(`${process.env.WAITLIST_FRONTEND_URL || 'http://localhost:3000'}/verify-error?reason=invalid_token`);
    }

    await User.update(user.id, {
      isVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
    });

    const authToken = generateToken({ ...user, is_verified: true });

    let redirectUrl = `${process.env.WAITLIST_FRONTEND_URL || 'http://localhost:3000'}/verify-success?token=${authToken}&auto_login=true`;
    if (returnUrl) redirectUrl += '&fromDirectAdvertise=true';

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Email verification error:', error);
    res.redirect(`${process.env.WAITLIST_FRONTEND_URL || 'http://localhost:3000'}/verify-error?reason=server_error`);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await User.comparePassword(user, password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.is_verified) {
      return res.status(400).json({
        success: false,
        requiresVerification: true,
        maskedEmail: maskEmail(email),
        message: 'Please verify your email address first. Check your inbox for the verification email.',
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isVerified: user.is_verified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email, returnUrl } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    if (user.is_verified) {
      return res.status(400).json({ success: false, message: 'This email is already verified.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 3600000);

    await User.update(user.id, { verificationToken, verificationTokenExpires });

    try {
      await sendVerificationEmail(email, verificationToken, returnUrl);
      res.json({ success: true, message: 'Verification email sent successfully. Click the link in the email to verify and sign in.' });
    } catch (emailError) {
      res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again.' });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

exports.resendWaitlistVerification = async (req, res) => {
  try {
    const { email, returnUrl } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    if (user.is_verified) {
      return res.status(400).json({ success: false, message: 'This email is already verified.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 3600000);

    await User.update(user.id, { verificationToken, verificationTokenExpires });

    try {
      await sendWaitlistVerificationEmail(email, verificationToken, returnUrl);
      res.json({ success: true, message: 'Verification email sent successfully. Click the link in the email to verify and sign in.' });
    } catch (emailError) {
      res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again.' });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const creator = await Creator.findById(req.user.userId);
    if (!creator) return res.status(404).json({ message: 'User not found' });

    res.json({
      user: {
        id: creator.id,
        name: creator.full_name || null,
        fullName: creator.full_name || null,
        email: creator.email,
        avatar: creator.avatar,
        googleId: creator.google_id,
        username: creator.username,
        what_they_do: creator.what_they_do,
        whatTheyDo: creator.what_they_do,
        createdAt: creator.created_at,
        updatedAt: creator.updated_at,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    const creator = await Creator.findById(req.user.userId);
    if (!creator) return res.status(404).json({ message: 'User not found' });

    res.json({
      success: true,
      user: {
        id: creator.id,
        _id: creator.id,
        name: creator.full_name || null,
        fullName: creator.full_name || null,
        email: creator.email,
        avatar: creator.avatar,
        username: creator.username,
        what_they_do: creator.what_they_do,
        whatTheyDo: creator.what_they_do,
        googleId: creator.google_id,
        createdAt: creator.created_at,
        updatedAt: creator.updated_at,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Server error', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

exports.googleSuccess = async (req, res) => {
  if (req.user) {
    const token = generateToken(req.user);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/success?token=${token}`);
  } else {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`);
  }
};

exports.googleFailure = (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`);
};
// ─────────────────────────────────────────────────────────────────────────────
// [YEPPER-MERGE] Google Token Exchange
// ─────────────────────────────────────────────────────────────────────────────
// New endpoint called by the Next.js /api/auth/google/callback route.
// Receives a verified Google profile (already validated by Next.js against
// Google's userinfo endpoint), upserts the user in the `users` table, and
// returns a Yepper JWT — same JWT format used for email/password login.
//
// Route: POST /api/auth/google-exchange
// Body:  { googleId, email, name, avatar }
// ─────────────────────────────────────────────────────────────────────────────
exports.googleExchange = async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ success: false, message: 'googleId and email are required' });
    }

    // Try to find existing creator by googleId first, then by email
    let creator = await Creator.findByGoogleId(googleId);

    if (!creator) {
      creator = await Creator.findByEmail(email);
      if (creator) {
        // Link Google account to existing email account
        creator = await Creator.update(creator.id, { google_id: googleId, avatar: avatar || creator.avatar });
      } else {
        // Brand new user via Google — create and return full creator
        creator = await Creator.create({ googleId, email, fullName: name || email.split('@')[0], avatar: avatar || '' });
      }
    }

    if (!creator) return res.status(500).json({ success: false, message: 'Failed to create or find user' });

    const token = generateToken(creator);

    // Determine whether user needs to complete profile (username/what_they_do)
    const needsProfile = !creator.username || !creator.what_they_do;

    return res.json({
      success: true,
      token,
      needsProfile: Boolean(needsProfile),
      user: {
        id:         creator.id,
        _id:        creator.id,
        fullName:   creator.full_name || null,
        email:      creator.email,
        avatar:     creator.avatar || null,
        googleId:   creator.google_id || null,
        username:   creator.username || null,
        whatTheyDo: creator.what_they_do || null,
      },
    });
  } catch (error) {
    console.error('[YEPPER-MERGE] googleExchange error:', error);
    res.status(500).json({ success: false, message: 'Server error during Google exchange' });
  }
};

// Complete profile after Google signup
exports.completeProfile = async (req, res) => {
  try {
    // authMiddleware already verified the token and set req.user
    const userId = req.user?.userId || req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { username, what_they_do } = req.body;
    if (!username || !what_they_do) {
      return res.status(400).json({ success: false, message: 'username and what_they_do are required' });
    }

    // Check username availability — exclude the current user so unchanged usernames don't self-conflict
    const available = await Creator.isUsernameAvailable(username, userId);
    if (!available) return res.status(400).json({ success: false, message: 'Username already taken' });

    // Accept base64 data URIs or https URLs; store directly in the TEXT column
    const rawAvatar = req.body.avatar;
    const avatarValue = (rawAvatar && typeof rawAvatar === 'string' &&
      (rawAvatar.startsWith('data:') || rawAvatar.startsWith('http')))
      ? rawAvatar : null;

    // Fetch current values so we can report exactly what changed
    const current = await Creator.findById(userId).catch(() => null);

    const updateFields = { username, what_they_do, ...(avatarValue ? { avatar: avatarValue } : {}) };
    const updated = await Creator.update(userId, updateFields);
    if (!updated) return res.status(500).json({ success: false, message: 'Failed to update profile' });

    // Fire a separate notification for each field that actually changed
    if (current) {
      if (current.username !== username) {
        createNotification(userId, 'profile_updated', 'Username Updated',
          `Your username was changed to @${username}`,
          { field: 'username', old: current.username, new: username }
        ).catch(() => {});
      }
      if (current.what_they_do !== what_they_do) {
        createNotification(userId, 'profile_updated', 'Role Updated',
          `Your role was updated to ${what_they_do}`,
          { field: 'role', old: current.what_they_do, new: what_they_do }
        ).catch(() => {});
      }
      if (avatarValue && current.avatar !== avatarValue) {
        createNotification(userId, 'profile_updated', 'Profile Picture Updated',
          'Your profile picture has been changed.',
          { field: 'avatar' }
        ).catch(() => {});
      }
      // If nothing specific changed (edge case), send a generic one
      if (current.username === username && current.what_they_do === what_they_do && !avatarValue) {
        createNotification(userId, 'profile_updated', 'Profile Updated',
          'No changes were detected.',
          {}
        ).catch(() => {});
      }
    } else {
      createNotification(userId, 'profile_updated', 'Profile Updated',
        `Your profile has been updated — @${username}`,
        { username, what_they_do }
      ).catch(() => {});
    }

    return res.json({ success: true, data: { user: updated } });
  } catch (err) {
    console.error('completeProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};