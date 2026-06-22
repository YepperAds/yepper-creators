-- ============================================================================
-- Yepper — pricing tables
-- One editable source of truth for ad-space prices + the margin percentage.
-- Run once against your PostgreSQL database (psql -f 001_pricing_tables.sql).
-- Safe to re-run: uses IF NOT EXISTS + ON CONFLICT DO NOTHING.
-- ============================================================================

-- 1) Per-tier, per-space base price (what the WEB OWNER receives, in full).
CREATE TABLE IF NOT EXISTS pricing_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier        TEXT NOT NULL,          -- unverified | starter | basic | standard | premium | elite
  space_type  TEXT NOT NULL,          -- canonical space name e.g. 'Header', 'Floating'
  base_price  NUMERIC(12,2) NOT NULL, -- owner price (RWF / month)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tier, space_type)
);

-- 2) Global settings — the margin percentage added on top for advertisers.
CREATE TABLE IF NOT EXISTS pricing_settings (
  id            INT PRIMARY KEY DEFAULT 1,
  margin_percent NUMERIC(6,2) NOT NULL DEFAULT 30,   -- advertiser pays base * (1 + margin/100)
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_settings_singleton CHECK (id = 1)
);

INSERT INTO pricing_settings (id, margin_percent) VALUES (1, 30)
ON CONFLICT (id) DO NOTHING;

-- 3) Seed prices from the current hardcoded TIER_PRICES table.
INSERT INTO pricing_rules (tier, space_type, base_price) VALUES
  ('unverified','Header',9000),('unverified','Above The Fold',7800),('unverified','Sticky Sidebar',6000),('unverified','Mobile Interstitial',6000),('unverified','Overlay',5400),('unverified','Floating',4800),('unverified','Modal',4200),('unverified','Left Rail',3600),('unverified','Right Rail',3600),('unverified','Sidebar',3000),('unverified','In Feed',2400),('unverified','Inline Content',2400),('unverified','Beneath Title',2100),('unverified','Pro Footer',1500),('unverified','Bottom',1200),
  ('starter','Header',3000),('starter','Above The Fold',2600),('starter','Sticky Sidebar',2000),('starter','Mobile Interstitial',2000),('starter','Overlay',1800),('starter','Floating',1600),('starter','Modal',1400),('starter','Left Rail',1200),('starter','Right Rail',1200),('starter','Sidebar',1000),('starter','In Feed',800),('starter','Inline Content',800),('starter','Beneath Title',700),('starter','Pro Footer',500),('starter','Bottom',400),
  ('basic','Header',15000),('basic','Above The Fold',13000),('basic','Sticky Sidebar',10000),('basic','Mobile Interstitial',10000),('basic','Overlay',9000),('basic','Floating',8000),('basic','Modal',7000),('basic','Left Rail',6000),('basic','Right Rail',6000),('basic','Sidebar',5000),('basic','In Feed',4000),('basic','Inline Content',4000),('basic','Beneath Title',3500),('basic','Pro Footer',2500),('basic','Bottom',2000),
  ('standard','Header',30000),('standard','Above The Fold',26000),('standard','Sticky Sidebar',20000),('standard','Mobile Interstitial',20000),('standard','Overlay',18000),('standard','Floating',16000),('standard','Modal',14000),('standard','Left Rail',12000),('standard','Right Rail',12000),('standard','Sidebar',10000),('standard','In Feed',8000),('standard','Inline Content',8000),('standard','Beneath Title',7000),('standard','Pro Footer',5000),('standard','Bottom',4000),
  ('premium','Header',82000),('premium','Above The Fold',71000),('premium','Sticky Sidebar',55000),('premium','Mobile Interstitial',55000),('premium','Overlay',49000),('premium','Floating',44000),('premium','Modal',38000),('premium','Left Rail',33000),('premium','Right Rail',33000),('premium','Sidebar',27000),('premium','In Feed',22000),('premium','Inline Content',22000),('premium','Beneath Title',19000),('premium','Pro Footer',14000),('premium','Bottom',11000),
  ('elite','Header',220000),('elite','Above The Fold',190000),('elite','Sticky Sidebar',148000),('elite','Mobile Interstitial',148000),('elite','Overlay',132000),('elite','Floating',118000),('elite','Modal',102000),('elite','Left Rail',88000),('elite','Right Rail',88000),('elite','Sidebar',73000),('elite','In Feed',59000),('elite','Inline Content',59000),('elite','Beneath Title',51000),('elite','Pro Footer',37000),('elite','Bottom',29000)
ON CONFLICT (tier, space_type) DO NOTHING;
