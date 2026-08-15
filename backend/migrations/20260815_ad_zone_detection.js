'use strict';

// Migration: zone-based ad placement detection (see AdDisplayController's
// zone-detected endpoint). Adds:
//   - ad_categories.last_detected_zone / zone_detection_history /
//     last_reclassified_at — where the injected script last found a
//     category's div actually rendered, used both for the dashboard's zone
//     map preview and to decide whether a category needs auto-reclassifying.
//   - pricing_rules rows for two new space types this feature needed so
//     every zone has something to reclassify into: Right Rail (mirrors Left
//     Rail's price at every tier — same shape, opposite side of the page)
//     and Footer (~70% of Pro Footer at every tier — a plainer, less visible
//     footer slot; Pro Footer stays the existing premium footer variant).
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS last_detected_zone TEXT DEFAULT NULL`,
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS zone_detection_history JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS last_reclassified_at TIMESTAMPTZ DEFAULT NULL`,
    `INSERT INTO pricing_rules (tier, space_type, base_price) VALUES
       ('unverified','Right Rail',3600),('unverified','Footer',1000),
       ('starter','Right Rail',1200),('starter','Footer',350),
       ('basic','Right Rail',6000),('basic','Footer',1750),
       ('standard','Right Rail',12000),('standard','Footer',3500),
       ('premium','Right Rail',33000),('premium','Footer',10000),
       ('elite','Right Rail',88000),('elite','Footer',26000)
     ON CONFLICT (tier, space_type) DO UPDATE SET base_price = EXCLUDED.base_price, updated_at = NOW()`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260815_ad_zone_detection applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
