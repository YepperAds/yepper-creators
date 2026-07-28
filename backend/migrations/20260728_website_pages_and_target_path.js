'use strict';

// Migration: page-aware ad placement.
// `websites.pages` lets an owner register the actual pages/URLs of their site
// (label + path) up front. `ad_categories.target_path` then lets a single ad
// space (or a Duplicate of one) be scoped to one of those registered pages —
// the site-wide script matches this against `location.pathname` itself, so
// Floating/Modal spaces no longer need any placeholder div/script pasted on
// that page at all. NULL target_path keeps today's "every page" behavior.
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE websites ADD COLUMN IF NOT EXISTS pages JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE ad_categories ADD COLUMN IF NOT EXISTS target_path TEXT`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260728_website_pages_and_target_path applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
