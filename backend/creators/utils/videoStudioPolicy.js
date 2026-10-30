'use strict';

const DEFAULT_PLANS = Object.freeze({
  starter: { name: 'Starter', priceRwf: 10_000, hoursIncluded: 4, enabled: true },
  creator: { name: 'Creator', priceRwf: 25_000, hoursIncluded: 10, enabled: true },
  pro: { name: 'Pro', priceRwf: 55_000, hoursIncluded: 24, enabled: false },
});

function getVideoStudioConfig(env = process.env) {
  const numeric = (name, fallback, minimum = 0) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isFinite(value) || value < minimum) {
      throw new Error(`${name} must be a number greater than or equal to ${minimum}`);
    }
    return value;
  };
  return {
    trialLongVideos: numeric('TRIAL_LONG_VIDEOS_PER_CREATOR', 3),
    globalMonthlyCapUsd: numeric('GLOBAL_MONTHLY_CAP_USD', 20),
    maxVideoMinutes: numeric('MAX_LONG_VIDEO_MINUTES', 150, 1),
    maxFileSizeGb: numeric('MAX_AWS_AD_VIDEO_SIZE_GB', 100, 0.1),
    maxConcurrentJobs: numeric('MAX_CONCURRENT_LONG_VIDEO_JOBS_PER_CREATOR', 1, 1),
    maxVideosPerDay: numeric('MAX_LONG_VIDEOS_PER_DAY', 3, 1),
    maxVideosPerMonth: numeric('MAX_LONG_VIDEOS_PER_MONTH', 30, 1),
    maxRetries: numeric('MAX_LONG_VIDEO_RETRIES', 2),
    processingCostPerMinuteUsd: numeric('PROCESSING_COST_PER_MIN_USD', 0.015),
    usdRwfRate: numeric('USD_RWF_RATE', 1478.11, 0.01),
    extraHourPriceRwf: numeric('EXTRA_PROCESSING_HOUR_PRICE_RWF', 3000),
    proEnabled: String(env.PLAN_PRO_ENABLED ?? 'false').toLowerCase() === 'true',
    processingEnabled: String(env.PROCESSING_ENABLED ?? 'true').toLowerCase() !== 'false',
  };
}

function estimateVideoProcessingCostUsd(durationSeconds, costPerMinuteUsd) {
  const seconds = Number(durationSeconds);
  const rate = Number(costPerMinuteUsd);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Video duration must be positive');
  if (!Number.isFinite(rate) || rate < 0) throw new Error('Processing rate must be non-negative');
  return Math.ceil((seconds / 60) * rate * 100) / 100;
}

function getTrialVideosRemaining({ used = 0, reserved = 0, limit = 3 }) {
  return Math.max(0, Number(limit) - Number(used) - Number(reserved));
}

function isTrialIdentityAvailable(identities, claimedIdentities, creatorId) {
  return identities.every((identity) => {
    const claimant = claimedIdentities[`${identity.provider}:${identity.platformUserId}`];
    return claimant == null || String(claimant) === String(creatorId);
  });
}

function evaluateLongVideoRequest({
  verificationStatus,
  processingEnabled,
  globalSpentUsd,
  globalReservedUsd = 0,
  estimatedCostUsd = 0,
  globalCapUsd,
  durationSeconds,
  maxDurationMinutes = 150,
  fileSizeBytes,
  maxFileSizeBytes,
  activeJobs = 0,
  maxConcurrentJobs = 1,
  dailyJobs = 0,
  monthlyJobs = 0,
  maxVideosPerDay = 3,
  maxVideosPerMonth = 30,
  duplicate = false,
  retryCount = 0,
  maxRetries = 2,
  trialUsed = 0,
  trialReserved = 0,
  trialLimit = 3,
  subscription = null,
  extraHoursEnabled = true,
  extraHourPriceRwf = 3000,
}) {
  const reject = (code, message) => ({ allowed: false, code, message });
  if (verificationStatus !== 'verified') {
    return reject('NOT_VERIFIED', 'Verify your creator account before starting long-video processing.');
  }
  if (!processingEnabled) {
    return reject('KILL_SWITCH', 'Long-video processing is temporarily paused.');
  }
  const projectedSpend = Number(globalSpentUsd || 0) + Number(globalReservedUsd || 0);
  if (projectedSpend + Number(estimatedCostUsd || 0) > Number(globalCapUsd)) {
    return reject('CAP_REACHED', 'The monthly processing limit has been reached. Please try again next month.');
  }
  if (Number(durationSeconds) > Number(maxDurationMinutes) * 60) {
    return reject('TOO_LONG', `Long videos must be ${Number(maxDurationMinutes)} minutes or shorter.`);
  }
  if (Number(durationSeconds) <= 0) {
    return reject('INVALID_VIDEO', 'The video duration could not be verified.');
  }
  if (Number(fileSizeBytes) > Number(maxFileSizeBytes)) {
    return reject('FILE_TOO_LARGE', 'This video exceeds the maximum upload size.');
  }
  if (duplicate) return reject('DUPLICATE_VIDEO', 'This video has already been submitted for this campaign.');
  if (Number(activeJobs) >= Number(maxConcurrentJobs)) {
    return reject('LIMIT_REACHED', `You can have only ${Number(maxConcurrentJobs)} active long-video job at a time.`);
  }
  if (Number(dailyJobs) >= Number(maxVideosPerDay) || Number(monthlyJobs) >= Number(maxVideosPerMonth)) {
    return reject('LIMIT_REACHED', 'You have reached the long-video processing limit for this period.');
  }
  if (Number(retryCount) > 0 && Number(retryCount) >= Number(maxRetries)) {
    return reject('LIMIT_REACHED', 'This job has reached its retry limit.');
  }

  const hours = Number(durationSeconds) / 3600;
  const trialAvailable = getTrialVideosRemaining({
    used: trialUsed,
    reserved: trialReserved,
    limit: trialLimit,
  });
  if (trialAvailable > 0 && hours <= 2) {
    return {
      allowed: true,
      allowanceType: 'trial',
      reservedHours: hours,
      extraHours: 0,
      extraChargeRwf: 0,
    };
  }

  const planIsActive = subscription?.status === 'active'
    && new Date(subscription.periodEnd).getTime() > Date.now();
  if (planIsActive) {
    const hoursRemaining = Math.max(0,
      Number(subscription.hoursIncluded) - Number(subscription.hoursUsed) - Number(subscription.hoursReserved || 0));
    if (hours <= hoursRemaining) {
      return {
        allowed: true,
        allowanceType: 'subscription',
        reservedHours: hours,
        extraHours: 0,
        extraChargeRwf: 0,
      };
    }
    if (extraHoursEnabled) {
      const extraHours = Math.max(0, Math.ceil((hours - hoursRemaining) * 100) / 100);
      return {
        allowed: true,
        allowanceType: 'extra',
        reservedHours: hoursRemaining,
        extraHours,
        extraChargeRwf: Math.ceil(extraHours * Number(extraHourPriceRwf)),
      };
    }
  }
  return reject('PLAN_REQUIRED', 'Your trial is used. Request an active plan to process more long videos.');
}

module.exports = {
  DEFAULT_PLANS,
  estimateVideoProcessingCostUsd,
  evaluateLongVideoRequest,
  getVideoStudioConfig,
  getTrialVideosRemaining,
  isTrialIdentityAvailable,
};
