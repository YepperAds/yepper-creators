-- ============================================================================
-- Yepper — video ad-space pricing (Preroll / Midroll / Pause)
-- Adds base prices for the 3 new video-player placements to the existing
-- pricing_rules table. Safe to re-run: ON CONFLICT DO NOTHING.
-- ============================================================================

INSERT INTO pricing_rules (tier, space_type, base_price) VALUES
  ('unverified','Preroll',9000),('unverified','Midroll',7800),('unverified','Pause',5400),
  ('starter','Preroll',3000),('starter','Midroll',2600),('starter','Pause',1800),
  ('basic','Preroll',15000),('basic','Midroll',13000),('basic','Pause',9000),
  ('standard','Preroll',30000),('standard','Midroll',26000),('standard','Pause',18000),
  ('premium','Preroll',82000),('premium','Midroll',71000),('premium','Pause',49000),
  ('elite','Preroll',220000),('elite','Midroll',190000),('elite','Pause',132000)
ON CONFLICT (tier, space_type) DO NOTHING;
