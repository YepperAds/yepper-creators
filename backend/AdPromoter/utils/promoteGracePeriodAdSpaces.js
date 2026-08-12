// promoteGracePeriodAdSpaces.js — PostgreSQL version
//
// Every new ad space starts priced at Starter (see createCategoryController's
// createCategory — self-reported traffic isn't trusted on day one). Once a
// space is 3+ days old, this promotes it to whatever tier the site's real,
// script-tracked traffic (websites.traffic_tier, kept live by every pageview
// in analyticsController.trackPageView) has actually earned since — never
// downgrades, and only ever moves a space that's still sitting at Starter.
//
// Mirrors repriceUnpaidSpaces in pricingController.js: only touches spaces
// with nothing sold yet (selected_ads empty) — an advertiser who already
// booked at the Starter price keeps that price, this only affects what the
// *next* booking into that space costs. Skips "Add the price you want"
// spaces (pricing_tiers set) — the grace period doesn't apply to those; the
// current-tier slot there already reads live traffic at creation time.
const { query } = require('../../config/db');
const Pricing = require('../../models/PricingModel');

const PROMOTABLE_TIERS = ['basic', 'standard', 'premium', 'elite'];

const promoteGracePeriodAdSpaces = async () => {
  try {
    const { rows: candidates } = await query(
      `SELECT c.id, c.space_type, w.traffic_tier
       FROM ad_categories c
       JOIN websites w ON w.id = c.website_id
       WHERE c.tier = 'starter'
         AND c.pricing_tiers IS NULL
         AND c.created_at <= NOW() - INTERVAL '3 days'
         AND (c.selected_ads IS NULL OR array_length(c.selected_ads, 1) IS NULL)
         AND w.traffic_tier = ANY($1::text[])`,
      [PROMOTABLE_TIERS]
    );

    let promoted = 0;
    for (const c of candidates) {
      const tierPrices = await Pricing.getTierPrices(c.traffic_tier);
      const canonical = Pricing.canonicalSpace(c.space_type);
      const newPrice = tierPrices[canonical];
      if (newPrice === undefined) continue;

      await query(
        `UPDATE ad_categories SET tier = $1, price = $2 WHERE id = $3`,
        [c.traffic_tier, newPrice, c.id]
      );
      promoted++;
    }

    if (promoted > 0) console.log(`Promoted ${promoted} ad space(s) past their 3-day Starter grace period`);
  } catch (error) {
    console.error('Error promoting grace-period ad spaces:', error);
  }
};

// Hourly is frequent enough for a 3-day window without hammering the DB.
setInterval(promoteGracePeriodAdSpaces, 60 * 60 * 1000);

module.exports = { promoteGracePeriodAdSpaces };
