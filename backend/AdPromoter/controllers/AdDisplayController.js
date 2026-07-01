// AdDisplayController.js — PostgreSQL version
const { query } = require('../../config/db');
const AdCategory = require('../models/CreateCategoryModel');
const Website    = require('../models/CreateWebsiteModel');
const ImportAd   = require('../../AdOwner/models/WebAdvertiseModel');
const { notifyDomainMismatch } = require('../../creators/utils/notificationUtils');
const { truncateWords } = require('../utils/adCustomization');

function extractDomain(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch { return null; }
}

// Ad fields (business_name, ad_description, business_link) are
// advertiser-submitted and get interpolated straight into HTML/attributes
// served on yepper's own domain (and, for the script path, innerHTML'd
// directly into the publisher's page) — escape unconditionally so a
// malicious or buggy submission can't break out into markup/script.
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
exports.escapeHtml = escapeHtml;

// Shared by displayAd (JSON, used by the injected script) and the iframe
// embed endpoint (AdScriptController.serveAdEmbed) — both need the exact
// same "is this category allowed to show ads on this referer, and which
// ones" resolution, just rendered into a different envelope.
async function resolveCategoryAndAds(categoryId, req) {
  const adCategory = await AdCategory.findById(categoryId);
  if (!adCategory) return { adCategory: null, website: null, ads: [], blocked: false };

  // Domain check — only block on a definite mismatch (a referer that's present
  // but points elsewhere). Missing referer is allowed through, since some
  // browsers/extensions strip it for privacy and shouldn't break legit placements.
  const website = await Website.findById(adCategory.website_id);
  const registeredDomain = website?.website_link ? extractDomain(website.website_link) : null;
  if (registeredDomain) {
    const referer = req.headers.referer || req.headers.origin || '';
    const incoming = referer ? extractDomain(referer) : null;
    if (incoming && incoming !== registeredDomain) {
      notifyDomainMismatch(website.owner_id, website.id, registeredDomain, incoming).catch(() => {});
      return { adCategory, website, ads: [], blocked: true };
    }
  }

  const selectedAds = Array.isArray(adCategory.selected_ads)
    ? adCategory.selected_ads
    : JSON.parse(adCategory.selected_ads || '[]');

  if (!selectedAds.length) return { adCategory, website, ads: [], blocked: false };

  // Ordered by position in selected_ads (the order ads were sold into this
  // category) — `id = ANY(...)` alone doesn't guarantee row order, and each
  // ad's position here is now also its display-slot index (per-slot
  // customization is keyed by this same index), so it has to be stable
  // across requests instead of whatever order Postgres feels like returning.
  const { rows: ads } = await query(
    `SELECT * FROM import_ads
     WHERE id = ANY($1::uuid[])
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(website_selections) sel
         WHERE sel->>'websiteId' = $2
           AND (sel->>'approved')::boolean = true
           AND sel->>'status' = 'active'
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(sel->'categories') cat_id
             WHERE cat_id = $3
           )
       )
     ORDER BY array_position($1::uuid[], id)`,
    [selectedAds, adCategory.website_id?.toString(), categoryId]
  );

  const adsToShow = ads.slice(0, adCategory.user_count || ads.length);
  return { adCategory, website, ads: adsToShow, blocked: false };
}
exports.resolveCategoryAndAds = resolveCategoryAndAds;

// When the website owner configured more ad slots (user_count) than are
// currently sold, append one "Available Advertising Space" item to the
// rotation so visitors see it (and can buy the remaining slot) instead of
// the open slot just being silently dropped from the loop.
function availableSlotHtml(adCategory, categoryId) {
  const FRONTEND = process.env.FRONTEND_URL || '';
  return `
    <div class="sp-item" data-category-id="${categoryId}" data-website-id="${adCategory.website_id}">
      <a href="${FRONTEND}/ad-owner/pages/direct-ad?websiteId=${adCategory.website_id}&categoryId=${categoryId}" class="sp-link" target="_blank" rel="noopener">
        <div class="sp-content">
          <div class="sp-text-content">
            <h3 class="sp-business-name">Available Advertising Space</h3>
            <p class="sp-description">Price: $${adCategory.price}/mo</p>
            <button class="sp-cta" type="button">Advertise Here</button>
          </div>
        </div>
      </a>
    </div>`;
}

exports.displayAd = async (req, res) => {
  try {
    const { categoryId } = req.query;
    if (!categoryId) return res.json({ html: '' });

    const { adCategory, ads: adsToShow } = await resolveCategoryAndAds(categoryId, req);
    if (!adCategory || !adsToShow.length) return res.json({ html: '' });

    const adsHtml = adsToShow.map(ad => {
      try {
        const imageUrl = escapeHtml(ad.image_url || 'https://via.placeholder.com/1200x630/667eea/ffffff?text=Ad+Image');
        const targetUrl = escapeHtml((ad.business_link || '').startsWith('http') ? ad.business_link : `https://${ad.business_link}`);
        const businessName = escapeHtml(ad.business_name);
        // Cap to 10 words server-side (not just a CSS line-clamp) so the full
        // description never sits in the page's DOM where any visitor can
        // read it via "view source"/devtools regardless of how it's clipped
        // visually.
        const description = escapeHtml(truncateWords(ad.ad_description, 10));
        return `
          <div class="sp-item" data-ad-id="${ad.id}" data-category-id="${categoryId}" data-website-id="${adCategory.website_id}">
            <a href="${targetUrl}" class="sp-link" target="_blank" rel="noopener" data-tracking="true">
              <div class="sp-content">
                <div class="sp-image-wrapper"><img class="sp-image" src="${imageUrl}" alt="${businessName}" loading="lazy"></div>
                <div class="sp-text-content">
                  <h3 class="sp-business-name">${businessName}</h3>
                  <p class="sp-description">${description}</p>
                  <button class="sp-cta" type="button">Visit Website</button>
                </div>
              </div>
            </a>
          </div>`;
      } catch (e) { return ''; }
    }).filter(Boolean).join('');

    const openSlot = adsToShow.length < (adCategory.user_count || adsToShow.length)
      ? availableSlotHtml(adCategory, categoryId)
      : '';

    return res.json({ html: `<div class="sp-container">${adsHtml}${openSlot}</div>` });
  } catch (error) {
    console.error('Error displaying ad:', error);
    return res.json({ html: '' });
  }
};

exports.searchAd = async (req, res) => {
  try {
    const { categoryId, searchTerm } = req.query;
    if (!categoryId) return res.json({ message: 'Missing categoryId' });

    const adCategory = await AdCategory.findById(categoryId);
    if (!adCategory) return res.json({ message: `Can't Find AdCategory ${categoryId}` });

    const selectedAds = Array.isArray(adCategory.selected_ads)
      ? adCategory.selected_ads
      : JSON.parse(adCategory.selected_ads || '[]');

    const term = `%${(searchTerm || '').toLowerCase()}%`;

    const { rows: ads } = await query(
      `SELECT * FROM import_ads
       WHERE id = ANY($1::uuid[])
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(website_selections) sel
           WHERE sel->>'websiteId' = $2
             AND (sel->>'approved')::boolean = true
             AND sel->>'status' = 'active'
             AND EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(sel->'categories') cat_id
               WHERE cat_id = $3
             )
         )
         AND (
           LOWER(business_name) LIKE $4
           OR LOWER(business_link) LIKE $4
           OR LOWER(ad_description) LIKE $4
         )`,
      [selectedAds, adCategory.website_id?.toString(), categoryId, term]
    );

    if (!ads.length) return res.json({ message: 'No Ads Found' });

    const ad = ads[0];
    const targetUrl = (ad.business_link || '').startsWith('http') ? ad.business_link : `https://${ad.business_link}`;
    const desc = (ad.ad_description || '');
    return res.json({
      title: ad.business_name,
      link: targetUrl,
      description: desc.length > 80 ? desc.substring(0, 80) + '...' : desc,
      image: ad.image_url || 'https://via.placeholder.com/600x300',
    });
  } catch (error) {
    console.error('Error in searchAd:', error);
    return res.json({ message: 'ERROR CAUGHT' });
  }
};

// In-memory dedup — sendBeacon/fetch fires once per real pageview/click, so a
// repeat from the same (ip, adId, kind) inside the window is almost certainly
// a replay/script hammering the endpoint directly rather than real traffic.
const recentEvents = new Map(); // `${kind}:${adId}:${ip}` → last-seen ms
const DEDUP_WINDOW_MS = 5_000;

function isDuplicate(kind, adId, ip) {
  const key = `${kind}:${adId}:${ip}`;
  const now = Date.now();
  const last = recentEvents.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  recentEvents.set(key, now);
  if (recentEvents.size > 50_000) { // bound memory — drop oldest-looking half
    let i = 0;
    for (const k of recentEvents.keys()) { if (i++ > 25_000) break; recentEvents.delete(k); }
  }
  return false;
}

// An ad can be approved on multiple websites — only count the event if the
// referer matches one of the domains it's actually approved+active on.
// A missing referer is let through (some browsers/extensions strip it), but
// a referer that's present and doesn't match any approved domain is rejected —
// this is what stops someone curling the adId directly to inflate counters.
async function refererMatchesApprovedSite(ad, req) {
  const referer = req.headers.referer || req.headers.origin || '';
  if (!referer) return true;
  const incoming = extractDomain(referer);
  if (!incoming) return true;

  let selections = [];
  try {
    selections = Array.isArray(ad.website_selections) ? ad.website_selections : JSON.parse(ad.website_selections || '[]');
  } catch { selections = []; }

  const approvedWebsiteIds = selections
    .filter(s => s.status === 'active' && s.approved)
    .map(s => s.websiteId)
    .filter(Boolean);
  if (!approvedWebsiteIds.length) return false;

  const { rows: sites } = await query(`SELECT website_link FROM websites WHERE id = ANY($1::uuid[])`, [approvedWebsiteIds]);
  return sites.some(s => extractDomain(s.website_link) === incoming);
}

exports.incrementView = async (req, res) => {
  try {
    const { adId } = req.params;
    if (!adId || adId === 'undefined' || adId === 'null') {
      return res.status(400).json({ success: false, message: 'Invalid adId' });
    }

    const ad = await ImportAd.findById(adId);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    if (!(await refererMatchesApprovedSite(ad, req))) {
      return res.status(403).json({ success: false, message: 'Referer does not match an approved placement' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
    if (isDuplicate('view', adId, ip)) return res.status(200).json({ success: true, deduped: true });

    await ImportAd.incrementViews(adId);
    await query(
      `INSERT INTO payment_trackers (ad_id, current_views)
       VALUES ($1, 1)
       ON CONFLICT (ad_id) DO UPDATE SET current_views = payment_trackers.current_views + 1`,
      [adId]
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error incrementing view:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.incrementClick = async (req, res) => {
  try {
    const { adId } = req.params;
    if (!adId || adId === 'undefined' || adId === 'null') {
      return res.status(400).json({ success: false, message: 'Invalid adId' });
    }

    const ad = await ImportAd.findById(adId);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    if (!(await refererMatchesApprovedSite(ad, req))) {
      return res.status(403).json({ success: false, message: 'Referer does not match an approved placement' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
    if (isDuplicate('click', adId, ip)) return res.status(200).json({ success: true, deduped: true });

    await ImportAd.incrementClicks(adId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error incrementing click:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
