'use strict';

// The channelPackages values are the advertiser-facing 60-second Corner
// packages from the current pricing sheet. Legacy 30-second rows remain for
// L-Bar bookings and other existing consumers; payment handlers apply the
// creator's 70% / Yepper's 30% split separately.

const DURATION_BANDS = ['30 seconds'];
const AD_TYPES = ['corner', 'lbar'];

const TIER_TABLE = [
  {
    name: 'Test', minSubs: 0,
    channelPackages: { cornerAd: 10_000, dailyRate: 2_061, fiveAdRate: 30_000 },
    rows: [
      { duration: '30 seconds', corner: 6_000, lbar: 8_000 },
    ],
  },
  {
    name: 'Nano', minSubs: 1_000,
    channelPackages: { cornerAd: 200_000, dailyRate: 1_717, fiveAdRate: 30_000 },
    rows: [
      { duration: '30 seconds', corner: 5_000, lbar: 6_000 },
    ],
  },
  {
    name: 'Micro', minSubs: 5_000,
    channelPackages: { cornerAd: 200_000, dailyRate: 2_747, fiveAdRate: 30_000 },
    rows: [
      { duration: '30 seconds', corner: 8_000, lbar: 11_000 },
    ],
  },
  {
    name: 'Mid', minSubs: 20_000,
    channelPackages: { cornerAd: 200_000, dailyRate: 5_152, fiveAdRate: 30_000 },
    rows: [
      { duration: '30 seconds', corner: 15_000, lbar: 20_000 },
    ],
  },
  {
    name: 'Macro', minSubs: 50_000,
    channelPackages: { cornerAd: 200_000, dailyRate: 7_899, fiveAdRate: 30_000 },
    rows: [
      { duration: '30 seconds', corner: 23_000, lbar: 30_000 },
    ],
  },
  {
    name: 'Mega', minSubs: 150_000,
    channelPackages: { cornerAd: 1_000_000, dailyRate: 11_000, fiveAdRate: 80_000 },
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

function getYoutubeChannelPackagePricing(subscribers) {
  const subs = Number.isFinite(subscribers) && subscribers > 0 ? Math.round(subscribers) : 0;
  const tierDef = TIER_TABLE.find((t) => subs >= t.minSubs) ?? TIER_TABLE[TIER_TABLE.length - 1];
  const { cornerAd, dailyRate, fiveAdRate } = tierDef.channelPackages;
  return {
    tier: tierDef.name,
    cornerAd,
    dailyRate,
    dailyTotal: dailyRate * 30,
    fiveAdRate,
    fiveMonthlyTotal: fiveAdRate * 5,
  };
}

function getYoutubeChannelCampaignPricing(subscribers, packageCode) {
  const pricing = getYoutubeChannelPackagePricing(subscribers);
  if (packageCode === 'daily_30_days') {
    return {
      ...pricing,
      packageMonths: 1,
      totalInsertions: 30,
      amountPerInsertion: pricing.dailyRate,
      totalCost: pricing.dailyTotal,
    };
  }
  if (packageCode === 'five_monthly') {
    return {
      ...pricing,
      packageMonths: 1,
      totalInsertions: 5,
      amountPerInsertion: pricing.fiveAdRate,
      totalCost: pricing.fiveMonthlyTotal,
    };
  }
  return null;
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

module.exports = {
  DURATION_BANDS,
  AD_TYPES,
  getYoutubeTierPricing,
  getYoutubeChannelPackagePricing,
  getYoutubeChannelCampaignPricing,
  priceFor,
};
