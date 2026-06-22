// admin/controllers/pricingController.js
// Endpoints to read & edit ad-space prices and the margin %, plus an
// "apply to existing" action that re-prices UNPAID spaces in a tier.
const { query } = require('../../config/db');
const Pricing   = require('../models/PricingModel');

// GET /api/admin/pricing
// Returns the full editable matrix + tier/space metadata + margin %.
exports.getPricing = async (req, res) => {
  try {
    const [matrix, settings] = await Promise.all([Pricing.getMatrix(), Pricing.getSettings()]);
    res.json({
      success: true,
      tiers:      Pricing.TIERS,        // [{ key, label, range }]
      spaceTypes: Pricing.SPACE_TYPES,  // canonical order
      matrix,                            // { tier: { space: basePrice } }
      marginPercent: settings.marginPercent,
    });
  } catch (err) {
    console.error('getPricing error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/admin/pricing/margin   body: { marginPercent }
exports.updateMargin = async (req, res) => {
  try {
    const m = parseFloat(req.body.marginPercent);
    if (!isFinite(m) || m < 0 || m > 1000)
      return res.status(400).json({ success: false, message: 'marginPercent must be between 0 and 1000' });
    const result = await Pricing.setMargin(m);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('updateMargin error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/admin/pricing
// body: { prices: [{ tier, spaceType, basePrice }, ...], applyToExisting: bool }
// Saves the new owner base prices. If applyToExisting, re-prices UNPAID ad
// spaces of those (tier, space) combos across every website in that tier.
exports.updatePricing = async (req, res) => {
  try {
    const { prices, applyToExisting = false } = req.body;
    if (!Array.isArray(prices) || prices.length === 0)
      return res.status(400).json({ success: false, message: 'prices[] required' });

    // Validate + normalise
    const cells = [];
    for (const p of prices) {
      const basePrice = parseFloat(p.basePrice);
      if (!p.tier || !p.spaceType || !isFinite(basePrice) || basePrice < 0)
        return res.status(400).json({ success: false, message: `Invalid cell: ${JSON.stringify(p)}` });
      cells.push({ tier: p.tier, spaceType: Pricing.canonicalSpace(p.spaceType), basePrice });
    }

    const saved = await Pricing.setManyPrices(cells);

    let repriced = 0;
    if (applyToExisting) repriced = await repriceUnpaidSpaces(cells);

    res.json({ success: true, saved, repricedSpaces: repriced });
  } catch (err) {
    console.error('updatePricing error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/admin/pricing/apply
// Re-price every UNPAID ad space using the CURRENT saved prices, for the whole
// matrix (or an optional subset). Lets the owner push prices to live spaces
// without editing each cell again.
exports.applyPricingToExisting = async (req, res) => {
  try {
    const matrix = await Pricing.getMatrix();
    const cells = [];
    for (const tier of Object.keys(matrix))
      for (const spaceType of Object.keys(matrix[tier]))
        cells.push({ tier, spaceType, basePrice: matrix[tier][spaceType] });
    const repriced = await repriceUnpaidSpaces(cells);
    res.json({ success: true, repricedSpaces: repriced });
  } catch (err) {
    console.error('applyPricingToExisting error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Re-pricing helper ─────────────────────────────────────────────────────────
// For each (tier, spaceType) cell, set price on ad_categories rows that
//   • belong to a website in that tier  (websites.traffic_tier = cell.tier)
//   • match the space type (canonical)
//   • are UNPAID  (selected_ads IS NULL OR empty)  ← never touches booked spaces
// Returns how many ad_categories rows changed.
async function repriceUnpaidSpaces(cells) {
  let total = 0;
  for (const cell of cells) {
    const { rows } = await query(
      `UPDATE ad_categories c
         SET price = $1, tier = $2
       FROM websites w
       WHERE c.website_id = w.id
         AND w.traffic_tier = $2
         AND lower(c.space_type) = lower($3)
         AND (c.selected_ads IS NULL OR array_length(c.selected_ads, 1) IS NULL)
         AND c.price IS DISTINCT FROM $1
       RETURNING c.id`,
      [cell.basePrice, cell.tier, cell.spaceType]
    );
    total += rows.length;
  }
  return total;
}
