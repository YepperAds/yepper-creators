'use strict';

// Single source of truth for YouTube ad pricing — tiered purely by the
// creator's subscriber count (per the Yepper YouTube Pricing Tiers sheet).
// Creator keeps 70%, Yepper takes 30% — applied at payment time, not baked
// into these numbers, since the sheet lists the full advertiser-facing price.
//
// Ad "type" here is the same corner-badge-vs-L-bar overlay format the
// creator already fixes once for their whole channel (see AD_FORMATS in
// adOverlay.js) — the sheet prices by that same format, so a claim's price
// is just tier + duration + whichever format the creator picked. There's no
// separate advertiser-facing "ad kind" choice.
//
// Tier 'Test' covers new channels; the remaining subscriber bands and prices
// match the pricing sheet exactly.

const DURATION_BANDS = ['30 seconds'];
const AD_TYPES = ['corner', 'lbar'];

const TIER_TABLE = [
  {
    name: 'Test', minSubs: 0,
    rows: [
      { duration: '30 seconds', corner: 6_000, lbar: 8_000 },
    ],
  },
  {
    name: 'Nano', minSubs: 1_000,
    rows: [
      { duration: '30 seconds', corner: 5_000, lbar: 6_000 },
    ],
  },
  {
    name: 'Micro', minSubs: 5_000,
    rows: [
      { duration: '30 seconds', corner: 8_000, lbar: 11_000 },
    ],
  },
  {
    name: 'Mid', minSubs: 20_000,
    rows: [
      { duration: '30 seconds', corner: 15_000, lbar: 20_000 },
    ],
  },
  {
    name: 'Macro', minSubs: 50_000,
    rows: [
      { duration: '30 seconds', corner: 23_000, lbar: 30_000 },
    ],
  },
  {
    name: 'Mega', minSubs: 150_000,
    rows: [
      { duration: '30 seconds', corner: 33_000, lbar: 43_000 },
    ],
  },
].sort((a, b) => b.minSubs - a.minSubs); // highest minSubs first, for find()

/**
 * Determine a creator's ad pricing tier purely from subscriber count.
 * @param {number} subscribers
 * @returns {{ tier: string, rows: Array }}
 */
function getYoutubeTierPricing(subscribers) {
  const subs = Number.isFinite(subscribers) && subscribers > 0 ? Math.round(subscribers) : 0;
  const tierDef = TIER_TABLE.find((t) => subs >= t.minSubs) ?? TIER_TABLE[TIER_TABLE.length - 1];
  return { tier: tierDef.name, rows: tierDef.rows };
}

/**
 * Authoritative price lookup for one (subscriber count, duration, ad type)
 * combo — used to price a claim/payment server-side, never trusting a
 * client-supplied amount.
 * @param {number} subscribers
 * @param {string} durationBand - one of DURATION_BANDS
 * @param {string} adType - one of AD_TYPES ('corner' | 'lbar')
 * @returns {{ tier: string, amount: number } | null}
 */
function priceFor(subscribers, durationBand, adType) {
  if (!DURATION_BANDS.includes(durationBand) || !AD_TYPES.includes(adType)) return null;
  const { tier, rows } = getYoutubeTierPricing(subscribers);
  const row = rows.find((r) => r.duration === durationBand);
  if (!row) return null;
  return { tier, amount: row[adType] };
}

module.exports = { DURATION_BANDS, AD_TYPES, getYoutubeTierPricing, priceFor };
