'use strict';

const { query } = require('../config/db');

async function up() {
  await query(
    `CREATE TABLE IF NOT EXISTS youtube_channel_requests (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       channel_id TEXT NOT NULL,
       channel_name TEXT NOT NULL,
       advertiser_id TEXT NOT NULL,
       request_group_id UUID NOT NULL DEFAULT gen_random_uuid(),
       package_code TEXT NOT NULL DEFAULT 'social_video',
       package_price_rwf INTEGER NOT NULL DEFAULT 1000000,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE (channel_id, advertiser_id)
     )`
  );
  await query(
    `ALTER TABLE youtube_channel_requests
       ADD COLUMN IF NOT EXISTS package_code TEXT NOT NULL DEFAULT 'social_video',
       ADD COLUMN IF NOT EXISTS package_price_rwf INTEGER NOT NULL DEFAULT 1000000,
       ADD COLUMN IF NOT EXISTS request_group_id UUID,
       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  );
  await query(
    `UPDATE youtube_channel_requests
     SET request_group_id = id
     WHERE request_group_id IS NULL`
  );
  await query(
    `ALTER TABLE youtube_channel_requests
     ALTER COLUMN request_group_id SET NOT NULL`
  );
  await query(
    `ALTER TABLE youtube_channel_requests
     DROP CONSTRAINT IF EXISTS youtube_channel_requests_channel_id_advertiser_id_key`
  );
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS youtube_channel_requests_group_channel_unique
     ON youtube_channel_requests (request_group_id, channel_id)`
  );
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS youtube_channel_requests_channel_advertiser_unique
     ON youtube_channel_requests (channel_id, advertiser_id)`
  );
  await query(
    `DO $$
     BEGIN
       IF to_regclass('public.demo_youtube_interests') IS NOT NULL THEN
         INSERT INTO youtube_channel_requests
           (id, channel_id, channel_name, advertiser_id, request_group_id, package_code, package_price_rwf, created_at, updated_at)
         SELECT id,
                REPLACE(channel_id, 'demo-youtube-', 'partner-youtube-'),
                channel_name,
                advertiser_id,
                id,
                'social_video',
                1000000,
                created_at,
                created_at
         FROM demo_youtube_interests
         ON CONFLICT (request_group_id, channel_id) DO NOTHING;
       END IF;
     END $$`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS youtube_channel_requests_created_at_idx
     ON youtube_channel_requests (created_at DESC)`
  );
  console.log('Migration 20261105_youtube_channel_requests applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((error) => {
    console.error('Migration 20261105_youtube_channel_requests failed:', error);
    process.exit(1);
  });
}

module.exports = { up };
