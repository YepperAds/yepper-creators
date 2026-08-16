'use strict';

// Migration: preserve what a web owner originally picked when creating an ad
// space, separately from its live space_type/price/category_name (which the
// zone-detection reclassification in AdDisplayController.reportZoneDetected
// now updates as the div's real placement is confirmed). Without this, an
// owner who picked "Header" at creation time has no record that's what they
// originally chose once auto-correction changes it to something else — the
// dashboard should keep showing their original pick as the headline, with a
// note about what it's actually acting as now.
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS original_space_type TEXT DEFAULT NULL`,
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS original_category_name TEXT DEFAULT NULL`,
    // Backfill: for every existing row, "original" is whatever it's
    // currently set to — there's no earlier value to recover, so this is
    // the only sane starting point, and it's a one-time no-op for anything
    // created after this migration (createCategoryController sets both
    // explicitly at creation from here on).
    `UPDATE ad_categories SET original_space_type = space_type WHERE original_space_type IS NULL`,
    `UPDATE ad_categories SET original_category_name = category_name WHERE original_category_name IS NULL`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260815b_ad_original_space_type applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
