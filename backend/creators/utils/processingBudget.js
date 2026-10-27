'use strict';

const CREATOR_SHARE = 0.70;

function getProcessingBudgetConfig(env = process.env) {
  const budgetPercent = Number(env.PROCESSING_BUDGET_PERCENT_OF_COMMISSION ?? 10);
  const costPerMinuteUsd = Number(env.PROCESSING_COST_PER_MIN_USD ?? 0);
  const usdRwfRate = Number(env.USD_RWF_RATE ?? 0);

  if (!Number.isFinite(budgetPercent) || budgetPercent < 0 || budgetPercent > 100) {
    throw new Error('PROCESSING_BUDGET_PERCENT_OF_COMMISSION must be a number from 0 to 100');
  }
  if (!Number.isFinite(costPerMinuteUsd) || costPerMinuteUsd < 0) {
    throw new Error('PROCESSING_COST_PER_MIN_USD must be a non-negative number');
  }
  if (!Number.isFinite(usdRwfRate) || usdRwfRate < 0) {
    throw new Error('USD_RWF_RATE must be a non-negative number');
  }

  return {
    commissionRate: 1 - CREATOR_SHARE,
    budgetPercentOfCommission: budgetPercent / 100,
    costPerMinuteUsd,
    usdRwfRate,
  };
}

function requireProcessingCostConfig(env = process.env) {
  const config = getProcessingBudgetConfig(env);
  if (config.costPerMinuteUsd <= 0 || config.usdRwfRate <= 0) {
    throw new Error('Long-video processing is not configured; set PROCESSING_COST_PER_MIN_USD and USD_RWF_RATE');
  }
  return config;
}

function estimateProcessingCostRwf(durationSeconds, config = getProcessingBudgetConfig()) {
  const durationMinutes = Number(durationSeconds) / 60;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Video duration must be a positive number of seconds');
  }
  return Math.ceil(durationMinutes * config.costPerMinuteUsd * config.usdRwfRate);
}

function calculateCampaignBudget({ confirmedNetPayments, spent, estimatedCost, config = getProcessingBudgetConfig() }) {
  const confirmedAmount = Math.max(0, Number(confirmedNetPayments) || 0);
  const spentAmount = Math.max(0, Number(spent) || 0);
  const budget = confirmedAmount * config.commissionRate * config.budgetPercentOfCommission;
  const remaining = Math.max(0, budget - spentAmount);
  const enough = estimatedCost <= remaining;
  return {
    confirmedNetPayments: confirmedAmount,
    budget,
    spent: spentAmount,
    remaining,
    estimatedCost,
    enough,
  };
}

function shouldBypassProcessingBudget({ fileSizeBytes, cloudinaryLimitBytes }) {
  return fileSizeBytes <= cloudinaryLimitBytes;
}

module.exports = {
  calculateCampaignBudget,
  CREATOR_SHARE,
  estimateProcessingCostRwf,
  getProcessingBudgetConfig,
  requireProcessingCostConfig,
  shouldBypassProcessingBudget,
};
