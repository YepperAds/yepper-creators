'use strict';

// Migration: multi-tier ad spaces ("Shared / Featured / Exclusive").
// `ad_categories.pricing_tiers` lets a web owner optionally split ONE ad
// space into up to 3 simultaneous price tiers that rotate in the same slot,
// instead of every advertiser sharing one flat price. NULL (the default)
// keeps today's single-price behavior completely unchanged for every
// existing ad space.
// `ad_categories.ad_tier_assignments` records which tier each sold ad
// booked into (adId -> tierKey), written alongside the existing
// `selected_ads` append at payment-success time (see PaymentController.js).
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT NULL`,
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS ad_tier_assignments JSONB NOT NULL DEFAULT '{}'::jsonb`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260812_ad_pricing_tiers applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
