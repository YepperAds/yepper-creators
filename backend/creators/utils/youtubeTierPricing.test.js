'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DURATION_BANDS,
  getYoutubeTierPricing,
  getYoutubeChannelPackagePricing,
  getYoutubeChannelCampaignPricing,
  priceFor,
} = require('./youtubeTierPricing');

test('legacy 30-second YouTube rates remain unchanged', () => {
  assert.deepStrictEqual(DURATION_BANDS, ['30 seconds']);

  const tiers = [
    { subscribers: 0, tier: 'Test', corner: 6_000, lbar: 8_000 },
    { subscribers: 999, tier: 'Test', corner: 6_000, lbar: 8_000 },
    { subscribers: 1_000, tier: 'Nano', corner: 5_000, lbar: 6_000 },
    { subscribers: 4_999, tier: 'Nano', corner: 5_000, lbar: 6_000 },
    { subscribers: 5_000, tier: 'Micro', corner: 8_000, lbar: 11_000 },
    { subscribers: 19_999, tier: 'Micro', corner: 8_000, lbar: 11_000 },
    { subscribers: 20_000, tier: 'Mid', corner: 15_000, lbar: 20_000 },
    { subscribers: 49_999, tier: 'Mid', corner: 15_000, lbar: 20_000 },
    { subscribers: 50_000, tier: 'Macro', corner: 23_000, lbar: 30_000 },
    { subscribers: 149_999, tier: 'Macro', corner: 23_000, lbar: 30_000 },
    { subscribers: 150_000, tier: 'Mega', corner: 33_000, lbar: 43_000 },
  ];

  for (const expected of tiers) {
    const pricing = getYoutubeTierPricing(expected.subscribers);
    assert.equal(pricing.tier, expected.tier);
    assert.deepStrictEqual(pricing.rows, [{
      duration: '30 seconds',
      corner: expected.corner,
      lbar: expected.lbar,
    }]);
    assert.deepStrictEqual(priceFor(expected.subscribers, '30 seconds', 'corner'), {
      tier: expected.tier,
      amount: expected.corner,
    });
    assert.deepStrictEqual(priceFor(expected.subscribers, '30 seconds', 'lbar'), {
      tier: expected.tier,
      amount: expected.lbar,
    });
  }

  assert.equal(priceFor(1_000, '5–15s', 'corner'), null);
  assert.equal(priceFor(1_000, '15–30s', 'lbar'), null);
});

test('connected YouTube channel packages match the Corner ad price sheet', () => {
  const tiers = [
    { subscribers: 0, tier: 'Test', cornerAd: 10_000, dailyRate: 2_061, fiveAdRate: 30_000 },
    { subscribers: 999, tier: 'Test', cornerAd: 10_000, dailyRate: 2_061, fiveAdRate: 30_000 },
    { subscribers: 1_000, tier: 'Nano', cornerAd: 200_000, dailyRate: 1_717, fiveAdRate: 30_000 },
    { subscribers: 5_000, tier: 'Micro', cornerAd: 200_000, dailyRate: 2_747, fiveAdRate: 30_000 },
    { subscribers: 20_000, tier: 'Mid', cornerAd: 200_000, dailyRate: 5_152, fiveAdRate: 30_000 },
    { subscribers: 50_000, tier: 'Macro', cornerAd: 200_000, dailyRate: 7_899, fiveAdRate: 30_000 },
    { subscribers: 150_000, tier: 'Mega', cornerAd: 1_000_000, dailyRate: 11_000, fiveAdRate: 80_000 },
  ];

  for (const expected of tiers) {
    const channelPricing = {
      tier: expected.tier,
      cornerAd: expected.cornerAd,
      dailyRate: expected.dailyRate,
      dailyTotal: expected.dailyRate * 30,
      fiveAdRate: expected.fiveAdRate,
      fiveMonthlyTotal: expected.fiveAdRate * 5,
    };
    assert.deepStrictEqual(getYoutubeChannelPackagePricing(expected.subscribers), channelPricing);
    assert.deepStrictEqual(getYoutubeChannelCampaignPricing(expected.subscribers, 'daily_30_days'), {
      ...channelPricing,
      packageMonths: 1,
      totalInsertions: 30,
      amountPerInsertion: expected.dailyRate,
      totalCost: expected.dailyRate * 30,
    });
    assert.deepStrictEqual(getYoutubeChannelCampaignPricing(expected.subscribers, 'five_monthly'), {
      ...channelPricing,
      packageMonths: 1,
      totalInsertions: 5,
      amountPerInsertion: expected.fiveAdRate,
      totalCost: expected.fiveAdRate * 5,
    });
  }
  assert.equal(getYoutubeChannelCampaignPricing(1_000, 'invalid'), null);
});
