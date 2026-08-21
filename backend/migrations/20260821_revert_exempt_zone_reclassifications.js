'use strict';

// One-off data repair, not a schema migration: run once after the
// ZONE_EXEMPT_TYPES change in AdDisplayController.js (Left Rail, Right Rail,
// Above The Fold and Beneath Title are now exempt from geometric
// reclassification — see the comment there for why). That change only stops
// *future* auto-corrections; any category that was already flipped away from
// one of these types before the fix (e.g. a Left Rail div pasted in normal
// document flow, with no actual side column to sit in, got auto-corrected to
// Above The Fold) is left sitting on the wrong type/price until this runs.
//
// For every category whose original_space_type is one of the now-exempt
// types and whose live space_type has drifted from it, this reverts type,
// price, pricing tiers and (if untouched since the bad correction) the
// category name back to what the owner actually configured — mirroring
// reportZoneDetected's own forward logic, just run in reverse. A category
// that already has ads sold on it is left alone, same "never reprice out
// from under an existing advertiser" rule reportZoneDetected itself follows.
//
// Run: node migrations/20260821_revert_exempt_zone_reclassifications.js
const { query } = require('../config/db');
const AdCategory = require('../AdPromoter/models/CreateCategoryModel');
const Pricing = require('../models/PricingModel');
const { repriceTiersForType } = require('../AdPromoter/controllers/AdDisplayController');
const { createNotification } = require('../creators/utils/notificationUtils');

const NOW_EXEMPT_TYPES = ['Above The Fold', 'Beneath Title', 'Left Rail', 'Right Rail'];

async function up() {
  const { rows: drifted } = await query(
    `SELECT * FROM ad_categories
     WHERE original_space_type = ANY($1::text[])
       AND space_type IS DISTINCT FROM original_space_type`,
    [NOW_EXEMPT_TYPES],
  );

  console.log(`Found ${drifted.length} category(ies) reclassified away from a now-exempt type.`);

  let reverted = 0;
  let skippedActive = 0;
  let skippedNoPrice = 0;

  for (const category of drifted) {
    const activeAdIds = await AdCategory.findActiveAdIds(category.id);
    if (activeAdIds.length > 0) {
      skippedActive += 1;
      console.log(`  Skipped "${category.category_name}" (${category.id}): has active ads, left as ${category.space_type}.`);
      continue;
    }

    const newType = category.original_space_type;
    const tierPrices = await Pricing.getTierPrices(category.tier);
    const newPrice = tierPrices[newType];
    if (newPrice === undefined) {
      skippedNoPrice += 1;
      console.warn(`  Skipped "${category.category_name}" (${category.id}): no price configured for ${newType}/${category.tier}.`);
      continue;
    }

    const fields = {
      spaceType: newType,
      price: newPrice,
      lastReclassifiedAt: null,
      lastDetectedZone: null,
      zoneDetectionHistory: [],
    };
    const repricedTiers = await repriceTiersForType(category, newType);
    if (repricedTiers) fields.pricingTiers = repricedTiers;
    // Only restore the name if it still just mirrors the wrong auto-assigned
    // type — a name the owner typed themselves after the bad correction is
    // left alone, same as reportZoneDetected's own forward rename guard.
    if (category.category_name === category.space_type) {
      fields.categoryName = category.original_category_name || newType;
    }

    await AdCategory.update(category.id, fields);
    reverted += 1;
    console.log(`  Reverted "${category.category_name}" (${category.id}): ${category.space_type} -> ${newType}.`);

    createNotification(
      category.owner_id,
      'zone_reclassified',
      'Ad space type restored',
      `"${fields.categoryName || category.category_name}" had been auto-corrected to ${category.space_type}, but that correction no longer applies to ${newType} spaces (they now render exactly as configured, regardless of where the div lands on the page). It's back to ${newType} (RWF ${newPrice}/month).`,
      { categoryId: category.id, revertedFrom: category.space_type, revertedTo: newType, newPrice },
    ).catch(() => {});
  }

  console.log(`Done: ${reverted} reverted, ${skippedActive} skipped (active ads), ${skippedNoPrice} skipped (no price).`);
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
