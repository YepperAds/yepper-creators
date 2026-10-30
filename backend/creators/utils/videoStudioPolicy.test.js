'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  estimateVideoProcessingCostUsd,
  evaluateLongVideoRequest,
  getTrialVideosRemaining,
  isTrialIdentityAvailable,
} = require('./videoStudioPolicy');

const baseRequest = {
  verificationStatus: 'verified',
  processingEnabled: true,
  globalSpentUsd: 0,
  globalReservedUsd: 0,
  globalCapUsd: 20,
  durationSeconds: 3600,
  fileSizeBytes: 2 * 1024 ** 3,
  maxFileSizeBytes: 100 * 1024 ** 3,
  trialLimit: 3,
  trialUsed: 0,
  trialReserved: 0,
};

test('allows and reserves a trial video without consuming it immediately', () => {
  const result = evaluateLongVideoRequest(baseRequest);
  assert.equal(result.allowed, true);
  assert.equal(result.allowanceType, 'trial');
  assert.equal(result.reservedHours, 1);
});

test('deducted trial count is modeled only after a successful reservation settles', () => {
  const beforeSuccess = evaluateLongVideoRequest({ ...baseRequest, trialUsed: 2, trialReserved: 0 });
  const afterSuccess = evaluateLongVideoRequest({ ...baseRequest, trialUsed: 3, trialReserved: 0 });
  assert.equal(beforeSuccess.allowanceType, 'trial');
  assert.equal(afterSuccess.code, 'PLAN_REQUIRED');
});

test('a failed or rejected trial reservation restores the available video count', () => {
  const availableBeforeReservation = getTrialVideosRemaining({ used: 1, reserved: 0, limit: 3 });
  const availableDuringReservation = getTrialVideosRemaining({ used: 1, reserved: 1, limit: 3 });
  const availableAfterRefund = getTrialVideosRemaining({ used: 1, reserved: 0, limit: 3 });
  assert.equal(availableBeforeReservation, 2);
  assert.equal(availableDuringReservation, 1);
  assert.equal(availableAfterRefund, 2);
});

test('trial videos are limited to two hours, while an active plan can cover longer videos', () => {
  const trialOnly = evaluateLongVideoRequest({
    ...baseRequest,
    durationSeconds: 121 * 60,
  });
  assert.equal(trialOnly.code, 'PLAN_REQUIRED');

  const withPlan = evaluateLongVideoRequest({
    ...baseRequest,
    durationSeconds: 121 * 60,
    subscription: {
      status: 'active',
      hoursIncluded: 4,
      hoursUsed: 0,
      hoursReserved: 0,
      periodEnd: new Date(Date.now() + 86_400_000).toISOString(),
    },
  });
  assert.equal(withPlan.allowed, true);
  assert.equal(withPlan.allowanceType, 'subscription');
});

test('reserves subscription hours when available', () => {
  const result = evaluateLongVideoRequest({
    ...baseRequest,
    trialUsed: 3,
    subscription: {
      status: 'active',
      hoursIncluded: 4,
      hoursUsed: 2,
      hoursReserved: 0,
      periodEnd: new Date(Date.now() + 86_400_000).toISOString(),
    },
  });
  assert.equal(result.allowanceType, 'subscription');
  assert.equal(result.reservedHours, 1);
});

test('charges only the extra hours beyond an active plan allowance', () => {
  const result = evaluateLongVideoRequest({
    ...baseRequest,
    durationSeconds: 2 * 3600,
    trialUsed: 3,
    subscription: {
      status: 'active',
      hoursIncluded: 4,
      hoursUsed: 3,
      hoursReserved: 0,
      periodEnd: new Date(Date.now() + 86_400_000).toISOString(),
    },
    extraHourPriceRwf: 3000,
  });
  assert.equal(result.allowanceType, 'extra');
  assert.equal(result.reservedHours, 1);
  assert.equal(result.extraHours, 1);
  assert.equal(result.extraChargeRwf, 3000);
});

test('blocks unverified creators, kill switch, and cap reached', () => {
  assert.equal(evaluateLongVideoRequest({ ...baseRequest, verificationStatus: 'pending' }).code, 'NOT_VERIFIED');
  assert.equal(evaluateLongVideoRequest({ ...baseRequest, processingEnabled: false }).code, 'KILL_SWITCH');
  assert.equal(evaluateLongVideoRequest({
    ...baseRequest,
    globalSpentUsd: 19.5,
    estimatedCostUsd: 0.51,
  }).code, 'CAP_REACHED');
});

test('allows an estimate that uses exactly the remaining global cap', () => {
  assert.equal(evaluateLongVideoRequest({
    ...baseRequest,
    globalSpentUsd: 19,
    estimatedCostUsd: 1,
  }).allowed, true);
});

test('blocks too-long videos, duplicates, concurrent jobs, and trial reuse limits', () => {
  assert.equal(evaluateLongVideoRequest({ ...baseRequest, durationSeconds: 151 * 60 }).code, 'TOO_LONG');
  assert.equal(evaluateLongVideoRequest({ ...baseRequest, duplicate: true }).code, 'DUPLICATE_VIDEO');
  assert.equal(evaluateLongVideoRequest({ ...baseRequest, activeJobs: 1 }).code, 'LIMIT_REACHED');
  assert.equal(evaluateLongVideoRequest({ ...baseRequest, trialUsed: 3 }).code, 'PLAN_REQUIRED');
});

test('one connected channel identity cannot claim a trial under another creator', () => {
  const channels = [{ provider: 'youtube', platformUserId: 'channel-1' }];
  assert.equal(isTrialIdentityAvailable(channels, {}, 1), true);
  assert.equal(isTrialIdentityAvailable(channels, { 'youtube:channel-1': 1 }, 1), true);
  assert.equal(isTrialIdentityAvailable(channels, { 'youtube:channel-1': 1 }, 2), false);
});

test('estimates Basic tier costs in USD', () => {
  assert.equal(estimateVideoProcessingCostUsd(120 * 60, 0.015), 1.8);
});
