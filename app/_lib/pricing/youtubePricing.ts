// Pricing is computed server-side (backend/creators/utils/youtubeTierPricing.js)
// from the creator's subscriber count, and returned by
// GET /api/social/youtube/ad-spaces/:creatorId as `tier` + `pricingRows`.
// These types just describe that shape for consumers on the frontend.
//
// Ad type (corner badge vs L-bar) is the creator's own fixed channel-wide
// choice, not a separate advertiser pick — price is just tier + duration +
// whichever format the creator already picked.

export type DurationBand = '5–15s' | '15–30s';
export type TierName = 'Test' | 'Nano' | 'Micro' | 'Mid' | 'Macro' | 'Mega';

export interface PricingRow {
  duration: DurationBand;
  corner: number;
  lbar: number;
}

export interface YouTubePricingResult {
  tier: TierName;
  rows: PricingRow[];
}
