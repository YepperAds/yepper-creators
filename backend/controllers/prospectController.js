'use strict';

// Admin-added "prospect" websites — real `websites`/`ad_categories` rows for
// sites the admin already works with offline but hasn't onboarded yet (no
// script installed). They flow through the normal advertiser feed so
// advertisers can express interest in an ad space; that interest is recorded
// in `prospect_interests` for the admin to review and use to go sign the
// site owner. See backend/AdPromoter/controllers/createCategoryController.js
// `expressInterest` for the advertiser-facing half of this feature.

const { query } = require('../config/db');
const Website = require('../AdPromoter/models/CreateWebsiteModel');
const AdCategory = require('../AdPromoter/models/CreateCategoryModel');
const Pricing = require('../models/PricingModel');
const { BUSINESS_CATEGORIES } = require('../creators/utils/businessCategories');
const { resolveImageUrl } = require('../utils/resolveImageUrl');

const PROSPECT_OWNER_ID = 'admin-prospect';

exports.getMeta = async (req, res) => {
  res.json({
    success: true,
    data: { businessCategories: BUSINESS_CATEGORIES, spaceTypes: Pricing.SPACE_TYPES },
  });
};

exports.createProspectWebsite = async (req, res) => {
  try {
    const { websiteName, websiteLink, imageUrl, spaceTypes } = req.body || {};

    if (!websiteName || !String(websiteName).trim()) return res.status(400).json({ success: false, message: 'Website name is required' });
    if (!websiteLink || !String(websiteLink).trim()) return res.status(400).json({ success: false, message: 'Website URL is required' });
    if (!Array.isArray(spaceTypes) || spaceTypes.length === 0)
      return res.status(400).json({ success: false, message: 'Select at least one ad space' });

    const invalidSpaces = spaceTypes.filter((s) => !Pricing.SPACE_TYPES.includes(s));
    if (invalidSpaces.length) return res.status(400).json({ success: false, message: `Invalid ad spaces: ${invalidSpaces.join(', ')}` });

    const resolvedImageUrl = await resolveImageUrl(imageUrl).catch(() => null);

    const site = await Website.create({
      ownerId: PROSPECT_OWNER_ID,
      websiteName: String(websiteName).trim(),
      websiteLink: String(websiteLink).trim(),
      imageUrl: resolvedImageUrl,
      // Admin doesn't pick categories per site — prospects match every advertiser category.
      businessCategories: ['any'],
      isBusinessCategoriesSelected: true,
      trafficTier: 'unverified',
      verificationStatus: 'verified',
    });

    try {
      await Website.update(site.id, { isProspect: true });

      const tierPrices = await Pricing.getTierPrices('unverified');
      const categories = [];
      for (const spaceType of spaceTypes) {
        const category = await AdCategory.create({
          ownerId: PROSPECT_OWNER_ID,
          websiteId: site.id,
          categoryName: spaceType,
          spaceType,
          price: tierPrices[spaceType] ?? 0,
          tier: 'unverified',
          visitorRange: { min: 0, max: 0 },
          userCount: 10,
          webOwnerEmail: 'prospects@yepper.cc',
        });
        categories.push(category);
      }

      res.status(201).json({ success: true, data: { website: { ...site, is_prospect: true }, categories } });
    } catch (innerError) {
      // Don't leave a half-created prospect (website with no/partial ad spaces) behind.
      await query(`DELETE FROM ad_categories WHERE website_id = $1`, [site.id]).catch(() => {});
      await query(`DELETE FROM websites WHERE id = $1`, [site.id]).catch(() => {});
      throw innerError;
    }
  } catch (error) {
    console.error('Error creating prospect website:', error);
    res.status(500).json({ success: false, message: 'Failed to create prospect website', error: error.message });
  }
};

exports.listProspectWebsites = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT w.*,
              COALESCE(
                (SELECT json_agg(json_build_object('id', ac.id, 'categoryName', ac.category_name, 'spaceType', ac.space_type, 'price', ac.price))
                 FROM ad_categories ac WHERE ac.website_id = w.id),
                '[]'
              ) AS spaces,
              (SELECT COUNT(*) FROM prospect_interests pi WHERE pi.website_id = w.id) AS interest_count
       FROM websites w
       WHERE w.is_prospect = true
       ORDER BY w.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listing prospect websites:', error);
    res.status(500).json({ success: false, message: 'Failed to list prospect websites', error: error.message });
  }
};

exports.deleteProspectWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(`SELECT id FROM websites WHERE id = $1 AND is_prospect = true`, [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Prospect website not found' });

    await query(`DELETE FROM ad_categories WHERE website_id = $1`, [id]);
    await query(`DELETE FROM prospect_interests WHERE website_id = $1`, [id]);
    await query(`DELETE FROM websites WHERE id = $1`, [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting prospect website:', error);
    res.status(500).json({ success: false, message: 'Failed to delete prospect website', error: error.message });
  }
};

exports.listProspectInterests = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pi.id, pi.created_at, pi.website_id, pi.category_id,
              w.website_name, w.website_link,
              ac.category_name, ac.space_type,
              c.full_name, c.email, c.username
       FROM prospect_interests pi
       JOIN websites w ON w.id = pi.website_id
       LEFT JOIN ad_categories ac ON ac.id = pi.category_id
       LEFT JOIN creators c ON c.id = pi.advertiser_id
       ORDER BY pi.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error listing prospect interests:', error);
    res.status(500).json({ success: false, message: 'Failed to list prospect interests', error: error.message });
  }
};
