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

// Tier → rank, straight from Pricing.TIERS' own low-to-high order, and the
// reverse (display label → key) — the "current" slot stores a human label
// ("Premium"), not the tier key, so comparing old-vs-new rank needs both.
const tierRankByKey = {};
Pricing.TIERS.forEach((t, i) => { tierRankByKey[t.key] = i; });
const tierKeyByLabel = {};
Pricing.TIERS.forEach((t) => { tierKeyByLabel[t.label] = t.key; });

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

// Tiered spaces ("Add the price you want"): the "current" slot's price/label
// is a snapshot of the website's traffic tier taken once, at category
// creation — nothing else ever touches it afterward, so a site that later
// earns (or is manually given, via the admin panel's tier dropdown) a
// higher traffic tier keeps quoting the OLD tier's price on that slot
// forever. This keeps it live, same "never downgrade" principle as the
// promotion above (a temporary traffic dip shouldn't cheapen an owner's
// asking price), but — unlike the grace-period promotion — not gated by a
// 3-day age or an empty-slot check: "current" is meant to always reflect
// reality, not a one-time day-one placeholder, and an already-sold slot's
// existing advertiser isn't affected (their price is locked in at payment
// time, not re-read from pricing_tiers) — this only changes what the next
// booking into that slot costs.
const refreshTieredCurrentSlots = async () => {
  try {
    const { rows: candidates } = await query(
      `SELECT c.id, c.space_type, c.pricing_tiers, w.traffic_tier
       FROM ad_categories c
       JOIN websites w ON w.id = c.website_id
       WHERE c.pricing_tiers IS NOT NULL AND w.traffic_tier IS NOT NULL`
    );

    let refreshed = 0;
    for (const c of candidates) {
      const tiers = typeof c.pricing_tiers === 'string' ? JSON.parse(c.pricing_tiers) : c.pricing_tiers;
      if (!Array.isArray(tiers)) continue;
      const currentEntry = tiers.find((t) => t.key === 'current');
      if (!currentEntry) continue;

      // Elite is reserved for the elite slot — a website that's earned
      // Elite traffic still only ever fills its "current" slot at Premium.
      const realTier = c.traffic_tier === 'elite' ? 'premium' : c.traffic_tier;
      const newRank = tierRankByKey[realTier] ?? -1;
      const oldRank = tierRankByKey[tierKeyByLabel[currentEntry.label]] ?? -1;
      if (newRank <= oldRank) continue;

      const tierPrices = await Pricing.getTierPrices(realTier);
      const canonical = Pricing.canonicalSpace(c.space_type);
      const newPrice = tierPrices[canonical];
      if (newPrice === undefined) continue;
      const newLabel = Pricing.TIERS.find((t) => t.key === realTier)?.label || realTier;

      const updatedTiers = tiers.map((t) => (t.key === 'current' ? { ...t, price: newPrice, label: newLabel } : t));
      await query(`UPDATE ad_categories SET pricing_tiers = $1 WHERE id = $2`, [JSON.stringify(updatedTiers), c.id]);
      refreshed++;
    }

    if (refreshed > 0) console.log(`Refreshed the "current" slot on ${refreshed} tiered ad space(s) to match real traffic tier`);
  } catch (error) {
    console.error('Error refreshing tiered current-slot prices:', error);
  }
};

// Hourly is frequent enough for a 3-day window without hammering the DB.
setInterval(promoteGracePeriodAdSpaces, 60 * 60 * 1000);
setInterval(refreshTieredCurrentSlots, 60 * 60 * 1000);

module.exports = { promoteGracePeriodAdSpaces, refreshTieredCurrentSlots };
