'use strict';

// Migration: let a web owner pick which of a multi-tier ad space's 3 slots
// shows publicly on their site, changeable any time. NULL (the default)
// keeps today's behavior — the cheapest still-open tier shows automatically
// (see AdDisplayController.displayAd). Falls back to that same automatic
// behavior if the chosen tier ever fills up or gets removed.
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS displayed_tier_key TEXT DEFAULT NULL`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260813_ad_category_displayed_tier applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
