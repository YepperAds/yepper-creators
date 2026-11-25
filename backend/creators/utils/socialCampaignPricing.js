'use strict';

const CREATOR_SHARE = 0.70;
const BUNDLE_DISCOUNT = 0.15;
const COMMITMENT_DISCOUNTS = Object.freeze({ 1: 0, 3: 0.05, 6: 0.10 });

const YOUTUBE_TIERS = Object.freeze([
  { name: 'Test', min: 0, max: 999, monthly: 61_830 },
  { name: 'Nano', min: 1_000, max: 4_999, monthly: 51_510 },
  { name: 'Micro', min: 5_000, max: 19_999, monthly: 82_410 },
  { name: 'Mid', min: 20_000, max: 49_999, monthly: 154_560 },
  { name: 'Macro', min: 50_000, max: 149_999, monthly: 236_970 },
  { name: 'Mega', min: 150_000, max: Infinity, monthly: 360_000 },
]);

const TIKTOK_TIERS = Object.freeze([
  { name: 'Entry', min: 1_000, max: 4_999, packages: { brand_visit_video: 30_000, creator_location_video: 25_000, creator_captured_photo: 15_000, advertiser_image_post: 8_000, story: 5_000 } },
  { name: 'Nano', min: 5_000, max: 9_999, packages: { brand_visit_video: 40_000, creator_location_video: 35_000, creator_captured_photo: 20_000, advertiser_image_post: 10_000, story: 7_500 } },
  { name: 'Micro', min: 10_000, max: 24_999, packages: { brand_visit_video: 55_000, creator_location_video: 45_000, creator_captured_photo: 25_000, advertiser_image_post: 15_000, story: 10_000 } },
  { name: 'Growing', min: 25_000, max: 49_999, packages: { brand_visit_video: 70_000, creator_location_video: 60_000, creator_captured_photo: 30_000, advertiser_image_post: 18_000, story: 12_000 } },
  { name: 'Established', min: 50_000, max: 99_999, packages: { brand_visit_video: 90_000, creator_location_video: 75_000, creator_captured_photo: 40_000, advertiser_image_post: 22_000, story: 15_000 } },
  { name: 'Macro', min: 100_000, max: 249_999, packages: { brand_visit_video: 115_000, creator_location_video: 95_000, creator_captured_photo: 50_000, advertiser_image_post: 28_000, story: 18_000 } },
  { name: 'Major', min: 250_000, max: 499_999, packages: { brand_visit_video: 140_000, creator_location_video: 115_000, creator_captured_photo: 60_000, advertiser_image_post: 32_000, story: 22_000 } },
  { name: 'Star', min: 500_000, max: 999_999, packages: { brand_visit_video: 165_000, creator_location_video: 135_000, creator_captured_photo: 70_000, advertiser_image_post: 38_000, story: 25_000 } },
  { name: 'Top Star', min: 1_000_000, max: Infinity, packages: { brand_visit_video: 200_000, creator_location_video: 165_000, creator_captured_photo: 85_000, advertiser_image_post: 45_000, story: 30_000 } },
]);

const TIKTOK_PERFORMANCE_LEVELS = Object.freeze([
  { minRatio: 0, level: 'Low', multiplier: 0.80 },
  { minRatio: 0.05, level: 'Developing', multiplier: 0.90 },
  { minRatio: 0.10, level: 'Standard', multiplier: 1.00 },
  { minRatio: 0.20, level: 'Strong', multiplier: 1.10 },
  { minRatio: 0.40, level: 'Very Strong', multiplier: 1.20 },
  { minRatio: 0.80, level: 'Exceptional', multiplier: 1.25 },
]);

const TIKTOK_PACKAGES = Object.freeze([
  { code: 'brand_visit_video', name: 'Brand Visit Video', description: "Creator visits the advertiser's selected location and makes promotional content." },
  { code: 'creator_location_video', name: 'Creator-Location Video', description: 'Creator promotes the product from their usual filming location.' },
  { code: 'creator_captured_photo', name: 'Creator-Captured Photo', description: 'Creator takes an original photo for the advertiser.' },
  { code: 'advertiser_image_post', name: 'Advertiser-Provided Image Post', description: 'Creator publishes an image supplied by the advertiser.' },
  { code: 'story', name: 'Story', description: 'Advertiser purchases a TikTok story placement.' },
]);
const TIKTOK_SPONSORSHIP_PACKAGE_CODE = 'brand_visit_video';

function findTier(tiers, audienceCount) {
  const count = Number(audienceCount);
  if (!Number.isFinite(count) || count < 0) throw new TypeError('Audience count must be a non-negative number');
  return tiers.find((tier) => count >= tier.min && count <= tier.max);
}

function getTikTokPerformance(eligibleVideos, followers, now = new Date()) {
  const count = Number(followers);
  if (!Number.isFinite(count) || count <= 0) {
    return { level: 'Standard', multiplier: 1, medianViews: null, medianViewsToFollowers: null, eligibleVideoCount: 0, evaluable: false };
  }
  const nowMs = new Date(now).getTime();
  const cutoffMs = nowMs - 90 * 24 * 60 * 60 * 1000;
  // Numeric inputs are already eligible views in newest-first order.
  const views = Array.isArray(eligibleVideos)
    ? eligibleVideos.flatMap((video) => {
      if (typeof video === 'number') return Number.isFinite(video) && video >= 0 ? [{ views: video, date: null }] : [];
      if (!video || typeof video !== 'object' || video.paidBoosted === true || video.isPaidBoosted === true) return [];
      const videoViews = Number(video.views);
      const date = new Date(video.createdAt || video.publishedAt).getTime();
      if (!Number.isFinite(videoViews) || videoViews < 0 || !Number.isFinite(date) || date < cutoffMs || date > nowMs) return [];
      return [{ views: videoViews, date }];
    }).sort((a, b) => {
      if (a.date === null) return b.date === null ? 0 : -1;
      if (b.date === null) return 1;
      return b.date - a.date;
    }).slice(0, 12).map((video) => video.views)
    : [];
  if (views.length < 8) {
    return { level: 'Standard', multiplier: 1, medianViews: null, medianViewsToFollowers: null, eligibleVideoCount: views.length, evaluable: false };
  }
  const sorted = [...views].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianViews = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const ratio = medianViews / count;
  const performance = [...TIKTOK_PERFORMANCE_LEVELS].reverse().find((level) => ratio >= level.minRatio);
  return {
    level: performance.level,
    multiplier: performance.multiplier,
    medianViews,
    medianViewsToFollowers: ratio,
    eligibleVideoCount: views.length,
    evaluable: true,
  };
}

function retainTikTokPerformanceLevel(reviewLevels, currentLevel = 'Standard') {
  if (!Array.isArray(reviewLevels) || reviewLevels.length < 2) return currentLevel;
  const [latest, previous] = reviewLevels.slice(-2).reverse();
  return latest && latest === previous ? latest : currentLevel;
}

function calculateSocialItemPrice({ platform, audienceCount, packageCode, commitmentMonths = 1, bundled = false, performanceMultiplier = 1 }) {
  if (!['youtube', 'tiktok'].includes(platform)) throw new TypeError('Platform must be youtube or tiktok');
  if (!Object.prototype.hasOwnProperty.call(COMMITMENT_DISCOUNTS, commitmentMonths)) {
    throw new TypeError('Commitment must be 1, 3, or 6 months');
  }
  if (!Number.isFinite(performanceMultiplier) || performanceMultiplier <= 0) {
    throw new TypeError('Performance multiplier must be a positive number');
  }

  const tier = findTier(platform === 'youtube' ? YOUTUBE_TIERS : TIKTOK_TIERS, audienceCount);
  if (!tier) throw new TypeError('No pricing tier found for audience count');

  let baseMonthlyPrice;
  if (platform === 'youtube') {
    if (packageCode !== 'youtube_video') throw new TypeError('Invalid YouTube package');
    baseMonthlyPrice = tier.monthly;
  } else {
    if (!Object.prototype.hasOwnProperty.call(tier.packages, packageCode)) throw new TypeError('Invalid TikTok package');
    baseMonthlyPrice = Math.round(tier.packages[packageCode] * performanceMultiplier);
  }

  const commitmentDiscountRate = COMMITMENT_DISCOUNTS[commitmentMonths];
  const commitmentMonthlyPrice = Math.round(baseMonthlyPrice * (1 - commitmentDiscountRate));
  const bundleDiscountRate = bundled ? BUNDLE_DISCOUNT : 0;
  const monthlyPrice = Math.round(commitmentMonthlyPrice * (1 - bundleDiscountRate));
  const listSubtotal = baseMonthlyPrice * commitmentMonths;
  const commitmentDiscountAmount = listSubtotal - (commitmentMonthlyPrice * commitmentMonths);
  const totalPrice = monthlyPrice * commitmentMonths;
  const bundleDiscountAmount = (commitmentMonthlyPrice * commitmentMonths) - totalPrice;
  const creatorEarnings = Math.round(totalPrice * CREATOR_SHARE);

  return {
    platform,
    tier: tier.name,
    packageCode,
    commitmentMonths,
    baseMonthlyPrice,
    commitmentDiscountRate,
    commitmentDiscountAmount,
    bundleDiscountRate,
    bundleDiscountAmount,
    listSubtotal,
    commitmentTotal: commitmentMonthlyPrice * commitmentMonths,
    monthlyPrice,
    totalPrice,
    creatorEarnings,
    yepperRevenue: totalPrice - creatorEarnings,
    performanceMultiplier: platform === 'tiktok' ? performanceMultiplier : 1,
  };
}

function calculateSocialCampaignPrice(selections) {
  if (!Array.isArray(selections) || selections.length === 0) throw new TypeError('At least one package selection is required');
  const platforms = new Set(selections.map((selection) => selection.platform));
  if ([...platforms].some((platform) => !['youtube', 'tiktok'].includes(platform))) {
    throw new TypeError('Platform must be youtube or tiktok');
  }
  const bundled = platforms.size === 2;
  const items = selections.map((selection) => calculateSocialItemPrice({ ...selection, bundled }));
  const summary = items.reduce((result, item) => {
    const current = result[item.platform] || {
      listSubtotal: 0,
      commitmentDiscount: 0,
      bundleDiscount: 0,
      total: 0,
      creatorEarnings: 0,
      yepperRevenue: 0,
    };
    current.listSubtotal += item.listSubtotal;
    current.commitmentDiscount += item.commitmentDiscountAmount;
    current.bundleDiscount += item.bundleDiscountAmount;
    current.total += item.totalPrice;
    current.creatorEarnings += item.creatorEarnings;
    current.yepperRevenue += item.yepperRevenue;
    result[item.platform] = current;
    return result;
  }, {});
  return {
    bundled,
    bundleDiscountRate: bundled ? BUNDLE_DISCOUNT : 0,
    items,
    platforms: summary,
    total: items.reduce((sum, item) => sum + item.totalPrice, 0),
    creatorEarnings: items.reduce((sum, item) => sum + item.creatorEarnings, 0),
    yepperRevenue: items.reduce((sum, item) => sum + item.yepperRevenue, 0),
  };
}

module.exports = {
  CREATOR_SHARE,
  BUNDLE_DISCOUNT,
  COMMITMENT_DISCOUNTS,
  YOUTUBE_TIERS,
  TIKTOK_TIERS,
  TIKTOK_PACKAGES,
  TIKTOK_SPONSORSHIP_PACKAGE_CODE,
  TIKTOK_PERFORMANCE_LEVELS,
  getTikTokPerformance,
  retainTikTokPerformanceLevel,
  calculateSocialItemPrice,
  calculateSocialCampaignPrice,
};
