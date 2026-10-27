const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateCampaignBudget,
  estimateProcessingCostRwf,
  shouldBypassProcessingBudget,
} = require('./processingBudget');

const config = {
  commissionRate: 0.30,
  budgetPercentOfCommission: 0.10,
  costPerMinuteUsd: 1,
  usdRwfRate: 1000,
};

test('allows processing when the campaign has exactly enough remaining budget', () => {
  const budget = calculateCampaignBudget({
    confirmedNetPayments: 100_000,
    spent: 1_000,
    estimatedCost: 2_000,
    config,
  });
  assert.equal(budget.budget, 3_000);
  assert.equal(budget.remaining, 2_000);
  assert.equal(budget.enough, true);
});

test('rejects processing when the estimate exceeds the remaining budget', () => {
  const budget = calculateCampaignBudget({
    confirmedNetPayments: 100_000,
    spent: 1_000,
    estimatedCost: 2_001,
    config,
  });
  assert.equal(budget.remaining, 2_000);
  assert.equal(budget.enough, false);
});

test('a campaign with no confirmed payments has no processing budget', () => {
  const budget = calculateCampaignBudget({
    confirmedNetPayments: 0,
    spent: 0,
    estimatedCost: 1,
    config,
  });
  assert.equal(budget.budget, 0);
  assert.equal(budget.remaining, 0);
  assert.equal(budget.enough, false);
});

test('videos at or below the Cloudinary size limit bypass budget checks', () => {
  const cloudinaryLimitBytes = 100 * 1024 * 1024;
  assert.equal(shouldBypassProcessingBudget({
    fileSizeBytes: cloudinaryLimitBytes,
    cloudinaryLimitBytes,
  }), true);
  assert.equal(shouldBypassProcessingBudget({
    fileSizeBytes: cloudinaryLimitBytes + 1,
    cloudinaryLimitBytes,
  }), false);
});

test('estimates long-video cost from configured minutes and exchange rate', () => {
  assert.equal(estimateProcessingCostRwf(90, config), 1_500);
});
