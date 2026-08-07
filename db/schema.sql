-- =============================================================
-- Yepper merged PostgreSQL schema
-- Legacy Yepper Ads Platform tables plus the current creators flow
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- USERS
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  avatar TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token TEXT,
  verification_token_expires TIMESTAMPTZ,
  reset_password_token TEXT,
  reset_password_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

-- =============================================================
-- BRAND USERS
-- =============================================================
CREATE TABLE IF NOT EXISTS brand_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_users_email ON brand_users (email);

-- =============================================================
-- CREATORS
-- =============================================================
CREATE TABLE IF NOT EXISTS creators (
  id SERIAL PRIMARY KEY,

  -- Google Auth Data
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar TEXT,

  -- Onboarding Creator Data
  username VARCHAR(50) UNIQUE NOT NULL,
  what_they_do VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS creators_website_domain_unique
  ON creators (LOWER(website_domain))
  WHERE website_domain IS NOT NULL;

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id INTEGER,
  user_id TEXT,
  type VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_creator_id ON notifications (creator_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications (is_read);

-- Trigger function to notify application of notification changes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_notifications_change') THEN
    CREATE FUNCTION notify_notifications_change() RETURNS trigger AS $$
    DECLARE
      payload JSON;
      nid UUID;
      ncreator INTEGER;
      nis_read BOOLEAN;
    BEGIN
      nid := COALESCE(NEW.id, OLD.id);
      ncreator := COALESCE(NEW.creator_id, OLD.creator_id);
      nis_read := COALESCE(NEW.is_read, OLD.is_read);
      payload = json_build_object('id', nid, 'creator_id', ncreator, 'is_read', nis_read);
      PERFORM pg_notify('notifications_channel', payload::text);
      IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
      ELSE
        RETURN NEW;
      END IF;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END$$;

-- Create trigger to call the function on insert or update
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notifications_notify') THEN
    CREATE TRIGGER trg_notifications_notify
    AFTER INSERT OR UPDATE OR DELETE ON notifications
    FOR EACH ROW EXECUTE PROCEDURE notify_notifications_change();
  END IF;
END$$;

-- =============================================================
-- WEBSITES
-- =============================================================
CREATE TABLE IF NOT EXISTS websites (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id),
  website_name TEXT NOT NULL,
  website_link TEXT NOT NULL UNIQUE,
  image_url TEXT,
  business_categories TEXT[] NOT NULL DEFAULT '{}',
  is_business_categories_selected BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_traffic INTEGER NOT NULL DEFAULT 0,
  traffic_tier TEXT NOT NULL DEFAULT 'unverified',
  site_script TEXT,
  verification_token TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  script_installed BOOLEAN NOT NULL DEFAULT FALSE,
  script_installed_at TIMESTAMPTZ,
  grant_window_expires_at TIMESTAMPTZ,
  granted_traffic_display INTEGER NOT NULL DEFAULT 0,
  granted_views_display INTEGER NOT NULL DEFAULT 0,
  granted_tier_display TEXT,
  -- Registered pages/URLs the owner advertises on, e.g.
  -- [{"label":"Home","path":"/"},{"label":"Blog","path":"/blog"}] — lets ad
  -- spaces target a specific page (see ad_categories.target_path) instead of
  -- always showing everywhere.
  pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_websites_owner_id ON websites (owner_id);
CREATE INDEX IF NOT EXISTS idx_websites_business_categories ON websites USING GIN (business_categories);

-- =============================================================
-- AD CATEGORIES
-- =============================================================
CREATE TABLE IF NOT EXISTS ad_categories (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users (id),
  website_id UUID NOT NULL REFERENCES websites (id),
  category_name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  space_type TEXT NOT NULL,
  user_count INTEGER NOT NULL DEFAULT 0,
  instructions TEXT,
  default_language TEXT NOT NULL DEFAULT 'english',
  custom_attributes JSONB NOT NULL DEFAULT '{}',
  placement_mode TEXT NOT NULL DEFAULT 'auto',
  placeholder_div TEXT,
  -- One of the website's registered pages.path (see websites.pages) this
  -- space is scoped to, or NULL for "every page" (today's default). The
  -- site-wide script matches this against location.pathname itself.
  target_path TEXT,
  selected_ads TEXT[] NOT NULL DEFAULT '{}',
  web_owner_email TEXT,
  visitor_range_min INTEGER NOT NULL DEFAULT 0,
  visitor_range_max INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'basic',
  customization JSONB,
  api_codes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_categories_owner_website_name
  ON ad_categories (owner_id, website_id, category_name);

-- =============================================================
-- IMPORT ADS
-- =============================================================
CREATE TABLE IF NOT EXISTS import_ads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  ad_owner_email TEXT NOT NULL,
  image_url TEXT,
  pdf_url TEXT,
  video_url TEXT,
  business_name TEXT NOT NULL,
  business_link TEXT,
  business_location TEXT,
  ad_description TEXT,
  available_for_reassignment BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  clicks INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_ads_user_id ON import_ads (user_id);

-- =============================================================
-- AD WEBSITE SELECTIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS ad_website_selections (
  id TEXT PRIMARY KEY,
  ad_id UUID NOT NULL REFERENCES import_ads (id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES websites (id),
  category_id TEXT NOT NULL REFERENCES ad_categories (id),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  is_rejected BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_ad_website_selections_ad_id ON ad_website_selections (ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_website_selections_website_id ON ad_website_selections (website_id);

-- =============================================================
-- PAYMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL UNIQUE,
  tx_ref TEXT NOT NULL UNIQUE,
  base_reference TEXT NOT NULL,
  ad_id UUID REFERENCES import_ads (id),
  advertiser_id TEXT REFERENCES users (id),
  web_owner_id TEXT REFERENCES users (id),
  website_id UUID REFERENCES websites (id),
  category_id TEXT REFERENCES ad_categories (id),
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  status TEXT NOT NULL DEFAULT 'pending',
  flutterwave_data JSONB,
  internal_refund_processed BOOLEAN NOT NULL DEFAULT FALSE,
  refund_transaction_ids TEXT[] NOT NULL DEFAULT '{}',
  refund_applied INTEGER NOT NULL DEFAULT 0,
  wallet_applied INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT,
  is_reassignment BOOLEAN NOT NULL DEFAULT FALSE,
  refund_used BOOLEAN NOT NULL DEFAULT FALSE,
  refund_usage_amount INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  is_rejectable BOOLEAN NOT NULL DEFAULT FALSE,
  refund_sources JSONB NOT NULL DEFAULT '[]',
  wallet_sources JSONB NOT NULL DEFAULT '[]',
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_ad_id_status ON payments (ad_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_advertiser_status ON payments (advertiser_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_web_owner_status ON payments (web_owner_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_status_refund_used ON payments (status, refund_used);
CREATE INDEX IF NOT EXISTS idx_payments_base_reference ON payments (base_reference);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_refunded_at ON payments (refunded_at, refund_used) WHERE refunded_at IS NOT NULL;

-- =============================================================
-- PAYMENT TRACKERS
-- =============================================================
CREATE TABLE IF NOT EXISTS payment_trackers (
  id TEXT PRIMARY KEY,
  payment_reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_trackers_reference
  ON payment_trackers (payment_reference)
  WHERE payment_reference IS NOT NULL;

-- =============================================================
-- WALLETS
-- =============================================================
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_type TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, owner_type)
);

-- =============================================================
-- WALLET TRANSACTIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets (id),
  payment_id TEXT REFERENCES payments (id),
  amount INTEGER NOT NULL,
  direction TEXT NOT NULL,
  description TEXT,
  transaction_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payment_id ON wallet_transactions (payment_id);

-- =============================================================
-- WEB OWNER BALANCES
-- =============================================================
CREATE TABLE IF NOT EXISTS web_owner_balances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users (id),
  balance INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- WITHDRAWAL REQUESTS
-- =============================================================
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_wallet_id ON withdrawal_requests (wallet_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests (status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created ON withdrawal_requests (status, created_at DESC);

-- =============================================================
-- TRAFFIC GRANTS
-- =============================================================
CREATE TABLE IF NOT EXISTS traffic_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  website_id UUID REFERENCES websites (id),
  granted_traffic INTEGER NOT NULL DEFAULT 0,
  granted_views INTEGER NOT NULL DEFAULT 0,
  access_token TEXT NOT NULL UNIQUE,
  token_used BOOLEAN NOT NULL DEFAULT FALSE,
  token_used_at TIMESTAMPTZ,
  granted_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  grant_window_expires_at TIMESTAMPTZ,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_grants_user_id ON traffic_grants (user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_grants_status ON traffic_grants (status);

-- =============================================================
-- WEBSITE PAGE VIEWS
-- =============================================================
CREATE TABLE IF NOT EXISTS website_page_views (
  id TEXT PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites (id),
  ip TEXT,
  country TEXT,
  country_code CHAR(2),
  city TEXT,
  region TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  device TEXT,
  referrer TEXT,
  path TEXT,
  is_granted BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_page_views_website_id ON website_page_views (website_id);
CREATE INDEX IF NOT EXISTS idx_website_page_views_timestamp ON website_page_views (timestamp);
CREATE INDEX IF NOT EXISTS idx_website_page_views_website_timestamp ON website_page_views (website_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_website_page_views_website_country ON website_page_views (website_id, country);
CREATE INDEX IF NOT EXISTS idx_website_page_views_is_granted ON website_page_views (is_granted);

-- =============================================================
-- ANALYTICS
-- =============================================================
CREATE TABLE IF NOT EXISTS analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  platform TEXT NOT NULL,
  month TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform, month)
);

-- =============================================================
-- CONVERSATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);

-- =============================================================
-- CAMPAIGNS
-- =============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  audience_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'draft',
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_audience ON campaigns (audience_type);

-- =============================================================
-- CONNECTED ACCOUNTS
-- =============================================================
CREATE TABLE IF NOT EXISTS connected_accounts (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES creators (id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255),
  username VARCHAR(255),
  avatar TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  social_id TEXT,
  UNIQUE (creator_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_creator_id ON connected_accounts (creator_id);

-- =============================================================
-- WEBSITE TRAFFIC EVENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS website_traffic_events (
  id BIGSERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES creators (id) ON DELETE CASCADE,
  website_domain VARCHAR(255) NOT NULL,
  tracking_token VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  visitor_hash VARCHAR(255),
  event_type VARCHAR(50) NOT NULL DEFAULT 'pageview',
  path TEXT,
  referrer TEXT,
  title TEXT,
  user_agent TEXT,
  country VARCHAR(100),
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS website_traffic_events_creator_created_idx
  ON website_traffic_events (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS website_traffic_events_token_idx
  ON website_traffic_events (tracking_token);

-- =============================================================
-- ADSENSE HANDOFFS
-- =============================================================
CREATE TABLE IF NOT EXISTS adsense_handoffs (
  id BIGSERIAL PRIMARY KEY,
  creator_id INTEGER REFERENCES creators (id) ON DELETE CASCADE,
  website_domain VARCHAR(255),
  handoff_token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS adsense_handoffs_token_idx
  ON adsense_handoffs (handoff_token);

-- =============================================================
-- LEGACY BUSINESS / SITE / VISIT TRACKING
-- =============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar TEXT,
  business_name VARCHAR(255),
  is_registered_entity BOOLEAN DEFAULT FALSE,
  location VARCHAR(255),
  business_sector VARCHAR(100),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  site_key VARCHAR(255) UNIQUE NOT NULL,
  owner_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visits (
  id BIGSERIAL PRIMARY KEY,
  site_key VARCHAR(255) NOT NULL,
  visitor_id VARCHAR(255),
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip TEXT,
  event_type VARCHAR(50) DEFAULT 'pageview',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_estimated BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_visits_site_key ON visits (site_key);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits (created_at);
