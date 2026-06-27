// Pricing is computed server-side (backend/creators/utils/youtubeTierPricing.js)
// from the creator's subscriber count, and returned by
// GET /api/social/youtube/ad-spaces/:creatorId as `tier` + `pricingRows`.
// These types just describe that shape for consumers on the frontend.

export type DurationBand = '5–15s' | '15–30s' | '30–60s' | '60–120s';
export type TierName = 'Test Tier' | 'Nano' | 'Micro' | 'Mid' | 'Macro' | 'Mega';

export interface PricingRow {
  duration: DurationBand;
  video_ad: number;
  audio_ad: number;
  mention: number;
}

export interface YouTubePricingResult {
  tier: TierName;
  rows: PricingRow[];
}
