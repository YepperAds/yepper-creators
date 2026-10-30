'use strict';

const { query } = require('../config/db');

async function up() {
  const statements = [
    `ALTER TABLE creators
       ADD COLUMN IF NOT EXISTS video_verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
       ADD COLUMN IF NOT EXISTS video_verification_reason TEXT,
       ADD COLUMN IF NOT EXISTS video_verification_request_url TEXT,
       ADD COLUMN IF NOT EXISTS video_verified_at TIMESTAMPTZ`,
    `ALTER TABLE social_connections
       ADD COLUMN IF NOT EXISTS platform_user_id VARCHAR(255)`,
    `UPDATE social_connections
       SET platform_user_id = substring(profile_url FROM 'youtube\\.com/channel/([^/?]+)')
       WHERE provider = 'youtube' AND platform_user_id IS NULL`,
    `ALTER TABLE ad_video_jobs
       ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
       ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
       ADD COLUMN IF NOT EXISTS video_fingerprint CHAR(64),
       ADD COLUMN IF NOT EXISTS approval_reason TEXT,
       ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255),
       ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
       ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ad_video_jobs_creator_fingerprint_uq
       ON ad_video_jobs (creator_id, video_fingerprint)
       WHERE video_fingerprint IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS video_processing_plans (
       code VARCHAR(20) PRIMARY KEY,
       name VARCHAR(50) NOT NULL,
       price_rwf NUMERIC(14,2) NOT NULL,
       hours_included NUMERIC(8,2) NOT NULL,
       enabled BOOLEAN NOT NULL DEFAULT TRUE,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `INSERT INTO video_processing_plans (code, name, price_rwf, hours_included, enabled)
       VALUES ('starter', 'Starter', 10000, 4, TRUE),
              ('creator', 'Creator', 25000, 10, TRUE),
              ('pro', 'Pro', 55000, 24, FALSE)
       ON CONFLICT (code) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS video_creator_subscriptions (
       id BIGSERIAL PRIMARY KEY,
       creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
       plan_code VARCHAR(20) NOT NULL REFERENCES video_processing_plans(code),
       status VARCHAR(20) NOT NULL DEFAULT 'active',
       hours_included NUMERIC(8,2) NOT NULL,
       hours_used NUMERIC(8,2) NOT NULL DEFAULT 0,
       period_start TIMESTAMPTZ NOT NULL,
       period_end TIMESTAMPTZ NOT NULL,
       payment_provider VARCHAR(30),
       payment_reference VARCHAR(255),
       granted_by VARCHAR(255),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS video_creator_subscriptions_current_idx
       ON video_creator_subscriptions (creator_id, status, period_end DESC)`,
    `CREATE TABLE IF NOT EXISTS video_processing_controls (
       id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
       processing_enabled BOOLEAN NOT NULL DEFAULT TRUE,
       changed_by VARCHAR(255),
       changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `INSERT INTO video_processing_controls (id, processing_enabled)
       VALUES (1, TRUE) ON CONFLICT (id) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS video_processing_costs (
       job_id INTEGER PRIMARY KEY REFERENCES ad_video_jobs(id) ON DELETE CASCADE,
       creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
       month_start DATE NOT NULL,
       estimated_cost_usd NUMERIC(12,4) NOT NULL,
       actual_cost_usd NUMERIC(12,4),
       estimated_cost_rwf NUMERIC(14,2) NOT NULL,
       billing_type VARCHAR(20) NOT NULL,
       reserved_hours NUMERIC(8,4) NOT NULL DEFAULT 0,
       extra_hours NUMERIC(8,4) NOT NULL DEFAULT 0,
       extra_charge_rwf NUMERIC(14,2) NOT NULL DEFAULT 0,
       subscription_id BIGINT REFERENCES video_creator_subscriptions(id),
       retry_count INTEGER NOT NULL DEFAULT 0,
       status VARCHAR(20) NOT NULL DEFAULT 'reserved'
         CHECK (status IN ('reserved', 'completed', 'released')),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS video_processing_costs_month_idx
       ON video_processing_costs (month_start, status)`,
    `CREATE INDEX IF NOT EXISTS video_processing_costs_creator_idx
       ON video_processing_costs (creator_id, status)`,
    `CREATE TABLE IF NOT EXISTS video_processing_job_campaigns (
       job_id INTEGER NOT NULL REFERENCES ad_video_jobs(id) ON DELETE CASCADE,
       campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
       creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
       allocation_ratio NUMERIC(8,6) NOT NULL DEFAULT 1,
       PRIMARY KEY (job_id, campaign_id)
     )`,
    `ALTER TABLE video_processing_job_campaigns
       ADD COLUMN IF NOT EXISTS allocation_ratio NUMERIC(8,6) NOT NULL DEFAULT 1`,
    `CREATE INDEX IF NOT EXISTS video_processing_job_campaigns_campaign_idx
       ON video_processing_job_campaigns (campaign_id, job_id)`,
    `CREATE TABLE IF NOT EXISTS video_processing_trial_channels (
       provider VARCHAR(30) NOT NULL,
       platform_user_id VARCHAR(255) NOT NULL,
       creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
       job_id INTEGER REFERENCES ad_video_jobs(id) ON DELETE SET NULL,
       status VARCHAR(20) NOT NULL DEFAULT 'reserved',
       claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (provider, platform_user_id)
     )`,
    `ALTER TABLE video_processing_trial_channels
       ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES ad_video_jobs(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed'`,
    `CREATE TABLE IF NOT EXISTS video_processing_approvals (
       id BIGSERIAL PRIMARY KEY,
       job_id INTEGER NOT NULL REFERENCES ad_video_jobs(id) ON DELETE CASCADE,
       token_hash CHAR(64) NOT NULL UNIQUE,
       decision VARCHAR(20) NOT NULL,
       expires_at TIMESTAMPTZ NOT NULL,
       used_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS video_processing_approvals_job_idx
       ON video_processing_approvals (job_id, used_at)`,
    `CREATE TABLE IF NOT EXISTS video_processing_audit (
       id BIGSERIAL PRIMARY KEY,
       creator_id INTEGER REFERENCES creators(id) ON DELETE SET NULL,
       job_id INTEGER REFERENCES ad_video_jobs(id) ON DELETE SET NULL,
       action VARCHAR(30) NOT NULL,
       decision VARCHAR(20) NOT NULL,
       reason_code VARCHAR(50),
       estimated_cost_usd NUMERIC(12,4),
       details JSONB NOT NULL DEFAULT '{}'::jsonb,
       actor VARCHAR(255),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS video_processing_audit_created_idx
       ON video_processing_audit (created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS video_plan_requests (
       id BIGSERIAL PRIMARY KEY,
       creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
       plan_code VARCHAR(20) NOT NULL REFERENCES video_processing_plans(code),
       status VARCHAR(20) NOT NULL DEFAULT 'pending',
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  ];

  for (const statement of statements) await query(statement);
  console.log('Migration 20261030_video_studio applied.');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => {
    console.error('Video Studio migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { up };
