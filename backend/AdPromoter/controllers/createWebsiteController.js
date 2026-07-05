// createWebsiteController.js
const Website = require('../models/CreateWebsiteModel');
const multer = require('multer');
const User = require('../../models/User');
const Creator = require('../../creators/models/Creator');
const { createNotification } = require('../../creators/utils/notificationUtils');
const path = require('path');
const jwt = require('jsonwebtoken');
const cloudinary = require('../../config/storage');
const dns = require('dns').promises;
const crypto = require('crypto');
require('dotenv').config();

// NOTE: deliberately whitelisted — `websites` rows also hold gsc_access_token /
// gsc_refresh_token / verification_token, and these endpoints are public (no auth).
// Never spread the raw row here.
function toClient(w) {
  if (!w) return null;
  return {
    id: w.id,
    _id: w.id,
    websiteName: w.website_name,
    websiteLink: w.website_link,
    monthlyTraffic: w.monthly_traffic,
    trafficTier: w.traffic_tier,
    siteScript: w.site_script,
    imageUrl: w.image_url,
    ownerId: w.owner_id,
    isBusinessCategoriesSelected: w.is_business_categories_selected,
    verificationStatus: w.verification_status,
    businessCategories: w.business_categories,
    createdAt: w.created_at,
    isProspect: w.is_prospect,
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|tiff|svg/;
    const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase()) &&
                    file.mimetype.startsWith('image/');
    if (isValid) return cb(null, true);
    cb(new Error('Invalid file type. Only image files are allowed.'));
  },
});

const uploadToCloudinary = async (file) => {
  const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', folder: 'yepper_websites', public_id: fileName },
      (error, result) => {
        if (error) return reject(new Error(`Upload failed: ${error.message}`));
        resolve(result.secure_url);
      }
    );
    uploadStream.end(file.buffer);
  });
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  // Fallback to cookies (yepper_session or readable yepper_token) for browser flows
  if (!token && req.cookies) {
    token = req.cookies.yepper_session || req.cookies.yepper_token || null;
  }
  if (!token) return res.status(401).json({ message: 'Access token is required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Prefer Creator lookup (new users use creators table). Fall back to legacy users.
    let user = await Creator.findById(decoded.userId).catch(() => null);
    if (!user) {
      user = await User.findById(decoded.userId).catch(() => null);
    }
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (error) {
    try {
      const masked = token ? `${token.substring(0,8)}...${token.substring(token.length-8)}` : 'no-token';
      console.warn('authenticateToken failed:', error && error.message ? error.message : error, 'maskedToken:', masked);
      const decoded = jwt.decode(token, { complete: true });
      console.warn('authenticateToken decoded (not verified):', decoded ? { header: decoded.header, payload: decoded.payload } : null);
    } catch (e) {
      // ignore logging errors
    }
    return res.status(403).json({ message: 'Invalid token' });
  }
};

function computeTrafficTier(visitors) {
  const v = parseInt(visitors) || 0;
  if (v <= 2000) return 'starter';
  if (v <= 10000) return 'basic';
  if (v <= 50000) return 'standard';
  if (v <= 200000) return 'premium';
  return 'elite';
}

function normalizeDomain(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function buildTxtRecord(token) {
  return `yepper-verify=${token}`;
}

// POST /api/createWebsite/initiate-verification
// No auth required: anyone can request a TXT record to prove domain ownership
exports.initiateVerification = async (req, res) => {
  try {
    const { websiteLink } = req.body;
    if (!websiteLink) return res.status(400).json({ message: 'websiteLink is required' });

    const domain = normalizeDomain(websiteLink);
    if (!domain) return res.status(400).json({ message: 'Invalid website URL' });

    // Reuse existing token if one already exists for this domain and is pending
    const existing = await Website.findByLink(websiteLink);
    const token = (existing && existing.verification_status === 'pending')
      ? existing.verification_token
      : crypto.randomBytes(24).toString('hex');

    res.status(200).json({
      domain,
      verificationToken: token,
      txtRecord: buildTxtRecord(token),
      txtHost: `_yepper-challenge`,
      instructions: [
        `Log in to your DNS provider (e.g. Namecheap, Cloudflare, GoDaddy).`,
        `Add a new TXT record with the host/name: _yepper-challenge`,
        `Set the value to: ${buildTxtRecord(token)}`,
        `Save the record. DNS propagation can take a few minutes — click "Verify" when done.`,
      ],
    });
  } catch (error) {
    console.error('initiateVerification error:', error);
    res.status(500).json({ message: 'Failed to initiate domain verification', error: error.message });
  }
};

// POST /api/createWebsite/verify-domain
// No auth required: allow callers to verify TXT record existence
exports.verifyDomain = async (req, res) => {
  try {
    const { websiteLink, verificationToken } = req.body;
    if (!websiteLink || !verificationToken) {
      return res.status(400).json({ message: 'websiteLink and verificationToken are required' });
    }

    const domain = normalizeDomain(websiteLink);
    if (!domain) return res.status(400).json({ message: 'Invalid website URL' });

    const expectedTxt = buildTxtRecord(verificationToken);
    const lookupHost = `_yepper-challenge.${domain}`;

    let found = false;
    try {
      const records = await dns.resolveTxt(lookupHost);
      found = records.some(rdata => rdata.join('').includes(expectedTxt));
    } catch {
      found = false;
    }

    if (!found) {
      return res.status(200).json({
        verified: false,
        message: `TXT record not found yet. Make sure you added "_yepper-challenge" with value "${expectedTxt}" to your DNS and allow a few minutes for propagation.`,
      });
    }

    res.status(200).json({
      verified: true,
      verificationToken,
      domain,
      message: 'Domain verified successfully!',
    });
  } catch (error) {
    console.error('verifyDomain error:', error);
    res.status(500).json({ message: 'Failed to verify domain', error: error.message });
  }
};

exports.prepareWebsite = [upload.single('file'), authenticateToken, async (req, res) => {
  try {
    const { websiteName, websiteLink } = req.body;
    const ownerId = req.user.id.toString();

    if (!websiteName || !websiteLink) {
      return res.status(400).json({ message: 'Website name and link are required' });
    }

    const existingWebsite = await Website.findByLink(websiteLink);
    if (existingWebsite) return res.status(409).json({ message: 'Website URL already exists' });

    let imageUrl = '';
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file);
      } catch (uploadError) {
        return res.status(500).json({ message: 'Failed to upload file.', error: uploadError.message });
      }
    }

    res.status(200).json({
      ownerId,
      websiteName,
      websiteLink,
      imageUrl,
      tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nextStep: 'business-categories',
    });
  } catch (error) {
    console.error('Error preparing website:', error);
    res.status(500).json({ message: 'Failed to prepare website', error: error.message });
  }
}];

exports.uploadWebsiteImage = [authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { websiteId } = req.params;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const website = await Website.findById(websiteId);
    if (!website) return res.status(404).json({ message: 'Website not found' });
    if (website.owner_id !== req.user.id.toString()) return res.status(403).json({ message: 'Unauthorized' });

    const imageUrl = await uploadToCloudinary(req.file);
    await Website.update(websiteId, { imageUrl });

    res.json({ success: true, imageUrl, message: 'Image uploaded successfully' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to upload image', error: error.message });
  }
}];

async function resolveImageUrl(rawUrl) {
  if (!rawUrl) return '';
  if (!rawUrl.startsWith('data:')) return rawUrl;
  const fileName = `website-icon-${Date.now()}`;
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', folder: 'yepper_websites', public_id: fileName },
      (error, result) => {
        if (error) return reject(new Error(`Cloudinary: ${error.message}`));
        resolve(result.secure_url);
      }
    );
    const base64Data = rawUrl.replace(/^data:image\/\w+;base64,/, '');
    uploadStream.end(Buffer.from(base64Data, 'base64'));
  });
}

exports.createWebsiteWithCategories = [authenticateToken, async (req, res) => {
  try {
    const { websiteName, websiteLink, imageUrl, businessCategories, monthlyTraffic } = req.body;
    const ownerId = req.user.id.toString();

    if (!websiteName || !websiteLink || !businessCategories || !Array.isArray(businessCategories)) {
      return res.status(400).json({ message: 'Website name, link, and business categories are required' });
    }
    if (businessCategories.length === 0) {
      return res.status(400).json({ message: 'At least one business category must be selected' });
    }

    const existingWebsite = await Website.findByLink(websiteLink);
    if (existingWebsite) {
      // Return existing website if owned by the same user — no need to recreate
      if (existingWebsite.owner_id === ownerId) {
        return res.status(200).json({ success: true, data: existingWebsite, alreadyExists: true });
      }
      return res.status(409).json({ message: 'Website URL already exists' });
    }

    const allowedCategories = [
      'any', 'technology', 'food-beverage', 'real-estate', 'automotive',
      'health-wellness', 'entertainment', 'fashion', 'education',
      'business-services', 'travel-tourism', 'arts-culture', 'photography',
      'gifts-events', 'government-public', 'general-retail'
    ];
    const invalidCategories = businessCategories.filter(cat => !allowedCategories.includes(cat));
    if (invalidCategories.length > 0) {
      return res.status(400).json({ message: `Invalid business categories: ${invalidCategories.join(', ')}` });
    }

    const resolvedUrl = await resolveImageUrl(imageUrl).catch(() => null);

    const savedWebsite = await Website.create({
      ownerId,
      websiteName,
      websiteLink,
      imageUrl: resolvedUrl,
      businessCategories,
      isBusinessCategoriesSelected: true,
      monthlyTraffic: parseInt(monthlyTraffic) || 0,
      trafficTier: computeTrafficTier(monthlyTraffic),
      verificationToken: '',
      verificationStatus: 'verified',
    });

    console.log('Website created successfully with ID:', savedWebsite.id);
    createNotification(parseInt(ownerId), 'website_connected', 'Website Connected',
      `"${websiteName}" has been added to your account`,
      { website_name: websiteName, website_link: websiteLink, icon: '🌐' }
    ).catch(() => {});
    res.status(201).json({ success: true, data: savedWebsite, message: 'Website created successfully' });
  } catch (error) {
    console.error('Error creating website with categories:', error);
    res.status(500).json({ message: 'Failed to create website', error: error.message });
  }
}];

exports.createWebsite = [upload.single('file'), authenticateToken, async (req, res) => {
  try {
    const { websiteName, websiteLink } = req.body;
    const ownerId = req.user.id.toString();

    if (!websiteName || !websiteLink) {
      return res.status(400).json({ message: 'Website name and link are required' });
    }

    const existingWebsite = await Website.findByLink(websiteLink);
    if (existingWebsite) return res.status(409).json({ message: 'Website URL already exists' });

    let imageUrl = '';
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file);
      } catch (uploadError) {
        return res.status(500).json({ message: 'Failed to upload file.', error: uploadError.message });
      }
    }

    const savedWebsite = await Website.create({
      ownerId,
      websiteName,
      websiteLink,
      imageUrl,
      businessCategories: [],
      isBusinessCategoriesSelected: false,
    });

    res.status(201).json({ ...savedWebsite, nextStep: 'business-categories' });
  } catch (error) {
    console.error('Error creating website:', error);
    res.status(500).json({ message: 'Failed to create website', error: error.message });
  }
}];

exports.updateWebsiteName = async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { websiteName } = req.body;
    if (!websiteId || !websiteName) return res.status(400).json({ message: 'Missing required fields' });

    const updatedWebsite = await Website.update(websiteId, { websiteName });
    if (!updatedWebsite) return res.status(404).json({ message: 'Website not found' });

    res.status(200).json(updatedWebsite);
  } catch (error) {
    console.error('Error updating website name:', error);
    res.status(500).json({ message: 'Failed to update website name', error: error.message });
  }
};

exports.getAllWebsites = async (req, res) => {
  try {
    const websites = await Website.findAll();
    res.status(200).json(websites.map(toClient));
  } catch (error) {
    console.error('Error fetching websites:', error);
    res.status(500).json({ message: 'Failed to fetch websites', error: error.message });
  }
};

exports.getWebsitesByOwner = async (req, res) => {
  const { ownerId } = req.params;
  try {
    const websites = await Website.findByOwner(ownerId);
    res.status(200).json(websites.map(toClient));  // ← map
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch websites', error });
  }
};

exports.deleteWebsite = async (req, res) => {
  const { websiteId } = req.params;
  const userId = req.user?.id?.toString();
  try {
    const website = await Website.findById(websiteId);
    if (!website) return res.status(404).json({ success: false, message: 'Website not found' });
    if (website.owner_id?.toString() !== userId) return res.status(403).json({ success: false, message: 'Unauthorized' });
    await Website.delete(websiteId);
    res.json({ success: true, message: 'Website removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove website', error: error.message });
  }
};

exports.getWebsiteById = async (req, res) => {
  const { websiteId } = req.params;
  try {
    const website = await Website.findById(websiteId);
    if (!website) return res.status(404).json({ message: 'Website not found' });
    res.status(200).json(toClient(website));  // ← wrap
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch website', error });
  }
};