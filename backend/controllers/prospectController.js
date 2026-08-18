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
const { generateSiteScript } = require('../AdPromoter/controllers/SiteScriptController');
const { createNotification } = require('../creators/utils/notificationUtils');
const sendEmailNotification = require('./emailService');

const PROSPECT_OWNER_ID = 'admin-prospect';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

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

// GET /api/websites/prospect/:id — public landing-page data for the "claim
// your website" email link. No auth: a real owner clicking the link from
// their inbox isn't signed in yet. Only whitelisted fields, and only while
// still unclaimed — once claimed this 404s like any other stale link.
exports.getProspectWebsitePublic = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT w.id, w.website_name, w.website_link, w.image_url,
              COALESCE(
                (SELECT json_agg(json_build_object('id', ac.id, 'categoryName', ac.category_name, 'spaceType', ac.space_type, 'price', ac.price))
                 FROM ad_categories ac WHERE ac.website_id = w.id),
                '[]'
              ) AS spaces,
              (SELECT COUNT(*) FROM prospect_interests pi WHERE pi.website_id = w.id) AS interest_count
       FROM websites w
       WHERE w.id = $1 AND w.is_prospect = true`,
      [id]
    );
    const site = rows[0];
    if (!site) return res.status(404).json({ success: false, message: 'This listing has already been claimed, or does not exist.' });

    res.json({
      success: true,
      data: {
        id: site.id,
        websiteName: site.website_name,
        websiteLink: site.website_link,
        imageUrl: site.image_url,
        spaces: site.spaces,
        interestCount: Number(site.interest_count) || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching prospect website:', error);
    res.status(500).json({ success: false, message: 'Failed to load listing', error: error.message });
  }
};

// POST /api/websites/prospect/:id/claim — the real site owner (now
// authenticated) takes over a prospect listing an admin pre-configured on
// their behalf. Re-parents the website + its ad spaces from the
// admin-prospect placeholder to the claimant, and resets verification to
// 'pending' so ownership still gets proven the normal way — the freshly
// generated site script self-confirms the hostname on its first real
// pageview once installed (see analyticsController's domainConfirmed
// handling), exactly like any other new website. The claim link itself is
// not proof of anything; only installing the script on the real domain is.
exports.claimProspectWebsite = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = (req.user.userId || req.user.id || req.user._id)?.toString();
    if (!ownerId) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const site = await Website.findById(id);
    if (!site || !site.is_prospect) {
      return res.status(404).json({ success: false, message: 'This listing has already been claimed, or does not exist.' });
    }

    const updatedWebsite = await Website.update(id, {
      ownerId,
      isProspect: false,
      verificationStatus: 'pending',
    });

    const ownerEmail = req.user.email || null;
    await query(
      `UPDATE ad_categories SET owner_id = $1, web_owner_email = COALESCE($2, web_owner_email) WHERE website_id = $3`,
      [ownerId, ownerEmail, id]
    );

    const siteScript = await generateSiteScript(id).catch(() => null);
    if (siteScript) updatedWebsite.site_script = siteScript;

    createNotification(parseInt(ownerId), 'website_connected', 'Website Claimed',
      `"${site.website_name}" is now yours — install the script to start earning.`,
      { website_name: site.website_name, website_link: site.website_link, icon: '🌐' }
    ).catch(() => {});

    res.status(200).json({ success: true, data: updatedWebsite });
  } catch (error) {
    console.error('Error claiming prospect website:', error);
    res.status(500).json({ success: false, message: 'Failed to claim website', error: error.message });
  }
};

// POST /api/admin/prospect-websites/:id/send-invite — admin-triggered: emails
// the real site owner a link to claim their pre-configured listing. Mirrors
// createCategoryController.sendCategoryInvite's card layout so the recipient
// sees a familiar, real "here's what's waiting for you" preview rather than
// a plain text link.
exports.sendProspectInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body || {};
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'Recipient email is required' });
    }

    const { rows } = await query(
      `SELECT w.*,
              COALESCE(
                (SELECT json_agg(json_build_object('categoryName', ac.category_name, 'spaceType', ac.space_type, 'price', ac.price))
                 FROM ad_categories ac WHERE ac.website_id = w.id),
                '[]'
              ) AS spaces,
              (SELECT COUNT(*) FROM prospect_interests pi WHERE pi.website_id = w.id) AS interest_count
       FROM websites w
       WHERE w.id = $1 AND w.is_prospect = true`,
      [id]
    );
    const site = rows[0];
    if (!site) return res.status(404).json({ success: false, message: 'Prospect website not found' });

    const spaces = Array.isArray(site.spaces) ? site.spaces : [];
    const interestCount = Number(site.interest_count) || 0;
    const link = `${FRONTEND_URL}/ad-promoter/pages/claim-prospect/${site.id}`;
    const safeWebsiteName = escapeHtml(site.website_name);
    const spacesList = spaces.map((s) => `<li style="margin:0 0 4px;">${escapeHtml(s.categoryName || s.spaceType)} — RWF ${Number(s.price || 0).toLocaleString()}/month</li>`).join('');
    const interestLine = interestCount > 0
      ? `<p style="margin:0 0 18px;font-size:14px;color:#111;background:#fef3c7;border-radius:8px;padding:10px 14px;"><strong>${interestCount} advertiser${interestCount === 1 ? ' has' : 's have'}</strong> already shown interest in advertising on ${safeWebsiteName}.</p>`
      : '';

    const subject = `${site.website_name} is ready to earn on Yepper`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 0;"><tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 2px 20px rgba(0,0,0,0.08);overflow:hidden;">
            <tr><td style="background:#000;padding:24px 40px;">
              <table cellpadding="0" cellspacing="0"><tr>
                ${site.image_url ? `<td style="padding-right:12px;"><img src="${site.image_url}" width="40" height="40" style="border-radius:8px;display:block;object-fit:cover;" alt=""/></td>` : ''}
                <td valign="middle">
                  <p style="margin:0;color:#fff;font-size:18px;font-weight:800;">${safeWebsiteName}</p>
                  <p style="margin:2px 0 0;color:#999;font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;">via Yepper</p>
                </td>
              </tr></table>
            </td></tr>

            <tr><td style="padding:32px 40px 0;">
              <p style="color:#111;font-size:16px;font-weight:700;margin:0 0 8px;">We've already set up ad spaces for ${safeWebsiteName} on Yepper.</p>
              <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 18px;">
                Advertisers are already browsing Yepper's marketplace and can see this listing. Claim it to start collecting real payments for the ad space on your own site — takes a couple of minutes to set up.
              </p>

              ${interestLine}

              <div style="border:1px solid #eee;border-radius:12px;padding:16px 18px;margin:0 0 24px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#999;">Ad spaces ready for you</p>
                <ul style="margin:0;padding-left:18px;font-size:14px;color:#333;">${spacesList}</ul>
              </div>

              <table cellpadding="0" cellspacing="0"><tr>
                <td><a href="${link}" style="display:inline-block;background:#000;color:#fff;padding:14px 26px;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;">Claim your website →</a></td>
              </tr></table>

              <p style="color:#999;font-size:13px;line-height:1.5;margin:20px 0 32px;">
                "Claim your website" takes you straight there — sign in (or create a free account) and the listing becomes yours immediately.
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
      return res.status(503).json({ success: false, message: 'Email sending is not configured on this server' });
    }
    res.json({ success: true, message: 'Invite sent', link });
  } catch (error) {
    console.error('Error sending prospect invite:', error);
    res.status(500).json({ success: false, message: 'Failed to send invite', error: error.message });
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
