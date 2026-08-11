// AdPromoter/models/CreateCategoryModel.js (PostgreSQL)
const { query } = require('../../config/db');

const AdCategory = {
  async create(data) {
    const { rows } = await query(
      `INSERT INTO ad_categories (owner_id, website_id, category_name, description, price, space_type,
        user_count, instructions, default_language, custom_attributes, placement_mode, placeholder_div,
        api_codes, web_owner_email, visitor_range_min, visitor_range_max, tier, customization, target_path,
        pricing_tiers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [data.ownerId, data.websiteId, data.categoryName, data.description||null, data.price,
       data.spaceType, data.userCount||0, data.instructions||null, data.defaultLanguage||'english',
       JSON.stringify(data.customAttributes||{}), data.placementMode||'auto',
       data.placeholderDiv||null, JSON.stringify(data.apiCodes||{}),
       data.webOwnerEmail, data.visitorRange?.min, data.visitorRange?.max,
       data.tier, data.customization ? JSON.stringify(data.customization) : null,
       data.targetPath || null,
       // NULL = single-price space (today's behavior, unchanged). Only set
       // when the web owner opts into Shared/Featured/Exclusive splitting.
       data.pricingTiers ? JSON.stringify(data.pricingTiers) : null]
    );
    return rows[0];
  },
  async findById(id) {
    const { rows } = await query(`SELECT * FROM ad_categories WHERE id = $1`, [id]);
    return rows[0] || null;
  },
  async findByOwner(ownerId) {
    const { rows } = await query(`SELECT * FROM ad_categories WHERE owner_id = $1 ORDER BY created_at DESC`, [ownerId]);
    return rows;
  },
  async findByWebsite(websiteId) {
    const { rows } = await query(`SELECT * FROM ad_categories WHERE website_id = $1 ORDER BY created_at DESC`, [websiteId]);
    return rows;
  },
  async update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return this.findById(id);
    const setClauses = keys.map((k,i) => `${toSnake(k)} = $${i+2}`).join(', ');
    const vals = keys.map(k => typeof fields[k]==='object'&&fields[k]!==null ? JSON.stringify(fields[k]) : fields[k]);
    const { rows } = await query(
      `UPDATE ad_categories SET ${setClauses} WHERE id = $1 RETURNING *`, [id, ...vals]
    );
    return rows[0] || null;
  },
  async delete(id) { await query(`DELETE FROM ad_categories WHERE id = $1`, [id]); },
  // Multi-tier ad spaces: how many currently-active ads are booked into each
  // tier of this category. "Active" mirrors the same definition used
  // everywhere else fill is computed (AdDisplayController.resolveCategoryAndAds,
  // createCategoryController.getCategoriesByWebsiteForAdvertisers) — an
  // import_ads row with an approved+active website_selections entry for this
  // category — rather than trusting ad_tier_assignments alone, which never
  // gets cleaned up if an ad is later rejected/expired.
  async countActiveAdsByTier(categoryId) {
    const { rows } = await query(
      `SELECT ac.ad_tier_assignments, ARRAY_AGG(ia.id) AS active_ad_ids
       FROM ad_categories ac
       LEFT JOIN import_ads ia ON EXISTS (
         SELECT 1 FROM jsonb_array_elements(ia.website_selections) sel
         WHERE sel->>'websiteId' = ac.website_id::text
           AND (sel->>'approved')::boolean = true
           AND sel->>'status' = 'active'
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(sel->'categories') cat_id
             WHERE cat_id = ac.id::text
           )
       )
       WHERE ac.id = $1
       GROUP BY ac.id`,
      [categoryId]
    );
    const row = rows[0];
    if (!row) return {};
    const assignments = typeof row.ad_tier_assignments === 'string'
      ? JSON.parse(row.ad_tier_assignments) : (row.ad_tier_assignments || {});
    const activeIds = (row.active_ad_ids || []).filter(Boolean);
    const counts = {};
    for (const adId of activeIds) {
      const tierKey = assignments[adId];
      if (tierKey) counts[tierKey] = (counts[tierKey] || 0) + 1;
    }
    return counts;
  },
  // Best-effort, idempotent — the WHERE clause makes repeat beacons for a
  // path already on file a no-op instead of growing the array unbounded.
  async recordDetectedPage(id, path) {
    await query(
      `UPDATE ad_categories SET detected_pages = detected_pages || to_jsonb($2::text)
       WHERE id = $1 AND NOT (detected_pages @> to_jsonb($2::text))`,
      [id, path]
    );
  },
};
function toSnake(s){ return s.replace(/[A-Z]/g,c=>`_${c.toLowerCase()}`); }
module.exports = AdCategory;
