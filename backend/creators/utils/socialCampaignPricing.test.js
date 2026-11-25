'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateSocialItemPrice,
  calculateSocialCampaignPrice,
  getTikTokPerformance,
  retainTikTokPerformanceLevel,
} = require('./socialCampaignPricing');

test('calculates platform-specific prices and commitment discounts once', () => {
  const youtube = calculateSocialItemPrice({
    platform: 'youtube',
    audienceCount: 1_000,
    packageCode: 'youtube_video',
    commitmentMonths: 3,
  });
  assert.equal(youtube.tier, 'Nano');
  assert.equal(youtube.monthlyPrice, 48_935);
  assert.equal(youtube.totalPrice, 146_805);

  const tiktok = calculateSocialItemPrice({
    platform: 'tiktok',
    audienceCount: 1_000,
    packageCode: 'brand_visit_video',
    commitmentMonths: 3,
  });
  assert.equal(tiktok.monthlyPrice, 28_500);
  assert.equal(tiktok.totalPrice, 85_500);
  assert.equal(tiktok.creatorEarnings, 59_850);
  assert.equal(tiktok.yepperRevenue, 25_650);
});

test('applies the bundle discount to each selected platform and removes it when one is removed', () => {
  const selections = [
    { platform: 'youtube', audienceCount: 1_000, packageCode: 'youtube_video', commitmentMonths: 1 },
    { platform: 'tiktok', audienceCount: 1_000, packageCode: 'story', commitmentMonths: 1 },
  ];
  const combined = calculateSocialCampaignPrice(selections);
  assert.equal(combined.bundled, true);
  assert.equal(combined.platforms.youtube.total, 43_784);
  assert.equal(combined.platforms.tiktok.total, 4_250);
  assert.equal(combined.total, 48_034);
  assert.equal(combined.creatorEarnings + combined.yepperRevenue, combined.total);

  const youtubeOnly = calculateSocialCampaignPrice(selections.slice(0, 1));
  assert.equal(youtubeOnly.bundled, false);
  assert.equal(youtubeOnly.total, 51_510);
});

test('applies TikTok performance multipliers and requires enough eligible videos', () => {
  const insufficient = getTikTokPerformance([100, 200, 300, 400, 500, 600, 700], 1_000);
  assert.equal(insufficient.evaluable, false);
  assert.equal(insufficient.multiplier, 1);

  const strong = getTikTokPerformance([200, 210, 220, 230, 240, 250, 260, 270], 1_000);
  assert.equal(strong.medianViews, 235);
  assert.equal(strong.level, 'Strong');
  assert.equal(strong.multiplier, 1.1);
});

test('performance evaluation ignores paid-boosted and out-of-window videos and requires two reviews to change level', () => {
  const now = new Date('2026-11-25T00:00:00Z');
  const recentVideos = Array.from({ length: 8 }, (_, index) => ({
    views: 450 + index,
    publishedAt: new Date(now.getTime() - index * 24 * 60 * 60 * 1000).toISOString(),
  }));
  recentVideos.push(
    { views: 10_000, paidBoosted: true, publishedAt: '2026-11-24T00:00:00Z' },
    { views: 1, publishedAt: '2026-01-01T00:00:00Z' },
  );
  const result = getTikTokPerformance(recentVideos, 1_000, now);
  assert.equal(result.eligibleVideoCount, 8);
  assert.equal(result.level, 'Very Strong');
  assert.equal(result.multiplier, 1.2);
  assert.equal(retainTikTokPerformanceLevel(['Standard', 'Strong'], 'Standard'), 'Standard');
  assert.equal(retainTikTokPerformanceLevel(['Strong', 'Strong'], 'Standard'), 'Strong');
});

test('rejects invalid package and commitment selections', () => {
  assert.throws(() => calculateSocialItemPrice({
    platform: 'tiktok',
    audienceCount: 1_000,
    packageCode: 'unknown',
  }), /Invalid TikTok package/);
  assert.throws(() => calculateSocialItemPrice({
    platform: 'youtube',
    audienceCount: 1_000,
    packageCode: 'youtube_video',
    commitmentMonths: 2,
  }), /Commitment/);
});
