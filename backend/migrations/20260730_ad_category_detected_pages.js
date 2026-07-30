'use strict';

// Migration: real-placement page detection for "All Pages" ad spaces.
// `websites.pages` is just the owner's self-reported list of the site's
// pages — it says nothing about which of those pages actually carry an ad
// space's `data-yepper-space` div. `ad_categories.detected_pages` instead
// accumulates the paths where the site-wide script has actually found that
// div rendered (see SiteScriptController.js's reportSpaceSeen beacon), so
// the advertiser-facing "which pages do you want this on" picker reflects
// where the ad can really show, not where the owner merely registered a
// page.
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS detected_pages JSONB NOT NULL DEFAULT '[]'::jsonb`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260730_ad_category_detected_pages applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
