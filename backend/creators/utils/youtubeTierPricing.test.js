'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DURATION_BANDS, getYoutubeTierPricing, priceFor } = require('./youtubeTierPricing');

test('YouTube pricing matches the RWF 30-second tier sheet', () => {
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
