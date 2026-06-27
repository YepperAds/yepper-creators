'use strict';

// Single source of truth for YouTube ad pricing — tiered purely by the
// creator's subscriber count (per the Yepper Creator Pricing sheet).
// Creator keeps 70%, Yepper takes 30% — applied at payment time, not baked
// into these numbers, since the sheet lists the full advertiser-facing price.
//
// Tier 'Test Tier' covers very new/small channels (0–999 subs) and uses the
// same prices as Nano. Micro's 5–15s/15–30s rows aren't on the sheet (it only
// lists 30–60s/60–120s for that tier) — interpolated linearly between Nano
// and Mid.

const DURATION_BANDS = ['5–15s', '15–30s', '30–60s', '60–120s'];
const AD_KINDS = ['video_ad', 'audio_ad', 'mention'];

const TIER_TABLE = [
  {
    name: 'Test Tier', minSubs: 0,
    rows: [
      { duration: '5–15s',   video_ad:   9_000, audio_ad:   4_800, mention:   3_000 },
      { duration: '15–30s',  video_ad:  15_000, audio_ad:   8_000, mention:   5_000 },
      { duration: '30–60s',  video_ad:  22_500, audio_ad:  12_000, mention:   7_500 },
      { duration: '60–120s', video_ad:  33_000, audio_ad:  17_600, mention:  11_000 },
    ],
  },
  {
    name: 'Nano', minSubs: 1_000,
    rows: [
      { duration: '5–15s',   video_ad:   9_000, audio_ad:   4_800, mention:   3_000 },
      { duration: '15–30s',  video_ad:  15_000, audio_ad:   8_000, mention:   5_000 },
      { duration: '30–60s',  video_ad:  22_500, audio_ad:  12_000, mention:   7_500 },
      { duration: '60–120s', video_ad:  33_000, audio_ad:  17_600, mention:  11_000 },
    ],
  },
  {
    name: 'Micro', minSubs: 5_000,
    rows: [
      { duration: '5–15s',   video_ad:  21_000, audio_ad:  10_800, mention:   6_000 },
      { duration: '15–30s',  video_ad:  35_000, audio_ad:  18_000, mention:  10_000 },
      { duration: '30–60s',  video_ad:  52_500, audio_ad:  27_000, mention:  15_000 },
      { duration: '60–120s', video_ad:  77_000, audio_ad:  39_600, mention:  22_000 },
    ],
  },
  {
    name: 'Mid', minSubs: 20_000,
    rows: [
      { duration: '5–15s',   video_ad:  45_000, audio_ad:  24_000, mention:  13_200 },
      { duration: '15–30s',  video_ad:  75_000, audio_ad:  40_000, mention:  22_000 },
      { duration: '30–60s',  video_ad: 112_500, audio_ad:  60_000, mention:  33_000 },
      { duration: '60–120s', video_ad: 165_000, audio_ad:  88_000, mention:  48_400 },
    ],
  },
  {
    name: 'Macro', minSubs: 50_000,
    rows: [
      { duration: '5–15s',   video_ad:  96_000, audio_ad:  51_000, mention:  27_000 },
      { duration: '15–30s',  video_ad: 160_000, audio_ad:  85_000, mention:  45_000 },
      { duration: '30–60s',  video_ad: 240_000, audio_ad: 127_500, mention:  67_500 },
      { duration: '60–120s', video_ad: 352_000, audio_ad: 187_000, mention:  99_000 },
    ],
  },
  {
    name: 'Mega', minSubs: 150_000,
    rows: [
      { duration: '5–15s',   video_ad: 210_000, audio_ad: 108_000, mention:  54_000 },
      { duration: '15–30s',  video_ad: 350_000, audio_ad: 180_000, mention:  90_000 },
      { duration: '30–60s',  video_ad: 525_000, audio_ad: 270_000, mention: 135_000 },
      { duration: '60–120s', video_ad: 770_000, audio_ad: 396_000, mention: 198_000 },
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
 * Authoritative price lookup for one (subscriber count, duration, ad kind)
 * combo — used to price a claim/payment server-side, never trusting a
 * client-supplied amount.
 * @param {number} subscribers
 * @param {string} durationBand - one of DURATION_BANDS
 * @param {string} adKind - one of AD_KINDS
 * @returns {{ tier: string, amount: number } | null}
 */
function priceFor(subscribers, durationBand, adKind) {
  if (!DURATION_BANDS.includes(durationBand) || !AD_KINDS.includes(adKind)) return null;
  const { tier, rows } = getYoutubeTierPricing(subscribers);
  const row = rows.find((r) => r.duration === durationBand);
  if (!row) return null;
  return { tier, amount: row[adKind] };
}

module.exports = { DURATION_BANDS, AD_KINDS, getYoutubeTierPricing, priceFor };
