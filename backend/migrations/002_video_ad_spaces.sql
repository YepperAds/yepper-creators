-- ============================================================================
-- Yepper — video ad-space pricing (Pre-roll / Mid-roll / Pause)
-- Adds base prices for the 3 new video-player placements to the existing
-- pricing_rules table. Safe to re-run.
-- ============================================================================

-- Earlier deploy of this migration used 'Preroll'/'Midroll' (no hyphen) —
-- rename any rows already seeded under those names so they line up with the
-- canonical 'Pre-roll'/'Mid-roll' labels before the upsert below.
UPDATE pricing_rules SET space_type = 'Pre-roll' WHERE space_type = 'Preroll';
UPDATE pricing_rules SET space_type = 'Mid-roll' WHERE space_type = 'Midroll';

INSERT INTO pricing_rules (tier, space_type, base_price) VALUES
  ('unverified','Pre-roll',11200),('unverified','Mid-roll',13500),('unverified','Pause',5000),
  ('starter','Pre-roll',3800),('starter','Mid-roll',4500),('starter','Pause',1700),
  ('basic','Pre-roll',18800),('basic','Mid-roll',22500),('basic','Pause',8200),
  ('standard','Pre-roll',38000),('standard','Mid-roll',45000),('standard','Pause',17000),
  ('premium','Pre-roll',102000),('premium','Mid-roll',123000),('premium','Pause',45000),
  ('elite','Pre-roll',275000),('elite','Mid-roll',330000),('elite','Pause',121000)
ON CONFLICT (tier, space_type) DO UPDATE SET base_price = EXCLUDED.base_price, updated_at = NOW();
