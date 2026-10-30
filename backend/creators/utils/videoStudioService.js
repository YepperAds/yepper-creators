'use strict';

const crypto = require('crypto');
const { getClient, query } = require('../../config/db');
const {
  DEFAULT_PLANS,
  estimateVideoProcessingCostUsd,
  evaluateLongVideoRequest,
  getVideoStudioConfig,
  isTrialIdentityAvailable,
} = require('./videoStudioPolicy');

function currentMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function makeVideoFingerprint({ filename, fileSize, duration, claimedSlotTypes }) {
  const normalizedFilename = String(filename || '').split(/[\\/]/).pop().trim().toLowerCase();
  const normalizedSlots = [...new Set(claimedSlotTypes || [])].sort().join(',');
  return crypto.createHash('sha256')
    .update(`${normalizedFilename}|${Number(fileSize)}|${Math.round(Number(duration))}|${normalizedSlots}`)
    .digest('hex');
}

function getLongVideoSizeLimitBytes(config = getVideoStudioConfig()) {
  return Math.floor(config.maxFileSizeGb * 1024 ** 3);
}

async function getPlanRows(db = { query }) {
  const result = await db.query(
    `SELECT code, name, price_rwf, hours_included, enabled
     FROM video_processing_plans ORDER BY price_rwf ASC`,
  );
  const plans = result.rows.length ? result.rows : Object.entries(DEFAULT_PLANS).map(([code, plan]) => ({
    code,
    name: plan.name,
    price_rwf: plan.priceRwf,
    hours_included: plan.hoursIncluded,
    enabled: plan.enabled,
  }));
  const config = getVideoStudioConfig();
  return plans.map((plan) => ({
    code: plan.code,
    name: plan.name,
    priceRwf: Number(plan.price_rwf),
    hoursIncluded: Number(plan.hours_included),
    enabled: plan.code === 'pro' ? config.proEnabled : plan.enabled,
  }));
}

async function getConnectedChannelIdentities(db, creatorId) {
  const result = await db.query(
    `SELECT provider,
            COALESCE(platform_user_id,
              CASE WHEN provider='youtube'
                THEN substring(profile_url FROM 'youtube\\.com/channel/([^/?]+)')
                ELSE NULL END) AS platform_user_id
     FROM social_connections
     WHERE creator_id=$1 AND provider IN ('youtube','tiktok')`,
    [creatorId],
  );
  return result.rows
    .filter((row) => row.platform_user_id)
    .map((row) => ({
      provider: row.provider,
      platformUserId: String(row.platform_user_id),
    }));
}

async function writeVideoProcessingAudit({
  creatorId,
  jobId = null,
  action,
  decision,
  reasonCode = null,
  estimatedCostUsd = null,
  details = {},
  actor = null,
}, db = { query }) {
  await db.query(
    `INSERT INTO video_processing_audit
       (creator_id, job_id, action, decision, reason_code, estimated_cost_usd, details, actor)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [creatorId, jobId, action, decision, reasonCode, estimatedCostUsd, JSON.stringify(details), actor],
  );
}

async function loadEligibilityContext(db, {
  creatorId,
  durationSeconds,
  fileSizeBytes,
  fingerprint = null,
  excludeJobId = null,
  retryCount = 0,
}) {
  const config = getVideoStudioConfig();
  const monthStart = currentMonthStart();
  const videoLimitBytes = getLongVideoSizeLimitBytes(config);
  const [
    creatorResult,
    controlResult,
    monthCostResult,
    jobsResult,
    activeJobResult,
    duplicateResult,
    trialResult,
    subscriptionResult,
    plans,
  ] = await Promise.all([
    db.query(
      `SELECT id, email, full_name, video_verification_status
       FROM creators WHERE id=$1`,
      [creatorId],
    ),
    db.query(`SELECT processing_enabled FROM video_processing_controls WHERE id=1`),
    db.query(
      `SELECT COALESCE(SUM(
         CASE WHEN status='completed' THEN COALESCE(actual_cost_usd, estimated_cost_usd)
              ELSE 0 END
       ),0) AS total_usd,
       COALESCE(SUM(CASE WHEN status='reserved' THEN estimated_cost_usd ELSE 0 END),0) AS reserved_usd
       FROM video_processing_costs WHERE month_start=$1`,
      [monthStart],
    ),
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) AS today_count,
         COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS month_count
       FROM ad_video_jobs
       WHERE creator_id=$1 AND video_fingerprint IS NOT NULL
         AND ($2::integer IS NULL OR id<>$2)`,
      [creatorId, excludeJobId],
    ),
    db.query(
      `SELECT COUNT(*) AS count FROM ad_video_jobs
       WHERE creator_id=$1 AND ($2::integer IS NULL OR id<>$2)
         AND video_fingerprint IS NOT NULL
         AND status IN ('uploading','submitting','pending_approval','approved','processing')`,
      [creatorId, excludeJobId],
    ),
    fingerprint
      ? db.query(
        `SELECT id FROM ad_video_jobs
         WHERE creator_id=$1 AND video_fingerprint=$2
           AND ($3::integer IS NULL OR id<>$3)
         LIMIT 1`,
        [creatorId, fingerprint, excludeJobId],
      )
      : Promise.resolve({ rowCount: 0 }),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE status='completed') AS used,
              COUNT(*) FILTER (WHERE status='reserved') AS reserved
       FROM video_processing_costs
       WHERE creator_id=$1 AND billing_type='trial'`,
      [creatorId],
    ),
    db.query(
      `SELECT subscription.id, subscription.plan_code, subscription.status,
              subscription.hours_included, subscription.hours_used,
              subscription.period_start, subscription.period_end,
              COALESCE(reserved.hours_reserved,0) AS hours_reserved
       FROM video_creator_subscriptions AS subscription
       LEFT JOIN LATERAL (
         SELECT SUM(cost.reserved_hours) AS hours_reserved
         FROM video_processing_costs AS cost
         WHERE cost.subscription_id=subscription.id AND cost.status='reserved'
       ) AS reserved ON TRUE
       WHERE subscription.creator_id=$1 AND subscription.status='active'
         AND subscription.period_end > NOW()
       ORDER BY subscription.period_end DESC LIMIT 1`,
      [creatorId],
    ),
    getPlanRows(db),
  ]);
  const creator = creatorResult.rows[0];
  if (!creator) return { error: { code: 'CREATOR_NOT_FOUND', message: 'Creator account was not found.' } };
  const trialLimit = config.trialLongVideos;
  const activeSubscription = subscriptionResult.rows[0] || null;
  const plan = activeSubscription
    ? plans.find((entry) => entry.code === activeSubscription.plan_code)
    : null;
  const costs = monthCostResult.rows[0] || {};
  const jobCounts = jobsResult.rows[0] || {};
  const trial = trialResult.rows[0] || {};
  const processingEnabled = config.processingEnabled
    && (controlResult.rows[0]?.processing_enabled ?? true);
  const estimateUsd = estimateVideoProcessingCostUsd(durationSeconds, config.processingCostPerMinuteUsd);
  const decision = evaluateLongVideoRequest({
    verificationStatus: creator.video_verification_status,
    processingEnabled,
    globalSpentUsd: Number(costs.total_usd || 0),
    globalReservedUsd: Number(costs.reserved_usd || 0),
    estimatedCostUsd: estimateUsd,
    globalCapUsd: config.globalMonthlyCapUsd,
    durationSeconds,
    maxDurationMinutes: config.maxVideoMinutes,
    fileSizeBytes,
    maxFileSizeBytes: videoLimitBytes,
    activeJobs: Number(activeJobResult.rows[0]?.count || 0),
    maxConcurrentJobs: config.maxConcurrentJobs,
    dailyJobs: Number(jobCounts.today_count || 0),
    monthlyJobs: Number(jobCounts.month_count || 0),
    maxVideosPerDay: config.maxVideosPerDay,
    maxVideosPerMonth: config.maxVideosPerMonth,
    duplicate: duplicateResult.rowCount > 0,
    retryCount,
    maxRetries: config.maxRetries,
    trialUsed: Number(trial.used || 0),
    trialReserved: Number(trial.reserved || 0),
    trialLimit,
    subscription: activeSubscription
      ? {
        ...activeSubscription,
        hoursIncluded: Number(activeSubscription.hours_included),
        hoursUsed: Number(activeSubscription.hours_used),
        hoursReserved: Number(activeSubscription.hours_reserved),
        periodEnd: activeSubscription.period_end,
      }
      : null,
    extraHourPriceRwf: config.extraHourPriceRwf,
  });
  if (decision.allowed && decision.allowanceType === 'trial') {
    const identities = await getConnectedChannelIdentities(db, creatorId);
    if (!identities.length) {
      decision.allowed = false;
      decision.code = 'CHANNEL_REQUIRED';
      decision.message = 'Connect your YouTube or TikTok channel before claiming the creator trial.';
    } else {
      const claimedIdentities = {};
      for (const identity of identities) {
        const claimed = await db.query(
          `SELECT creator_id, status FROM video_processing_trial_channels
           WHERE provider=$1 AND platform_user_id=$2`,
          [identity.provider, identity.platformUserId],
        );
        if (claimed.rowCount) {
          claimedIdentities[`${identity.provider}:${identity.platformUserId}`] = Number(claimed.rows[0].creator_id);
          if (Number(claimed.rows[0].creator_id) === Number(creatorId)
            && claimed.rows[0].status === 'reserved') {
            decision.allowed = false;
            decision.code = 'LIMIT_REACHED';
            decision.message = 'This connected channel already has a trial video in progress.';
            break;
          }
        }
      }
      if (decision.allowed && !isTrialIdentityAvailable(identities, claimedIdentities, creatorId)) {
        decision.allowed = false;
        decision.code = 'TRIAL_ALREADY_CLAIMED';
        decision.message = 'This connected channel has already been used to claim a free trial.';
      }
    }
  }
  return {
    creator,
    config,
    plans,
    activeSubscription,
    estimateUsd,
    processingEnabled,
    globalSpentUsd: Number(costs.total_usd || 0),
    globalReservedUsd: Number(costs.reserved_usd || 0),
    trialUsed: Number(trial.used || 0),
    trialReserved: Number(trial.reserved || 0),
    trialLimit,
    decision,
  };
}

async function evaluateCreatorVideoRequest(params) {
  const context = await loadEligibilityContext({ query }, params);
  if (context.error) return context;
  await writeVideoProcessingAudit({
    creatorId: params.creatorId,
    jobId: params.jobId || null,
    action: 'preflight',
    decision: context.decision.allowed ? 'allowed' : 'blocked',
    reasonCode: context.decision.code || null,
    estimatedCostUsd: context.estimateUsd,
    details: {
      durationSeconds: params.durationSeconds,
      fileSizeBytes: params.fileSizeBytes,
      allowanceType: context.decision.allowanceType || null,
      fingerprint: params.fingerprint || null,
    },
    actor: `creator:${params.creatorId}`,
  });
  return context;
}

async function getCreatorVideoUsage(creatorId) {
  const config = getVideoStudioConfig();
  const [
    creatorResult,
    trialResult,
    subscriptionResult,
    jobResult,
    plans,
    planRequestResult,
  ] = await Promise.all([
    query(`SELECT video_verification_status, video_verification_reason,
                  video_verification_request_url FROM creators WHERE id=$1`, [creatorId]),
    query(
      `SELECT COUNT(*) FILTER (WHERE status='completed') AS used,
              COUNT(*) FILTER (WHERE status='reserved') AS reserved
       FROM video_processing_costs WHERE creator_id=$1 AND billing_type='trial'`,
      [creatorId],
    ),
    query(
      `SELECT subscription.id, subscription.plan_code, plan.name, plan.price_rwf, subscription.status,
              subscription.hours_included, subscription.hours_used,
              subscription.period_start, subscription.period_end,
              COALESCE(reserved.hours_reserved,0) AS hours_reserved
       FROM video_creator_subscriptions AS subscription
       JOIN video_processing_plans AS plan ON plan.code=subscription.plan_code
       LEFT JOIN LATERAL (
         SELECT SUM(cost.reserved_hours) AS hours_reserved
         FROM video_processing_costs AS cost
         WHERE cost.subscription_id=subscription.id AND cost.status='reserved'
       ) AS reserved ON TRUE
       WHERE subscription.creator_id=$1 AND subscription.status='active'
         AND subscription.period_end > NOW()
       ORDER BY subscription.period_end DESC LIMIT 1`,
      [creatorId],
    ),
    query(
      `SELECT id, status, stage_message, progress, error_code, error_message,
              created_at, duration_seconds
       FROM ad_video_jobs
       WHERE creator_id=$1 AND video_fingerprint IS NOT NULL
       ORDER BY created_at DESC LIMIT 10`,
      [creatorId],
    ),
    getPlanRows(),
    query(
      `SELECT plan_code, status, created_at
       FROM video_plan_requests
       WHERE creator_id=$1 AND status='pending'
       ORDER BY created_at DESC`,
      [creatorId],
    ),
  ]);
  if (!creatorResult.rowCount) throw new Error('Creator account was not found.');
  const trial = trialResult.rows[0] || {};
  const subscription = subscriptionResult.rows[0] || null;
  const plansVisible = plans.filter((plan) => plan.enabled);
  const extraHoursEnabled = Boolean(subscription);
  return {
    trial: {
      used: Number(trial.used || 0),
      limit: config.trialLongVideos,
      remaining: Math.max(0, config.trialLongVideos - Number(trial.used || 0) - Number(trial.reserved || 0)),
      reserved: Number(trial.reserved || 0),
    },
    subscription: subscription ? {
      id: subscription.id,
      plan: subscription.plan_code,
      name: subscription.name,
      priceRwf: Number(subscription.price_rwf),
      status: subscription.status,
      hoursIncluded: Number(subscription.hours_included),
      hoursUsed: Number(subscription.hours_used),
      hoursReserved: Number(subscription.hours_reserved || 0),
      hoursRemaining: Math.max(0, Number(subscription.hours_included) - Number(subscription.hours_used) - Number(subscription.hours_reserved || 0)),
      periodStart: subscription.period_start,
      periodEnd: subscription.period_end,
    } : null,
    verificationStatus: creatorResult.rows[0].video_verification_status,
    verificationReason: creatorResult.rows[0].video_verification_reason,
    verificationRequestUrl: creatorResult.rows[0].video_verification_request_url,
    limits: {
      maxDurationMinutes: config.maxVideoMinutes,
      maxFileSizeGb: config.maxFileSizeGb,
      maxDailyJobs: config.maxVideosPerDay,
      maxMonthlyJobs: config.maxVideosPerMonth,
    },
    plans: plansVisible,
    planRequests: planRequestResult.rows.map((request) => ({
      plan: request.plan_code,
      status: request.status,
      createdAt: request.created_at,
    })),
    extraHours: { enabled: extraHoursEnabled, priceRwf: config.extraHourPriceRwf },
    jobs: jobResult.rows.map((job) => ({
      id: job.id,
      status: job.status,
      stage_message: job.stage_message,
      progress: job.progress,
      error_code: job.error_code,
      error_message: job.error_message,
      created_at: job.created_at,
      duration_seconds: job.duration_seconds,
    })),
  };
}

async function reserveVideoJobForApproval(jobId, actor) {
  const client = await getClient();
  let auditContext = null;
  try {
    await client.query('BEGIN');
    await client.query(`SELECT id FROM video_processing_controls WHERE id=1 FOR UPDATE`);
    const jobResult = await client.query(
      `SELECT job.id, job.creator_id, job.status, job.duration_seconds, job.file_size_bytes,
              job.video_fingerprint, job.result, job.retry_count
       FROM ad_video_jobs AS job
       WHERE job.id=$1
       FOR UPDATE`,
      [jobId],
    );
    if (!jobResult.rowCount) {
      const error = new Error('Video job was not found.');
      error.code = 'JOB_NOT_FOUND';
      throw error;
    }
    const job = jobResult.rows[0];
    auditContext = { creatorId: job.creator_id, jobId: job.id };
    if (job.status !== 'pending_approval') {
      const error = new Error('This job is no longer waiting for approval.');
      error.code = 'JOB_NOT_PENDING';
      throw error;
    }
    const context = await loadEligibilityContext(client, {
      creatorId: job.creator_id,
      durationSeconds: Number(job.duration_seconds),
      fileSizeBytes: Number(job.file_size_bytes),
      fingerprint: job.video_fingerprint,
      excludeJobId: job.id,
      retryCount: Number(job.retry_count || 0),
    });
    if (context.error) {
      const error = new Error(context.error.message);
      error.code = context.error.code;
      throw error;
    }
    auditContext.estimatedCostUsd = context.estimateUsd;
    if (!context.decision.allowed) {
      const error = new Error(context.decision.message);
      error.code = context.decision.code;
      error.estimatedCostUsd = context.estimateUsd;
      throw error;
    }

    let subscriptionId = null;
    if (context.decision.allowanceType === 'subscription'
      || context.decision.allowanceType === 'extra') {
      subscriptionId = context.activeSubscription.id;
    }
    if (context.decision.allowanceType === 'trial') {
      const channelIdentities = await getConnectedChannelIdentities(client, job.creator_id);
      if (!channelIdentities.length) {
        const error = new Error('Connect and verify your YouTube or TikTok channel before claiming the creator trial.');
        error.code = 'CHANNEL_REQUIRED';
        throw error;
      }
      for (const identity of channelIdentities) {
        const identityResult = await client.query(
          `INSERT INTO video_processing_trial_channels
               (provider, platform_user_id, creator_id, job_id, status)
             VALUES ($1,$2,$3,$4,'reserved')
             ON CONFLICT (provider, platform_user_id) DO UPDATE
               SET job_id=$4, status='reserved', claimed_at=NOW()
             WHERE video_processing_trial_channels.creator_id=EXCLUDED.creator_id
                 AND video_processing_trial_channels.status='released'
             RETURNING creator_id`,
          [identity.provider, identity.platformUserId, job.creator_id, job.id],
        );
        if (identityResult.rowCount) continue;
        const ownerResult = await client.query(
          `SELECT creator_id, status FROM video_processing_trial_channels
           WHERE provider=$1 AND platform_user_id=$2`,
          [identity.provider, identity.platformUserId],
        );
        if (Number(ownerResult.rows[0]?.creator_id) !== Number(job.creator_id)) {
          const error = new Error('This connected channel has already been used to claim a free trial.');
          error.code = 'TRIAL_ALREADY_CLAIMED';
          throw error;
        }
        if (ownerResult.rows[0]?.status === 'reserved') {
          const error = new Error('This connected channel already has a trial video in progress.');
          error.code = 'LIMIT_REACHED';
          throw error;
        }
      }
    }

    let extraWalletTransactionId = null;
    if (context.decision.extraChargeRwf > 0) {
      const walletResult = await client.query(
        `SELECT id, balance FROM wallets
         WHERE owner_id=$1 AND owner_type='webOwner'
         FOR UPDATE`,
        [String(job.creator_id)],
      );
      const wallet = walletResult.rows[0];
      if (!wallet || Number(wallet.balance) < context.decision.extraChargeRwf) {
        const error = new Error('Add sufficient wallet credit before using extra processing hours.');
        error.code = 'INSUFFICIENT_WALLET';
        throw error;
      }
      const transactionHash = `video-processing-${job.id}`;
      const existing = await client.query(
        `SELECT id FROM wallet_transactions WHERE transaction_hash=$1 AND type='debit'`,
        [transactionHash],
      );
      if (existing.rowCount) {
        extraWalletTransactionId = existing.rows[0].id;
      } else {
        await client.query(
          `UPDATE wallets
           SET balance=balance-$1, total_spent=total_spent+$1,
               last_updated=NOW(), updated_at=NOW()
           WHERE id=$2`,
          [context.decision.extraChargeRwf, wallet.id],
        );
        const transaction = await client.query(
          `INSERT INTO wallet_transactions
             (wallet_id, amount, type, description, status, transaction_hash)
           VALUES ($1,$2,'debit',$3,'completed',$4)
           RETURNING id`,
          [wallet.id, context.decision.extraChargeRwf, `Extra video processing hours for job ${job.id}`, transactionHash],
        );
        extraWalletTransactionId = transaction.rows[0].id;
      }
    }

    const monthStart = currentMonthStart();
    await client.query(
      `INSERT INTO video_processing_costs
         (job_id, creator_id, month_start, estimated_cost_usd, estimated_cost_rwf,
          billing_type, reserved_hours, extra_hours, extra_charge_rwf,
          subscription_id, retry_count, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'reserved')`,
      [
        job.id,
        job.creator_id,
        monthStart,
        context.estimateUsd,
        Math.ceil(context.estimateUsd * context.config.usdRwfRate),
        context.decision.allowanceType,
        context.decision.reservedHours,
        context.decision.extraHours,
        context.decision.extraChargeRwf,
        subscriptionId,
        Number(job.retry_count || 0),
      ],
    );
    const result = {
      ...(job.result || {}),
      billing: {
        type: context.decision.allowanceType,
        reservedHours: context.decision.reservedHours,
        extraHours: context.decision.extraHours,
        extraChargeRwf: context.decision.extraChargeRwf,
        subscriptionId,
        extraWalletTransactionId,
      },
    };
    await client.query(
      `UPDATE ad_video_jobs
       SET status='approved', stage_message='Approved, preparing secure render',
           reviewed_by=$1, reviewed_at=NOW(), result=$2::jsonb, updated_at=NOW()
       WHERE id=$3`,
      [actor, JSON.stringify(result), job.id],
    );
    await writeVideoProcessingAudit({
      creatorId: job.creator_id,
      jobId: job.id,
      action: 'approval',
      decision: 'allowed',
      estimatedCostUsd: context.estimateUsd,
      details: {
        allowanceType: context.decision.allowanceType,
        hours: context.decision.reservedHours,
        extraHours: context.decision.extraHours,
        globalSpentUsd: context.globalSpentUsd,
      },
      actor,
    }, client);
    await client.query('COMMIT');
    return { job, upload: result, context };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (auditContext) {
      await writeVideoProcessingAudit({
        ...auditContext,
        action: 'approval',
        decision: 'blocked',
        reasonCode: err.code || 'APPROVAL_FAILED',
        details: { message: err.message },
        actor,
      }).catch((auditError) => console.error(`[video-studio] job ${jobId} audit write failed:`, auditError.message));
    }
    throw err;
  } finally {
    client.release();
  }
}

async function releaseVideoJobReservation(jobId, { actualCostUsd = null, completed = false } = {}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const reservationResult = await client.query(
      `SELECT creator_id, subscription_id, reserved_hours, estimated_cost_usd,
              extra_charge_rwf, status
       FROM video_processing_costs
       WHERE job_id=$1 FOR UPDATE`,
      [jobId],
    );
    if (!reservationResult.rowCount || reservationResult.rows[0].status !== 'reserved') {
      await client.query('COMMIT');
      return null;
    }
    const reservation = reservationResult.rows[0];
    const finalCost = completed && actualCostUsd != null
      ? Math.min(Number(reservation.estimated_cost_usd), Math.max(0, Number(actualCostUsd)))
      : null;
    if (completed && reservation.subscription_id) {
      await client.query(
        `UPDATE video_creator_subscriptions
         SET hours_used=hours_used+$1, updated_at=NOW()
         WHERE id=$2`,
        [reservation.reserved_hours, reservation.subscription_id],
      );
    }
    if (completed) {
      await client.query(
        `UPDATE video_processing_trial_channels
         SET status='completed'
         WHERE job_id=$1 AND status='reserved'`,
        [jobId],
      );
    } else {
      await client.query(
        `UPDATE video_processing_trial_channels
         SET status='released', job_id=NULL
         WHERE job_id=$1 AND status='reserved'`,
        [jobId],
      );
    }
    await client.query(
      `UPDATE video_processing_costs
       SET status=$1, actual_cost_usd=$2, updated_at=NOW()
       WHERE job_id=$3 AND status='reserved'`,
      [completed ? 'completed' : 'released', finalCost, jobId],
    );
    await client.query('COMMIT');
    return reservation;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  currentMonthStart,
  evaluateCreatorVideoRequest,
  getConnectedChannelIdentities,
  getCreatorVideoUsage,
  getLongVideoSizeLimitBytes,
  getPlanRows,
  loadEligibilityContext,
  makeVideoFingerprint,
  releaseVideoJobReservation,
  reserveVideoJobForApproval,
  writeVideoProcessingAudit,
};
