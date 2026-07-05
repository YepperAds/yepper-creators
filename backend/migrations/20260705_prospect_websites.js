'use strict';

// Migration: support for admin-added "prospect" websites — real `websites` rows
// (created via the admin panel, not by a real site owner) that show up in the
// normal advertiser feed so advertisers can express interest in an ad space
// before the site owner has actually installed the Yepper script.
const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE websites ADD COLUMN IF NOT EXISTS is_prospect BOOLEAN NOT NULL DEFAULT FALSE`,
    `CREATE TABLE IF NOT EXISTS prospect_interests (
       id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       website_id    UUID NOT NULL,
       category_id   UUID NOT NULL,
       advertiser_id INTEGER NOT NULL,
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS prospect_interests_website_idx ON prospect_interests (website_id)`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260705_prospect_websites applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
