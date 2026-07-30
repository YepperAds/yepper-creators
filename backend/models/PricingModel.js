// admin/models/PricingModel.js  (PostgreSQL)
// Single source of truth for ad-space prices + the margin percentage.
const { query } = require('../config/db');

// Canonical ordered list of spaces (highest → lowest visibility).
const SPACE_TYPES = [
  'Header', 'Above The Fold', 'Sticky Sidebar', 'Mobile Interstitial', 'Overlay',
  'Floating', 'Modal', 'Left Rail', 'Right Rail', 'Sidebar', 'In Feed',
  'Inline Content', 'Beneath Title', 'Pro Footer', 'Bottom',
  // Video-player placements (movie/video-content sites).
  'Pre-roll', 'Mid-roll', 'Pause',
];

// Ordered tiers (low → high traffic) with their visitor ranges (for the UI).
const TIERS = [
  { key: 'unverified', label: 'Unverified', range: 'Not yet verified' },
  { key: 'starter',    label: 'Starter',    range: '500 – 2,000 visits' },
  { key: 'basic',      label: 'Basic',      range: '2,001 – 10,000 visits' },
  { key: 'standard',   label: 'Standard',   range: '10,001 – 50,000 visits' },
  { key: 'premium',    label: 'Premium',    range: '50,001 – 200,000 visits' },
  { key: 'elite',      label: 'Elite',      range: '200,000+ visits' },
];

// Accepts the many aliases the rest of the app uses (camelCase, lowercase…)
// and returns the canonical space name. Mirrors SPACE_TYPE_MAP in adminController.
const SPACE_ALIASES = {
  'header':'Header','above the fold':'Above The Fold','sticky sidebar':'Sticky Sidebar',
  'stickysidebar':'Sticky Sidebar','mobile interstitial':'Mobile Interstitial',
  'mobileinterstial':'Mobile Interstitial','overlay':'Overlay','floating':'Floating',
  'modal':'Modal','modalpic':'Modal','left rail':'Left Rail','leftrail':'Left Rail',
  'right rail':'Right Rail','rightrail':'Right Rail','sidebar':'Sidebar',
  'in feed':'In Feed','infeed':'In Feed','inline content':'Inline Content',
  'inlinecontent':'Inline Content','beneath title':'Beneath Title','beneathtitle':'Beneath Title',
  'pro footer':'Pro Footer','profooter':'Pro Footer','bottom':'Bottom',
  'preroll':'Pre-roll','pre-roll':'Pre-roll','pre roll':'Pre-roll',
  'midroll':'Mid-roll','mid-roll':'Mid-roll','mid roll':'Mid-roll',
  'pause':'Pause',
};
function canonicalSpace(s) {
  if (!s) return s;
  return SPACE_ALIASES[String(s).toLowerCase().trim()] || s;
}

const Pricing = {
  SPACE_TYPES, TIERS, canonicalSpace, SPACE_ALIASES,

  // → { margin_percent: Number }
  async getSettings() {
    const { rows } = await query(`SELECT margin_percent FROM pricing_settings WHERE id = 1`);
    return { marginPercent: rows[0] ? parseFloat(rows[0].margin_percent) : 30 };
  },

  async setMargin(marginPercent) {
    const { rows } = await query(
      `UPDATE pricing_settings SET margin_percent = $1, updated_at = NOW() WHERE id = 1 RETURNING margin_percent`,
      [marginPercent]
    );
    return { marginPercent: parseFloat(rows[0].margin_percent) };
  },

  // → flat list of { tier, spaceType, basePrice }
  async getAllRules() {
    const { rows } = await query(`SELECT tier, space_type, base_price FROM pricing_rules`);
    return rows.map(r => ({ tier: r.tier, spaceType: r.space_type, basePrice: parseFloat(r.base_price) }));
  },

  // → { unverified: { Header: 9000, ... }, ... }  (owner base prices)
  async getMatrix() {
    const rules = await this.getAllRules();
    const m = {};
    for (const t of TIERS) m[t.key] = {};
    for (const r of rules) {
      if (!m[r.tier]) m[r.tier] = {};
      m[r.tier][r.spaceType] = r.basePrice;
    }
    return m;
  },

  // Prices for ONE tier as { spaceType: basePrice } (used by re-pricing).
  async getTierPrices(tier) {
    const { rows } = await query(
      `SELECT space_type, base_price FROM pricing_rules WHERE tier = $1`, [tier]
    );
    const out = {};
    for (const r of rows) out[r.space_type] = parseFloat(r.base_price);
    return out;
  },

  // Upsert a single price cell.
  async setPrice(tier, spaceType, basePrice) {
    const sp = canonicalSpace(spaceType);
    const { rows } = await query(
      `INSERT INTO pricing_rules (tier, space_type, base_price)
       VALUES ($1,$2,$3)
       ON CONFLICT (tier, space_type)
       DO UPDATE SET base_price = EXCLUDED.base_price, updated_at = NOW()
       RETURNING tier, space_type, base_price`,
      [tier, sp, basePrice]
    );
    const r = rows[0];
    return { tier: r.tier, spaceType: r.space_type, basePrice: parseFloat(r.base_price) };
  },

  // Bulk upsert: [{ tier, spaceType, basePrice }, ...]
  async setManyPrices(cells) {
    const out = [];
    for (const c of cells) out.push(await this.setPrice(c.tier, c.spaceType, c.basePrice));
    return out;
  },
};

module.exports = Pricing;
