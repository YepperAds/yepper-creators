"use strict";

const { query } = require('../config/db');

// Advertisers can now pick more than one business category (plus a free-text
// "Other" category), so import_ads needs to store an array instead of relying
// on the never-persisted single businessCategory that used to be dropped
// client-side. See WebAdvertiseModel.create / WebAdvertiseController.createImportAd.
async function up() {
  const statements = [
    `ALTER TABLE import_ads ADD COLUMN IF NOT EXISTS business_categories JSONB DEFAULT '[]'`,
    `ALTER TABLE import_ads ADD COLUMN IF NOT EXISTS business_category_other TEXT`,
  ];

  for (const s of statements) {
    try {
      await query(s);
    } catch (err) {
      console.warn('Migration statement skipped:', err.message || err);
    }
  }
  console.log('Migration 20260627_add_business_categories_to_import_ads applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
