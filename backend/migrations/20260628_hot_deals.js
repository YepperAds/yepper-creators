"use strict";

const { query } = require('../config/db');

// Admin-curated bundles of YouTube ad slots + website ad categories, sold as
// one fixed-price package. See controllers/hotDealsController.js.
async function up() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS hot_deals (
       id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       title              TEXT NOT NULL,
       description        TEXT,
       business_category  VARCHAR(40) NOT NULL,
       cover_image_url    TEXT,
       status             VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
       created_by         VARCHAR(255),
       sold_at            TIMESTAMPTZ,
       created_at         TIMESTAMPTZ DEFAULT NOW(),
       updated_at         TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS hot_deal_items (
       id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       hot_deal_id    UUID NOT NULL REFERENCES hot_deals(id) ON DELETE CASCADE,
       item_type      VARCHAR(10) NOT NULL CHECK (item_type IN ('youtube','website')),
       creator_id     INTEGER REFERENCES creators(id),
       slot_type      VARCHAR(20),
       duration_band  VARCHAR(10),
       ad_type        VARCHAR(20),
       tier           VARCHAR(20),
       website_id     UUID REFERENCES websites(id),
       category_id    UUID REFERENCES ad_categories(id),
       system_price   NUMERIC(12,2) NOT NULL,
       deal_price     NUMERIC(12,2) NOT NULL,
       created_at     TIMESTAMPTZ DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS hot_deal_items_deal_idx ON hot_deal_items (hot_deal_id)`,
    `CREATE INDEX IF NOT EXISTS hot_deals_public_idx ON hot_deals (status, sold_at)`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260628_hot_deals applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
