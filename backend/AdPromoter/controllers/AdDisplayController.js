// AdDisplayController.js — PostgreSQL version
const { query } = require('../../config/db');
const AdCategory = require('../models/CreateCategoryModel');
const Website    = require('../models/CreateWebsiteModel');
const ImportAd   = require('../../AdOwner/models/WebAdvertiseModel');
const Pricing    = require('../../models/PricingModel');
const { getDimensions } = require('../utils/adSpaceLayout');
const { notifyDomainMismatch, notifyPageMismatch, notifyZoneMismatch, notifyZoneReclassified } = require('../../creators/utils/notificationUtils');

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

// Narrows an already-fetched `import_ads` row list down to the ones whose
// advertiser actually paid to show on `path` for this specific category.
// Each ad's own website_selections[].pagesByCategory[categoryId] records the
// pages that purchase covered (see PaymentController.verifyPayment) — absent/
// null means "every page" (either a single-page-locked ad space, a site with
// fewer than 2 registered pages, or an ad bought before this feature
// existed), so those always pass through unfiltered.
function filterAdsByPage(ads, websiteId, categoryId, path) {
  if (!path) return ads;
  return ads.filter((ad) => {
    let selections;
    try {
      selections = Array.isArray(ad.website_selections)
        ? ad.website_selections
        : JSON.parse(ad.website_selections || '[]');
    } catch { return true; }
    const sel = selections.find((s) => s.websiteId === websiteId && Array.isArray(s.categories) && s.categories.includes(categoryId));
    const selectedPages = sel?.pagesByCategory?.[categoryId];
    if (!Array.isArray(selectedPages)) return true;
    return selectedPages.includes(path);
  });
}

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

  // No early return for "nothing sold yet" — a brand-new multi-tier space
  // with zero ads still needs its pricingTiers computed below so displayAd
  // can show the right open-slot filler. `= ANY($1::uuid[])` with an empty
  // array just returns zero rows, so this is safe with nothing sold too.

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

  const pageFiltered = filterAdsByPage(ads, adCategory.website_id?.toString(), categoryId, req?.query?.path);

  // Multi-tier ad spaces ("Shared / Featured / Exclusive"): tag each ad with
  // which tier it bought into, and cap per tier's own maxSlots instead of
  // the single overall user_count (which multi-tier spaces don't use).
  // Ordinary single-price spaces are untouched — pricingTiers is null, so
  // this block is skipped and the old slice(0, user_count) behavior runs.
  const pricingTiers = typeof adCategory.pricing_tiers === 'string'
    ? JSON.parse(adCategory.pricing_tiers) : adCategory.pricing_tiers;

  let adsToShow;
  if (Array.isArray(pricingTiers) && pricingTiers.length > 0) {
    const assignments = typeof adCategory.ad_tier_assignments === 'string'
      ? JSON.parse(adCategory.ad_tier_assignments || '{}') : (adCategory.ad_tier_assignments || {});
    const takenPerTier = {};
    adsToShow = [];

    // Visual rank by actual price (cheapest=0 .. priciest=2), not by which
    // named slot (custom/elite/current) it is — "custom" is whatever the
    // owner typed, so it isn't reliably the most expensive. This is what
    // makes the pricier slot visibly look pricier no matter which slot that
    // turns out to be for this particular space.
    const rankByKey = {};
    [...pricingTiers].sort((a, b) => a.price - b.price).forEach((t, i) => { rankByKey[t.key] = i; });

    // Walk in canonical tier order (shared -> featured -> exclusive) so the
    // rotation's slot order is stable and predictable, not insertion order.
    for (const t of pricingTiers) {
      for (const ad of pageFiltered) {
        if (assignments[ad.id] !== t.key) continue;
        takenPerTier[t.key] = (takenPerTier[t.key] || 0) + 1;
        if (takenPerTier[t.key] > t.maxSlots) continue; // defensive: never show more than a tier's own capacity
        adsToShow.push({ ...ad, tier: t.key, tierLabel: t.label, tierDwellSeconds: t.dwellSeconds, tierRank: rankByKey[t.key] ?? 0 });
      }
    }
  } else {
    adsToShow = pageFiltered.slice(0, adCategory.user_count || pageFiltered.length);
  }

  return { adCategory, website, ads: adsToShow, blocked: false, pricingTiers };
}
exports.resolveCategoryAndAds = resolveCategoryAndAds;

// When the website owner configured more ad slots (user_count) than are
// currently sold, append one "Available Advertising Space" item to the
// rotation so visitors see it (and can buy the remaining slot) instead of
// the open slot just being silently dropped from the loop. Uses the same
// sp-empty/-name/-title/-price/-cta structure (and the site script's already
// -existing .px-empty-* CSS for it) as the client-side no-ads-at-all
// fallback in SiteScriptController.js's renderAds — not the sold-ad
// sp-content/sp-image-wrapper image-forward layout, which has no text to
// show a price/pitch with.
// Short, banner-shaped placements (90px tall — see AD_SPACE_DIMENSIONS in
// adSpaceLayout.js) don't have room for the normal 4-line filler (eyebrow +
// name + "Price" label + amount + button) without the button getting
// clipped by the host's own overflow:hidden. Those get a single-line
// filler instead; everything with real vertical room (Sidebar, Left Rail,
// Floating, Modal, ...) keeps the roomier one.
const BANNER_SHAPE_SPACES = new Set(['Header', 'Above The Fold', 'Beneath Title', 'Pro Footer']);
function isBannerShape(spaceType) {
  return BANNER_SHAPE_SPACES.has(Pricing.canonicalSpace(spaceType));
}

// Both fillers below show advertiserPrice (listed price + Yepper's margin),
// never the raw listed price — this is the exact number initiatePayment
// will actually charge. Showing the listed price here and charging more at
// checkout is a bait-and-switch that costs real trust with advertisers who
// notice, so the public widget and checkout must always agree.
function availableSlotHtml(adCategory, categoryId, marginPercent) {
  const FRONTEND = process.env.FRONTEND_URL || '';
  const advertiserPrice = Math.round(parseFloat(adCategory.price) * (1 + marginPercent / 100));
  const link = `${FRONTEND}/ad-owner/pages/direct-ad?websiteId=${adCategory.website_id}&categoryId=${categoryId}`;
  // Inline, explicit height — never depend on height:100% resolving
  // correctly through the host/customization-slot cascade. When that
  // cascade breaks (customization is empty, so the class rule falls back to
  // height:100% of a parent whose own height didn't resolve either) the box
  // just grows to fit its content instead of clipping, which is what
  // produces a filler that visually floats in a big empty gap. An inline
  // style always wins regardless of what's happening upstream.
  const dims = getDimensions(adCategory.space_type);
  const heightStyle = dims ? ` style="height:${dims.height}px;max-height:${dims.height}px;"` : '';

  if (isBannerShape(adCategory.space_type)) {
    return `
      <div class="sp-item" data-category-id="${categoryId}" data-website-id="${adCategory.website_id}"${heightStyle}>
        <div class="sp-empty sp-empty-compact">
          <span class="sp-empty-price">Advertise here — RWF ${advertiserPrice}/month</span>
          <a class="sp-empty-cta" href="${link}" target="_blank" rel="noopener">Advertise Here</a>
        </div>
      </div>`;
  }
  return `
    <div class="sp-item" data-category-id="${categoryId}" data-website-id="${adCategory.website_id}"${heightStyle}>
      <div class="sp-empty">
        <p class="sp-empty-name">Available Advertising Space</p>
        <p class="sp-empty-title">Price</p>
        <p class="sp-empty-price">RWF ${advertiserPrice}/month</p>
        <a class="sp-empty-cta" href="${link}" target="_blank" rel="noopener">Advertise Here</a>
      </div>
    </div>`;
}

// Multi-tier version of availableSlotHtml above — one filler per tier that
// still has open capacity, each pitching its own tier's price (so an
// "Exclusive" spot advertises itself at the Exclusive price, not the
// cheapest tier's), instead of one generic filler for the whole space.
function tierFillerHtml(adCategory, categoryId, tier, marginPercent, rank) {
  const FRONTEND = process.env.FRONTEND_URL || '';
  const advertiserPrice = Math.round(parseFloat(tier.price) * (1 + marginPercent / 100));
  const link = `${FRONTEND}/ad-owner/pages/direct-ad?websiteId=${adCategory.website_id}&categoryId=${categoryId}&tier=${escapeHtml(tier.key)}`;
  // See the same note in availableSlotHtml above — inline height always wins.
  const dims = getDimensions(adCategory.space_type);
  const heightStyle = dims ? ` style="height:${dims.height}px;max-height:${dims.height}px;"` : '';

  // Same rank-based escalation the sold-ad markup gets (see the tierRank
  // badge/border logic above) — otherwise an empty Custom/Exclusive pitch
  // looks identical to the cheapest tier's, and a visitor (or the advertiser
  // deciding whether it's worth paying more) has no visual reason to believe
  // the pricier slot is actually worth more. Ranked by real price, not by
  // slot name, same as the sold-ad badge.
  const rankAttr = rank != null ? ` data-tier-rank="${rank}"` : '';
  const badge = rank === 2 ? '<span class="sp-badge sp-badge-top">★ Premium spot</span>'
    : rank === 1 ? '<span class="sp-badge">Featured spot</span>'
    : '';

  if (isBannerShape(adCategory.space_type)) {
    return `
      <div class="sp-item" data-category-id="${categoryId}" data-website-id="${adCategory.website_id}" data-tier="${escapeHtml(tier.key)}"${rankAttr}${heightStyle}>
        <div class="sp-empty sp-empty-compact">
          ${badge}
          <span class="sp-empty-price">${escapeHtml(tier.label)} spot — RWF ${advertiserPrice}/month</span>
          <a class="sp-empty-cta" href="${link}" target="_blank" rel="noopener">Advertise Here</a>
        </div>
      </div>`;
  }
  return `
    <div class="sp-item" data-category-id="${categoryId}" data-website-id="${adCategory.website_id}" data-tier="${escapeHtml(tier.key)}"${rankAttr}${heightStyle}>
      <div class="sp-empty">
        ${badge}
        <p class="sp-empty-name">${escapeHtml(tier.label)} spot open</p>
        <p class="sp-empty-title">Price</p>
        <p class="sp-empty-price">RWF ${advertiserPrice}/month</p>
        <a class="sp-empty-cta" href="${link}" target="_blank" rel="noopener">Advertise Here</a>
      </div>
    </div>`;
}

// Turns pricing_tiers' per-tier dwellSeconds into the {key: milliseconds}
// map the injected site script reads to decide how long each tier's ad
// stays on screen (see AdScriptController.js's scheduleNext). null for
// ordinary single-price spaces, where the script falls back to its own
// existing flat dwell time unchanged.
function buildDwellByTier(pricingTiers) {
  if (!Array.isArray(pricingTiers) || !pricingTiers.length) return null;
  return pricingTiers.reduce((acc, t) => {
    acc[t.key] = Math.max(5, t.dwellSeconds || 15) * 1000;
    return acc;
  }, {});
}

exports.displayAd = async (req, res) => {
  try {
    const { categoryId } = req.query;
    if (!categoryId) return res.json({ html: '' });

    const { adCategory, ads: adsToShow, pricingTiers } = await resolveCategoryAndAds(categoryId, req);
    if (!adCategory) return res.json({ html: '' });
    // A brand-new multi-tier space with zero ads sold yet still needs to
    // show its 3 open tiers (not the client's generic single-price empty
    // state) — only bail out to that generic fallback for ordinary,
    // untiered spaces with nothing sold.
    const isTiered = Array.isArray(pricingTiers) && pricingTiers.length > 0;
    if (!isTiered && !adsToShow.length) return res.json({ html: '' });

    const { marginPercent } = await Pricing.getSettings();

    const adsHtml = adsToShow.map(ad => {
      try {
        const imageUrl = escapeHtml(ad.image_url || 'https://via.placeholder.com/1200x630/667eea/ffffff?text=Ad+Image');
        const targetUrl = escapeHtml((ad.business_link || '').startsWith('http') ? ad.business_link : `https://${ad.business_link}`);
        const businessName = escapeHtml(ad.business_name);
        const tierAttr = ad.tier ? ` data-tier="${escapeHtml(ad.tier)}"` : '';
        const rankAttr = Number.isInteger(ad.tierRank) ? ` data-tier-rank="${ad.tierRank}"` : '';
        // The pricier of the 3 tiers doesn't just show longer (see
        // buildDwellByTier) — it visibly looks pricier: a small badge, plus
        // border/shadow rules keyed off data-tier-rank in the site script's
        // injected stylesheet (SiteScriptController.js's injectStyles).
        // Ranked by real price, not by which named slot (custom/elite/
        // current) this is, so it's always accurate regardless of what the
        // owner typed for the custom slot.
        const badge = ad.tierRank === 2 ? '<span class="sp-badge sp-badge-top">★ Exclusive</span>'
          : ad.tierRank === 1 ? '<span class="sp-badge">Featured</span>'
          : '';
        // Image-forward card: no business name/description text in the ad
        // itself — just the creative image (filling the whole box) and a
        // CTA button overlaid on it. businessName is still used for the
        // image's alt text (accessibility, not visible copy).
        return `
          <div class="sp-item" data-ad-id="${ad.id}" data-category-id="${categoryId}" data-website-id="${adCategory.website_id}"${tierAttr}${rankAttr}>
            <a href="${targetUrl}" class="sp-link" target="_blank" rel="noopener" data-tracking="true">
              <div class="sp-content">
                ${badge}
                <div class="sp-image-wrapper"><img class="sp-image" src="${imageUrl}" alt="${businessName}" loading="lazy"></div>
                <button class="sp-cta" type="button">Visit Website</button>
              </div>
            </a>
          </div>`;
      } catch (e) { return ''; }
    }).filter(Boolean).join('');

    // Multi-tier spaces only ever show ONE filler publicly, not one per open
    // tier — showing all 3 side by side would let anyone browsing the site
    // see the whole price ladder for the same physical spot, which is
    // exactly what makes a premium buyer feel cheated if they compare notes
    // with someone who paid less. Which one shows is the owner's own pick
    // (displayed_tier_key, see setDisplayedTier) if they set one and it's
    // still open; otherwise it defaults to the cheapest still-open tier —
    // the one meant to always have an easy sale. Owners who want to sell a
    // tier that *isn't* the one showing publicly use that tier's own direct
    // link instead (see the copy-link buttons in the dashboard) — the
    // checkout page still honors a specific tier from a direct link even
    // when it's not the one on public display.
    let openSlot = '';
    if (Array.isArray(pricingTiers) && pricingTiers.length > 0) {
      const takenPerTier = {};
      adsToShow.forEach((ad) => { if (ad.tier) takenPerTier[ad.tier] = (takenPerTier[ad.tier] || 0) + 1; });
      const openTiers = pricingTiers.filter((t) => (takenPerTier[t.key] || 0) < t.maxSlots);
      const chosen = (adCategory.displayed_tier_key && openTiers.find((t) => t.key === adCategory.displayed_tier_key))
        || [...openTiers].sort((a, b) => a.price - b.price)[0]
        || null;
      const chosenRank = chosen
        ? [...pricingTiers].sort((a, b) => a.price - b.price).findIndex((t) => t.key === chosen.key)
        : null;
      openSlot = chosen ? tierFillerHtml(adCategory, categoryId, chosen, marginPercent, chosenRank) : '';
    } else {
      openSlot = adsToShow.length < (adCategory.user_count || adsToShow.length)
        ? availableSlotHtml(adCategory, categoryId, marginPercent)
        : '';
    }

    return res.json({ html: `<div class="sp-container">${adsHtml}${openSlot}</div>`, dwellByTier: buildDwellByTier(pricingTiers) });
  } catch (error) {
    console.error('Error displaying ad:', error);
    return res.json({ html: '' });
  }
};

exports.searchAd = async (req, res) => {
  try {
    const { categoryId, searchTerm, path } = req.query;
    if (!categoryId) return res.json({ message: 'Missing categoryId' });

    const adCategory = await AdCategory.findById(categoryId);
    if (!adCategory) return res.json({ message: `Can't Find AdCategory ${categoryId}` });

    const selectedAds = Array.isArray(adCategory.selected_ads)
      ? adCategory.selected_ads
      : JSON.parse(adCategory.selected_ads || '[]');

    const term = `%${(searchTerm || '').toLowerCase()}%`;

    const { rows: rawAds } = await query(
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

    const ads = filterAdsByPage(rawAds, adCategory.website_id?.toString(), categoryId, path);
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

// The site-wide script calls this when a category's data-yepper-space div
// exists on a page but that page's path doesn't match the space's configured
// target_path (see SiteScriptController.js's reportPageMismatch) — a real
// placement mistake (wrong page, or a stale Duplicate), not a normal "not
// this page" case, so the owner gets notified instead of it failing silently.
exports.reportPageMismatch = async (req, res) => {
  try {
    const { categoryId, expectedPath, actualPath } = req.body || {};
    if (!categoryId || typeof expectedPath !== 'string' || typeof actualPath !== 'string') {
      return res.status(400).json({ success: false, message: 'categoryId, expectedPath and actualPath are required' });
    }

    const category = await AdCategory.findById(categoryId);
    if (category) {
      notifyPageMismatch(
        category.owner_id, categoryId, category.category_name, expectedPath, actualPath,
      ).catch(() => {});
    }
    res.status(200).json({ success: true });
  } catch (error) {
    // Beacon-fired, best-effort — never let this surface as a real error.
    res.status(200).json({ success: false });
  }
};

// The site-wide script calls this for "All Pages" (no target_path) spaces
// whenever it actually finds the category's data-yepper-space div on a page
// — i.e. real evidence the owner pasted the placement there. Accumulated
// into ad_categories.detected_pages, this is what the advertiser-facing
// "which pages do you want this on" checkout picker is built from, instead
// of the owner's self-reported (and possibly stale/aspirational) websites.pages
// list — an owner can register 6 pages but only ever have pasted the div on 1.
exports.reportSpaceSeen = async (req, res) => {
  try {
    const { categoryId, path } = req.body || {};
    if (!categoryId || typeof path !== 'string' || !path) {
      return res.status(400).json({ success: false, message: 'categoryId and path are required' });
    }
    await AdCategory.recordDetectedPage(categoryId, path);
    res.status(200).json({ success: true });
  } catch (error) {
    // Beacon-fired, best-effort — never let this surface as a real error.
    res.status(200).json({ success: false });
  }
};

// Which canonical space_types make sense inside each geometric zone (a zone
// can have several valid types so we never flip-flop between near-synonyms —
// Strict, one-type-per-zone — a category is only ever "correct" if its own
// type is the exact type that zone means. Deliberately NOT a set of
// near-synonyms: an owner who puts a Header div where a Right Rail should be
// wants it to become a Right Rail, with a Right Rail's own name and price,
// not just "close enough because it's some top-of-page type". Floating/
// Modal/video types are deliberately absent — they're viewport-pinned
// overlays or video-player placements, not page-flow positioned, so
// geometry can't validate them.
const ZONE_DEFAULT_TYPE = {
  header: 'Header', left: 'Left Rail', right: 'Right Rail', center: 'Inline Content', footer: 'Footer',
};
const ZONE_EXEMPT_TYPES = new Set(['Floating', 'Modal', 'Pre-roll', 'Mid-roll', 'Pause']);
const ZONE_HISTORY_LENGTH = 5;
const ZONE_MAJORITY_THRESHOLD = 3;
const TIER_KEY_ORDER = ['custom', 'elite', 'current'];

// Recomputes a tiered category's Elite/Current slot prices for a new space
// type — same lookups createCategoryController.createCategory uses to build
// them the first time (Pricing.getTierPrices('elite') / the website's real
// current traffic tier, capped at Premium). The Custom slot is the owner's
// own typed price, independent of space type, so it's left untouched.
async function repriceTiersForType(category, newType) {
  const tiers = Array.isArray(category.pricing_tiers) ? category.pricing_tiers : [];
  if (!tiers.length) return null;

  const website = await Website.findById(category.website_id);
  const realTier = website?.traffic_tier === 'elite' ? 'premium' : (website?.traffic_tier || 'starter');
  const [elitePrices, currentTierPrices] = await Promise.all([
    Pricing.getTierPrices('elite'),
    Pricing.getTierPrices(realTier),
  ]);
  const currentTierMeta = Pricing.TIERS.find((t) => t.key === realTier);

  const repriced = tiers.map((t) => {
    if (t.key === 'elite' && elitePrices[newType] !== undefined) {
      return { ...t, price: elitePrices[newType] };
    }
    if (t.key === 'current' && currentTierPrices[newType] !== undefined) {
      return { ...t, price: currentTierPrices[newType], label: currentTierMeta?.label || t.label };
    }
    return t; // custom, or no price configured yet for this type — leave as-is
  });
  repriced.sort((a, b) => TIER_KEY_ORDER.indexOf(a.key) - TIER_KEY_ORDER.indexOf(b.key));
  return repriced;
}

// The site-wide script calls this once per render with a purely geometric
// read of where the category's div actually landed on the page (top/left/
// center/right/bottom, as a % of real page height/width — see detectZone in
// SiteScriptController.js). A single pageview can't change anything: a
// rolling history of the last few detections has to agree before this acts,
// so one mobile-vs-desktop layout difference can't flip a category by
// itself, and a single forged beacon can't either. When a real, sustained
// mismatch is confirmed, the category is auto-reclassified (type + price,
// including repricing a tiered space's Elite/Current slots) as long as
// nothing has been sold on it yet — otherwise it's left alone and the owner
// is just notified, exactly like reportPageMismatch does for a wrong-page div.
exports.reportZoneDetected = async (req, res) => {
  try {
    const { categoryId, zone } = req.body || {};
    if (!categoryId || !ZONE_DEFAULT_TYPE[zone]) {
      return res.status(400).json({ success: false, message: 'categoryId and a valid zone are required' });
    }

    const category = await AdCategory.findById(categoryId);
    if (!category) return res.status(200).json({ success: false });

    const canonicalType = Pricing.canonicalSpace(category.space_type);
    if (ZONE_EXEMPT_TYPES.has(canonicalType)) return res.status(200).json({ success: true, exempt: true });

    const priorHistory = Array.isArray(category.zone_detection_history) ? category.zone_detection_history : [];
    const history = [zone, ...priorHistory].slice(0, ZONE_HISTORY_LENGTH);
    const fields = { lastDetectedZone: zone, zoneDetectionHistory: history };

    const newType = ZONE_DEFAULT_TYPE[zone];
    const isValidForZone = canonicalType === newType;
    if (!isValidForZone) {
      const agreement = history.filter((z) => z === zone).length;
      if (agreement >= ZONE_MAJORITY_THRESHOLD) {
        const activeAdIds = await AdCategory.findActiveAdIds(categoryId);
        if (activeAdIds.length === 0) {
          const tierPrices = await Pricing.getTierPrices(category.tier);
          const newPrice = tierPrices[newType];
          if (newPrice !== undefined) {
            fields.spaceType = newType;
            fields.price = newPrice;
            fields.lastReclassifiedAt = new Date().toISOString();
            const repricedTiers = await repriceTiersForType(category, newType);
            if (repricedTiers) fields.pricingTiers = repricedTiers;
            // Only rename if the owner never customized the name beyond the
            // default "this is what the type is called" — respects a real
            // custom title, but a category still just named after its old
            // type (the common case) should read as its new type too.
            if (category.category_name === canonicalType) fields.categoryName = newType;
            notifyZoneReclassified(
              category.owner_id, categoryId, category.category_name, canonicalType, newType, newPrice,
            ).catch(() => {});
          }
        } else {
          notifyZoneMismatch(category.owner_id, categoryId, category.category_name, canonicalType, zone).catch(() => {});
        }
      }
    }

    await AdCategory.update(categoryId, fields);
    res.status(200).json({ success: true });
  } catch (error) {
    // Beacon-fired, best-effort — never let this surface as a real error.
    res.status(200).json({ success: false });
  }
};
