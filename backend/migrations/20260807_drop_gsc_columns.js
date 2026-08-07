'use strict';

// Migration: remove Google Search Console integration.
// Traffic tier/pricing was always actually driven by real script-tracked
// pageviews (see analyticsController.js's trackPageView) — GSC only added
// an OAuth-gated "verified" badge and a 4x price surcharge for not
// connecting it, which is friction with no benefit a publisher doesn't
// already get for free just by having the tracking script installed (same
// as a new YouTube channel starting at 0 subscribers, not penalized for
// skipping some extra step). Dropping the columns outright rather than just
// leaving them unused, since nothing reads/writes them anymore.
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE users DROP COLUMN IF EXISTS gsc_access_token`,
    `ALTER TABLE users DROP COLUMN IF EXISTS gsc_refresh_token`,
    `ALTER TABLE websites DROP COLUMN IF EXISTS gsc_access_token`,
    `ALTER TABLE websites DROP COLUMN IF EXISTS gsc_refresh_token`,
    `ALTER TABLE websites DROP COLUMN IF EXISTS gsc_site_url`,
    `ALTER TABLE websites DROP COLUMN IF EXISTS gsc_connected_at`,
    `ALTER TABLE websites DROP COLUMN IF EXISTS gsc_verified`,
    `ALTER TABLE websites DROP COLUMN IF EXISTS gsc_verified_at`,
    `ALTER TABLE websites DROP COLUMN IF EXISTS unverified_since`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260807_drop_gsc_columns applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
