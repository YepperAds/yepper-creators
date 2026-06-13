'use strict';

const { query } = require('../../config/db');

async function initCreatorsDatabase() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS creators (
       id                  SERIAL PRIMARY KEY,
       google_id           VARCHAR(255) UNIQUE NOT NULL,
       email               VARCHAR(255) UNIQUE NOT NULL,
       full_name           VARCHAR(255),
       avatar              TEXT,
       username            VARCHAR(50) UNIQUE,
       what_they_do        VARCHAR(100),
       created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
     )`,
    `ALTER TABLE creators ALTER COLUMN username DROP NOT NULL`,
    `ALTER TABLE creators ALTER COLUMN what_they_do DROP NOT NULL`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS what_they_do VARCHAR(100)`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_name VARCHAR(255)`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_url TEXT`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_domain VARCHAR(255)`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_status VARCHAR(50) DEFAULT 'not_connected'`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_icon TEXT`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verification_token VARCHAR(255)`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verification_method VARCHAR(20)`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verification_host VARCHAR(255)`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verification_value TEXT`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_traffic JSONB DEFAULT '{}'`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_tracking_token VARCHAR(255)`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_tracking_started_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_actual_stats_available_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE creators ADD COLUMN IF NOT EXISTS website_verified_at TIMESTAMP WITH TIME ZONE`,
    `CREATE UNIQUE INDEX IF NOT EXISTS creators_website_domain_unique ON creators (LOWER(website_domain)) WHERE website_domain IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS website_traffic_events (
       id               BIGSERIAL PRIMARY KEY,
       creator_id       INTEGER REFERENCES creators(id) ON DELETE CASCADE,
       website_domain   VARCHAR(255) NOT NULL,
       tracking_token   VARCHAR(255) NOT NULL,
       session_id       VARCHAR(255) NOT NULL,
       visitor_hash     VARCHAR(255),
       event_type       VARCHAR(50) NOT NULL DEFAULT 'pageview',
       path             TEXT,
       referrer         TEXT,
       title            TEXT,
       user_agent       TEXT,
       country          VARCHAR(100),
       duration_seconds INTEGER DEFAULT 0,
       created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS adsense_handoffs (
       id               BIGSERIAL PRIMARY KEY,
       creator_id       INTEGER REFERENCES creators(id) ON DELETE CASCADE,
       website_domain   VARCHAR(255),
       handoff_token    VARCHAR(255) UNIQUE NOT NULL,
       status           VARCHAR(30) DEFAULT 'active',
       created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       used_at          TIMESTAMP WITH TIME ZONE
     )`,
    `CREATE INDEX IF NOT EXISTS website_traffic_events_creator_created_idx ON website_traffic_events (creator_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS website_traffic_events_token_idx ON website_traffic_events (tracking_token)`,
    `CREATE INDEX IF NOT EXISTS adsense_handoffs_token_idx ON adsense_handoffs (handoff_token)`,
    `CREATE TABLE IF NOT EXISTS social_connections (
       id               SERIAL PRIMARY KEY,
       creator_id       INTEGER REFERENCES creators(id) ON DELETE CASCADE,
       provider         VARCHAR(50) NOT NULL,
       username         VARCHAR(255),
       followers_count  INTEGER DEFAULT 0,
       profile_url      TEXT,
       access_token     TEXT,
       refresh_token    TEXT,
       connected_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       UNIQUE (creator_id, provider)
     )`,
    `ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS total_views BIGINT DEFAULT 0`,
    `ALTER TABLE social_connections ADD COLUMN IF NOT EXISTS total_posts INTEGER DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS social_video_stats (
       id           SERIAL PRIMARY KEY,
       creator_id   INTEGER REFERENCES creators(id) ON DELETE CASCADE,
       provider     VARCHAR(50) NOT NULL,
       title        TEXT,
       views        INTEGER DEFAULT 0,
       likes        INTEGER DEFAULT 0,
       published_at TIMESTAMP WITH TIME ZONE,
       thumbnail_url TEXT,
       video_url    TEXT,
       fetched_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
     )`,
    `DELETE FROM social_video_stats WHERE id NOT IN (SELECT MAX(id) FROM social_video_stats GROUP BY creator_id, provider, COALESCE(video_url, title))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS svs_unique_video ON social_video_stats (creator_id, provider, video_url) WHERE video_url IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS ad_tracking_sequences (
       provider  VARCHAR(50) PRIMARY KEY,
       last_id   INTEGER DEFAULT 0
     )`,
    `INSERT INTO ad_tracking_sequences (provider, last_id) VALUES ('youtube',0),('instagram',0),('facebook',0) ON CONFLICT DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS ad_video_posts (
       id                 SERIAL PRIMARY KEY,
       creator_id         INTEGER REFERENCES creators(id) ON DELETE CASCADE,
       provider           VARCHAR(50) NOT NULL,
       tracking_code      VARCHAR(50) UNIQUE NOT NULL,
       tracking_num       INTEGER NOT NULL,
       platform_video_id  VARCHAR(255),
       video_url          TEXT,
       title              TEXT,
       description        TEXT,
       thumbnail_url      TEXT,
       status             VARCHAR(50) DEFAULT 'live',
       views              BIGINT DEFAULT 0,
       likes              BIGINT DEFAULT 0,
       comments           INTEGER DEFAULT 0,
       posted_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
       last_stats_at      TIMESTAMP WITH TIME ZONE,
       created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE INDEX IF NOT EXISTS ad_video_posts_creator_idx ON ad_video_posts (creator_id, provider)`,
    `CREATE TABLE IF NOT EXISTS notifications (
       id          BIGSERIAL PRIMARY KEY,
       creator_id  INTEGER REFERENCES creators(id) ON DELETE CASCADE,
       type        VARCHAR(50),
       title       TEXT,
       body        TEXT,
       read        BOOLEAN DEFAULT false,
       created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
     )`,
  ];

  for (const sql of statements) {
    try {
      await query(sql);
    } catch (err) {
      if (!err.message?.includes('already exists') && !err.message?.includes('does not exist')) {
        console.warn('[creators] Schema statement skipped:', err.message);
      }
    }
  }
  console.log('[creators] Database schema initialised.');
}

module.exports = { initCreatorsDatabase };
