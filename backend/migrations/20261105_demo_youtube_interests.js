'use strict';

const { query } = require('../config/db');

async function up() {
  await query(
    `CREATE TABLE IF NOT EXISTS demo_youtube_interests (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       channel_id TEXT NOT NULL,
       channel_name TEXT NOT NULL,
       advertiser_id TEXT NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE (channel_id, advertiser_id)
     )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS demo_youtube_interests_created_at_idx
     ON demo_youtube_interests (created_at DESC)`
  );
  console.log('Migration 20261105_demo_youtube_interests applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((error) => {
    console.error('Migration 20261105_demo_youtube_interests failed:', error);
    process.exit(1);
  });
}

module.exports = { up };
