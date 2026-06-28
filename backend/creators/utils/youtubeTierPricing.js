'use strict';

// Single source of truth for YouTube ad pricing — tiered purely by the
// creator's subscriber count (per the Yepper Creator Pricing sheet).
// Creator keeps 70%, Yepper takes 30% — applied at payment time, not baked
// into these numbers, since the sheet lists the full advertiser-facing price.
//
// Ad "type" here is the same corner-badge-vs-L-bar overlay format the
// creator already fixes once for their whole channel (see AD_FORMATS in
// adOverlay.js) — the sheet prices by that same format, so a claim's price
// is just tier + duration + whichever format the creator picked. There's no
// separate advertiser-facing "ad kind" choice.
//
// Tier 'Test' covers very new/small channels (0 subs/views) at its own,
// higher flat price. Micro (5K–20K subs) isn't on the sheet — interpolated
// (geometric mean, consistent with how tier pricing scales) between Nano
// and Mid, then rounded to a clean number.

const DURATION_BANDS = ['5–15s', '15–30s'];
const AD_TYPES = ['corner', 'lbar'];

const TIER_TABLE = [
  {
    name: 'Test', minSubs: 0,
    rows: [
      { duration: '5–15s',  corner: 22_500, lbar: 32_500 },
      { duration: '15–30s', corner: 33_000, lbar: 43_000 },
    ],
  },
  {
    name: 'Nano', minSubs: 1_000,
    rows: [
      { duration: '5–15s',  corner:  9_000, lbar: 19_000 },
      { duration: '15–30s', corner: 15_000, lbar: 25_000 },
    ],
  },
  {
    name: 'Micro', minSubs: 5_000,
    rows: [
      { duration: '5–15s',  corner: 20_000, lbar: 32_500 },
      { duration: '15–30s', corner: 33_500, lbar: 46_000 },
    ],
  },
  {
    name: 'Mid', minSubs: 20_000,
    rows: [
      { duration: '5–15s',  corner: 45_000, lbar: 55_000 },
      { duration: '15–30s', corner: 75_000, lbar: 85_000 },
    ],
  },
  {
    name: 'Macro', minSubs: 50_000,
    rows: [
      { duration: '5–15s',  corner:  96_000, lbar: 106_000 },
      { duration: '15–30s', corner: 160_000, lbar: 170_000 },
    ],
  },
  {
    name: 'Mega', minSubs: 150_000,
    rows: [
      { duration: '5–15s',  corner: 210_000, lbar: 220_000 },
      { duration: '15–30s', corner: 350_000, lbar: 360_000 },
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
