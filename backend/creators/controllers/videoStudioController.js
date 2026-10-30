'use strict';

const crypto = require('crypto');
const { getClient, query } = require('../../config/db');
const sendEmailNotification = require('../../controllers/emailService');
const { createNotification } = require('../utils/notificationUtils');
const {
  currentMonthStart,
  getCreatorVideoUsage,
  getPlanRows,
  writeVideoProcessingAudit,
} = require('../utils/videoStudioService');
const { getVideoStudioConfig } = require('../utils/videoStudioPolicy');
const creatorController = require('./creatorController');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://yepper.cc';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function sendJsonError(res, error) {
  const status = error.code === 'NOT_VERIFIED' ? 403
    : error.code === 'CAP_REACHED' || error.code === 'PLAN_REQUIRED' ? 402
      : error.code === 'KILL_SWITCH' ? 503
        : error.code === 'JOB_NOT_FOUND' ? 404 : 409;
  return res.status(status).json({
    success: false,
    code: error.code || 'VIDEO_STUDIO_ERROR',
    message: error.message || 'Video Studio request failed.',
  });
}

exports.getCreatorUsage = async (req, res) => {
  const creatorId = creatorController.getCreatorId(req);
  if (!creatorId) return res.status(401).json({ success: false });
  try {
    const data = await getCreatorVideoUsage(creatorId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[video-studio] creator usage lookup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load your Video Studio usage.' });
  }
};

exports.requestPlan = async (req, res) => {
  const creatorId = creatorController.getCreatorId(req);
  if (!creatorId) return res.status(401).json({ success: false });
  const planCode = String(req.body?.plan || '').toLowerCase();
  try {
    const plan = (await getPlanRows()).find((item) => item.code === planCode && item.enabled);
    if (!plan) return res.status(400).json({ success: false, code: 'PLAN_UNAVAILABLE', message: 'That plan is not available.' });
    const existing = await query(
      `SELECT id FROM video_plan_requests
       WHERE creator_id=$1 AND plan_code=$2 AND status='pending'
       LIMIT 1`,
      [creatorId, planCode],
    );
    if (!existing.rowCount) {
      await query(
        `INSERT INTO video_plan_requests (creator_id, plan_code) VALUES ($1,$2)`,
        [creatorId, planCode],
      );
    }
    await writeVideoProcessingAudit({
      creatorId,
      action: 'plan_request',
      decision: 'pending',
      details: { plan: planCode },
      actor: `creator:${creatorId}`,
    });
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (!adminEmail || !process.env.RESEND_API_KEY) {
      console.warn('[video-studio] Plan request saved, but notification skipped because Resend or ADMIN_NOTIFY_EMAIL is not configured.');
    } else {
      const creator = await query(`SELECT full_name, email FROM creators WHERE id=$1`, [creatorId]);
      const info = creator.rows[0] || {};
      try {
        await sendEmailNotification(
          adminEmail,
          `Video Studio plan request: ${plan.name}`,
          `<p>${escapeHtml(info.full_name || 'Creator')} (${escapeHtml(info.email || creatorId)}) requested ${escapeHtml(plan.name)}.</p>
           <p>Price: ${plan.priceRwf.toLocaleString()} RWF per month. Included hours: ${plan.hoursIncluded}.</p>`,
        );
      } catch (error) {
        console.error('[video-studio] Plan request notification failed:', error.message);
      }
    }
    return res.json({ success: true, message: `Your ${plan.name} plan request has been sent to Yepper.` });
  } catch (error) {
    console.error('[video-studio] Plan request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not send your plan request.' });
  }
};

exports.requestVerification = async (req, res) => {
  const creatorId = creatorController.getCreatorId(req);
  if (!creatorId) return res.status(401).json({ success: false });
  const channelUrl = String(req.body?.channelUrl || '').trim().slice(0, 500);
  try {
    const updated = await query(
      `UPDATE creators
       SET video_verification_status='pending',
           video_verification_request_url=$1,
           video_verification_reason=NULL,
           updated_at=NOW()
       WHERE id=$2 AND video_verification_status IN ('unverified','rejected')
       RETURNING id`,
      [channelUrl || null, creatorId],
    );
    if (!updated.rowCount) {
      return res.status(409).json({
        success: false,
        code: 'VERIFICATION_ALREADY_PENDING',
        message: 'Your verification request is already being reviewed or your account is verified.',
      });
    }
    await writeVideoProcessingAudit({
      creatorId,
      action: 'verification_request',
      decision: 'pending',
      details: { channelUrl },
      actor: `creator:${creatorId}`,
    });
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (adminEmail && process.env.RESEND_API_KEY) {
      const creator = await query(`SELECT full_name, email FROM creators WHERE id=$1`, [creatorId]);
      const info = creator.rows[0] || {};
      await sendEmailNotification(
        adminEmail,
        'Creator verification request',
        `<p>${escapeHtml(info.full_name || 'Creator')} (${escapeHtml(info.email || creatorId)}) requested verification.</p>
         <p>Channel: ${escapeHtml(channelUrl || 'See connected social accounts')}</p>`,
      ).catch((error) => console.error('[video-studio] Verification request email failed:', error.message));
    } else {
      console.warn('[video-studio] Verification request saved, but notification skipped because Resend or ADMIN_NOTIFY_EMAIL is not configured.');
    }
    return res.json({ success: true, message: 'Your creator verification request has been submitted.' });
  } catch (error) {
    console.error('[video-studio] Verification request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not submit your verification request.' });
  }
};

exports.paymentWebhookPlaceholder = async (_req, res) => {
  return res.status(501).json({
    success: false,
    code: 'PAYMENTS_NOT_CONNECTED',
    message: 'Video Studio subscription payments are not connected yet.',
  });
};

exports.getReviewQueue = async (_req, res) => {
  try {
    const result = await query(
      `SELECT job.id, job.creator_id, job.provider, job.status, job.stage_message,
              job.duration_seconds, job.file_size_bytes, job.created_at, job.result,
              creator.full_name, creator.email, creator.video_verification_status,
              creator.video_verification_request_url,
              cost.estimated_cost_usd, cost.estimated_cost_rwf
       FROM ad_video_jobs AS job
       JOIN creators AS creator ON creator.id=job.creator_id
       LEFT JOIN video_processing_costs AS cost ON cost.job_id=job.id
       WHERE job.status='pending_approval'
       ORDER BY job.created_at ASC
       LIMIT 100`,
    );
    return res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        creatorId: row.creator_id,
        creatorName: row.full_name,
        creatorEmail: row.email,
        verificationStatus: row.video_verification_status,
        verificationRequestUrl: row.video_verification_request_url,
        provider: row.provider,
        status: row.status,
        title: row.result?.title || row.result?.filename || 'Untitled video',
        durationSeconds: Number(row.duration_seconds || 0),
        fileSizeBytes: Number(row.file_size_bytes || 0),
        estimatedCostUsd: Number(row.result?.estimatedCostUsd || row.estimated_cost_usd || 0),
        estimatedCostRwf: Number(row.result?.estimatedCostRwf || row.estimated_cost_rwf || 0),
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('[video-studio] review queue lookup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load video approvals.' });
  }
};

exports.approveJob = async (req, res) => {
  try {
    const data = await creatorController.approveAwsAdVideoJob(req.params.id, req.admin.username);
    return res.json({ success: true, data });
  } catch (error) {
    console.error(`[video-studio] admin approval failed for job ${req.params.id}:`, error.message);
    return sendJsonError(res, error);
  }
};

exports.rejectJob = async (req, res) => {
  const jobId = Number(req.params.id);
  const reason = String(req.body?.reason || '').trim().slice(0, 1000);
  if (!reason) return res.status(400).json({ success: false, message: 'Provide a rejection reason.' });
  try {
    const result = await query(
      `UPDATE ad_video_jobs
       SET status='rejected', stage_message='Rejected by Yepper review',
           approval_reason=$1, error_code='REJECTED', error_message=$1,
           reviewed_by=$2, reviewed_at=NOW(), updated_at=NOW()
       WHERE id=$3 AND status='pending_approval'
       RETURNING creator_id, result`,
      [reason, req.admin.username, jobId],
    );
    if (!result.rowCount) return res.status(409).json({ success: false, code: 'JOB_NOT_PENDING', message: 'This job is no longer waiting for review.' });
    await writeVideoProcessingAudit({
      creatorId: result.rows[0].creator_id,
      jobId,
      action: 'approval',
      decision: 'rejected',
      reasonCode: 'REJECTED',
      estimatedCostUsd: result.rows[0].result?.estimatedCostUsd || null,
      details: { reason },
      actor: req.admin.username,
    });
    createNotification(
      result.rows[0].creator_id,
      'video_job_rejected',
      'Video processing was not approved',
      reason,
      { jobId },
    ).catch((error) => console.error(`[video-studio] job ${jobId} rejection notification failed:`, error.message));
    return res.json({ success: true, message: 'Video job rejected.' });
  } catch (error) {
    console.error(`[video-studio] job rejection failed for ${jobId}:`, error.message);
    return res.status(500).json({ success: false, message: 'Could not reject this video job.' });
  }
};

exports.decideFromEmail = async (req, res) => {
  const token = String(req.body?.token || '');
  const jobId = Number(req.body?.jobId);
  const decision = String(req.body?.decision || '');
  const reason = String(req.body?.reason || 'Rejected by Yepper review').trim().slice(0, 1000);
  if (!/^[a-f0-9]{64}$/.test(token) || !Number.isInteger(jobId)
    || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'The review link is invalid.' });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const claim = await client.query(
      `UPDATE video_processing_approvals
       SET used_at=NOW()
       WHERE job_id=$1 AND token_hash=$2 AND decision=$3
         AND used_at IS NULL AND expires_at > NOW()
       RETURNING id`,
      [jobId, tokenHash, decision],
    );
    if (!claim.rowCount) {
      await client.query('ROLLBACK');
      return res.status(410).json({ success: false, message: 'This review link is expired or has already been used.' });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[video-studio] email decision token claim failed for job ${jobId}:`, error.message);
    return res.status(500).json({ success: false, message: 'Could not process this review link.' });
  } finally {
    client.release();
  }

  if (decision === 'approve') {
    try {
      const data = await creatorController.approveAwsAdVideoJob(jobId, 'email-approval-link');
      return res.json({ success: true, data, message: 'Video approved and processing has started.' });
    } catch (error) {
      await query(
        `UPDATE video_processing_approvals
         SET used_at=NULL
         WHERE job_id=$1 AND token_hash=$2 AND decision=$3`,
        [jobId, tokenHash, decision],
      ).catch((restoreError) => {
        console.error(`[video-studio] review token restore failed for job ${jobId}:`, restoreError.message);
      });
      return sendJsonError(res, error);
    }
  }
  const rejectReq = { params: { id: String(jobId) }, body: { reason }, admin: { username: 'email-approval-link' } };
  const resProxy = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await exports.rejectJob(rejectReq, resProxy);
  if ((resProxy.statusCode || 200) >= 400) {
    await query(
      `UPDATE video_processing_approvals
       SET used_at=NULL
       WHERE job_id=$1 AND token_hash=$2 AND decision=$3`,
      [jobId, tokenHash, decision],
    ).catch((restoreError) => {
      console.error(`[video-studio] review token restore failed for job ${jobId}:`, restoreError.message);
    });
  }
  return res.status(resProxy.statusCode || 200).json(resProxy.payload || { success: true });
};

exports.getCreators = async (_req, res) => {
  try {
    const result = await query(
      `SELECT creator.id, creator.full_name, creator.email, creator.video_verification_status,
              COALESCE(trial.used,0) AS trial_used,
              subscription.plan_code, subscription.status AS subscription_status,
              subscription.hours_included, subscription.hours_used,
              subscription.period_end, plan_request.plan_code AS requested_plan,
              COALESCE(subscription.hours_included-subscription.hours_used,0) AS hours_left
       FROM creators AS creator
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS used FROM video_processing_costs
         WHERE creator_id=creator.id AND billing_type='trial' AND status='completed'
       ) AS trial ON TRUE
       LEFT JOIN LATERAL (
         SELECT plan_code, status, hours_included, hours_used, period_end
         FROM video_creator_subscriptions
         WHERE creator_id=creator.id AND status='active' AND period_end > NOW()
         ORDER BY period_end DESC LIMIT 1
       ) AS subscription ON TRUE
       LEFT JOIN LATERAL (
         SELECT plan_code
         FROM video_plan_requests
         WHERE creator_id=creator.id AND status='pending'
         ORDER BY created_at DESC LIMIT 1
       ) AS plan_request ON TRUE
       ORDER BY creator.created_at DESC
       LIMIT 500`,
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[video-studio] creator list lookup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load creators.' });
  }
};

exports.setCreatorVerification = async (req, res) => {
  const creatorId = Number(req.params.creatorId);
  const status = String(req.body?.status || '');
  const reason = String(req.body?.reason || '').trim().slice(0, 1000);
  if (!Number.isInteger(creatorId) || !['pending', 'verified', 'rejected', 'unverified'].includes(status)) {
    return res.status(400).json({ success: false, message: 'A valid verification status is required.' });
  }
  try {
    const updated = await query(
      `UPDATE creators
       SET video_verification_status=$1, video_verification_reason=$2,
           video_verified_at=CASE WHEN $1='verified' THEN NOW() ELSE NULL END,
           updated_at=NOW()
       WHERE id=$3 RETURNING id`,
      [status, reason || null, creatorId],
    );
    if (!updated.rowCount) return res.status(404).json({ success: false, message: 'Creator not found.' });
    await writeVideoProcessingAudit({
      creatorId,
      action: 'creator_verification',
      decision: status,
      reasonCode: reason ? 'ADMIN_NOTE' : null,
      details: { reason },
      actor: req.admin.username,
    });
    createNotification(
      creatorId,
      'video_creator_verification',
      status === 'verified' ? 'Creator account verified' : 'Creator verification updated',
      status === 'rejected' ? (reason || 'Your creator verification was rejected.') : `Your verification status is ${status}.`,
      {},
    ).catch((error) => console.error(`[video-studio] creator ${creatorId} verification notification failed:`, error.message));
    return res.json({ success: true, data: { creatorId, status } });
  } catch (error) {
    console.error(`[video-studio] creator verification update failed for ${creatorId}:`, error.message);
    return res.status(500).json({ success: false, message: 'Could not update creator verification.' });
  }
};

exports.setSubscription = async (req, res) => {
  const creatorId = Number(req.params.creatorId);
  const action = String(req.body?.action || 'grant');
  const planCode = String(req.body?.planCode || '').toLowerCase();
  if (!Number.isInteger(creatorId) || !['grant', 'extend', 'change', 'revoke'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Subscription action is invalid.' });
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT * FROM video_creator_subscriptions
       WHERE creator_id=$1 AND status='active' AND period_end > NOW()
       ORDER BY period_end DESC LIMIT 1 FOR UPDATE`,
      [creatorId],
    );
    if (action === 'revoke') {
      if (currentResult.rowCount) {
        await client.query(
          `UPDATE video_creator_subscriptions
           SET status='revoked', updated_at=NOW() WHERE id=$1`,
          [currentResult.rows[0].id],
        );
      }
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Subscription revoked.' });
    }
    const targetPlanCode = action === 'extend' && currentResult.rowCount
      ? currentResult.rows[0].plan_code
      : planCode;
    const planResult = await client.query(
      `SELECT * FROM video_processing_plans
       WHERE code=$1 AND (enabled=TRUE OR (code='pro' AND $2=TRUE))`,
      [targetPlanCode, getVideoStudioConfig().proEnabled],
    );
    const plan = planResult.rows[0];
    if (!plan) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'That plan is unavailable.' });
    }
    if (action === 'extend') {
      if (!currentResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'No active subscription is available to extend.' });
      }
      const current = currentResult.rows[0];
      const nextStart = new Date(current.period_end);
      const nextEnd = new Date(current.period_end);
      nextEnd.setUTCMonth(nextEnd.getUTCMonth() + 1);
      await client.query(
        `UPDATE video_creator_subscriptions
         SET status='renewed', updated_at=NOW() WHERE id=$1`,
        [current.id],
      );
      const renewed = await client.query(
        `INSERT INTO video_creator_subscriptions
           (creator_id, plan_code, status, hours_included, period_start, period_end, granted_by)
         VALUES ($1,$2,'active',$3,$4,$5,$6)
         RETURNING id, plan_code, hours_included, period_start, period_end`,
        [creatorId, current.plan_code, current.hours_included, nextStart, nextEnd, req.admin.username],
      );
      await client.query('COMMIT');
      return res.json({ success: true, data: renewed.rows[0], message: 'Subscription extended by one month.' });
    }
    if (currentResult.rowCount) {
      await client.query(
        `UPDATE video_creator_subscriptions
         SET status='changed', updated_at=NOW() WHERE id=$1`,
        [currentResult.rows[0].id],
      );
    }
    const start = new Date();
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const created = await client.query(
      `INSERT INTO video_creator_subscriptions
         (creator_id, plan_code, status, hours_included, period_start, period_end, granted_by)
       VALUES ($1,$2,'active',$3,$4,$5,$6)
       RETURNING id, plan_code, hours_included, period_start, period_end`,
      [creatorId, planCode, plan.hours_included, start, end, req.admin.username],
    );
    await client.query(
      `UPDATE video_plan_requests
       SET status=CASE WHEN plan_code=$2 THEN 'approved' ELSE 'closed' END
       WHERE creator_id=$1 AND status='pending'`,
      [creatorId, planCode],
    );
    await client.query('COMMIT');
    return res.json({ success: true, data: created.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[video-studio] subscription update failed for creator ${creatorId}:`, error.message);
    return res.status(500).json({ success: false, message: 'Could not update the subscription.' });
  } finally {
    client.release();
  }
};

exports.getKillSwitch = async (_req, res) => {
  try {
    const result = await query(`SELECT processing_enabled, changed_by, changed_at FROM video_processing_controls WHERE id=1`);
    const envEnabled = getVideoStudioConfig().processingEnabled;
    return res.json({
      success: true,
      data: {
        enabled: envEnabled && (result.rows[0]?.processing_enabled ?? true),
        environmentEnabled: envEnabled,
        changedBy: result.rows[0]?.changed_by || null,
        changedAt: result.rows[0]?.changed_at || null,
      },
    });
  } catch (error) {
    console.error('[video-studio] kill switch lookup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load processing status.' });
  }
};

exports.setKillSwitch = async (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, message: 'enabled must be a boolean.' });
  try {
    await query(
      `UPDATE video_processing_controls
       SET processing_enabled=$1, changed_by=$2, changed_at=NOW() WHERE id=1`,
      [enabled, req.admin.username],
    );
    await writeVideoProcessingAudit({
      action: 'kill_switch',
      decision: enabled ? 'enabled' : 'disabled',
      actor: req.admin.username,
    });
    return res.json({ success: true, data: { enabled: enabled && getVideoStudioConfig().processingEnabled } });
  } catch (error) {
    console.error('[video-studio] kill switch update failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not update processing status.' });
  }
};

exports.getSummary = async (_req, res) => {
  const capUsd = getVideoStudioConfig().globalMonthlyCapUsd;
  const monthStart = currentMonthStart();
  try {
    const [costResult, jobsResult, hoursResult, trialResult, controlResult, campaignResult] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(CASE WHEN status='completed'
           THEN COALESCE(actual_cost_usd,estimated_cost_usd)
           ELSE 0 END),0) AS spent_usd,
         COALESCE(SUM(CASE WHEN status='reserved' THEN estimated_cost_usd ELSE 0 END),0) AS reserved_usd
         FROM video_processing_costs WHERE month_start=$1`,
        [monthStart],
      ),
      query(
        `SELECT COUNT(*) AS count FROM ad_video_jobs
         WHERE created_at >= date_trunc('month', NOW())
           AND video_fingerprint IS NOT NULL`,
      ),
      query(
        `SELECT COALESCE(SUM(reserved_hours),0) AS used_hours
         FROM video_processing_costs
         WHERE month_start=$1 AND status IN ('completed','reserved')`,
        [monthStart],
      ),
      query(
        `SELECT COUNT(*) AS used FROM video_processing_costs
         WHERE billing_type='trial' AND status='completed'`,
      ),
      query(`SELECT processing_enabled FROM video_processing_controls WHERE id=1`),
      query(
        `SELECT association.campaign_id,
         COALESCE(SUM(
           CASE WHEN cost.status='completed' THEN COALESCE(cost.actual_cost_usd,cost.estimated_cost_usd)
                WHEN cost.status='reserved' THEN cost.estimated_cost_usd ELSE 0 END
           * association.allocation_ratio
         ),0) AS spend_usd,
         COUNT(DISTINCT cost.job_id) AS jobs
         FROM video_processing_job_campaigns AS association
         JOIN video_processing_costs AS cost ON cost.job_id=association.job_id
         WHERE cost.month_start=$1
         GROUP BY association.campaign_id
         ORDER BY association.campaign_id`,
        [monthStart],
      ),
    ]);
    const spend = costResult.rows[0] || {};
    const spentUsd = Number(spend.spent_usd || 0);
    const reservedUsd = Number(spend.reserved_usd || 0);
    return res.json({
      success: true,
      data: {
        monthStart,
        capUsd,
        spentUsd,
        reservedUsd,
        remainingUsd: Math.max(0, capUsd - spentUsd - reservedUsd),
        jobsThisMonth: Number(jobsResult.rows[0]?.count || 0),
        hoursUsedThisMonth: Number(hoursResult.rows[0]?.used_hours || 0),
        trialCreditsUsed: Number(trialResult.rows[0]?.used || 0),
        campaignSpend: campaignResult.rows.map((row) => ({
          campaignId: row.campaign_id,
          spendUsd: Number(row.spend_usd || 0),
          jobs: Number(row.jobs || 0),
        })),
        processingEnabled: getVideoStudioConfig().processingEnabled
          && (controlResult.rows[0]?.processing_enabled ?? true),
      },
    });
  } catch (error) {
    console.error('[video-studio] monthly summary lookup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load processing summary.' });
  }
};

exports.updatePlan = async (req, res) => {
  const code = String(req.params.code || '').toLowerCase();
  const priceRwf = Number(req.body?.priceRwf);
  const hoursIncluded = Number(req.body?.hoursIncluded);
  if (!['starter', 'creator', 'pro'].includes(code)
    || !Number.isFinite(priceRwf) || priceRwf < 0
    || !Number.isFinite(hoursIncluded) || hoursIncluded <= 0) {
    return res.status(400).json({ success: false, message: 'A valid price and included hours are required.' });
  }
  try {
    const result = await query(
      `UPDATE video_processing_plans SET price_rwf=$1, hours_included=$2, updated_at=NOW()
       WHERE code=$3 RETURNING code, name, price_rwf, hours_included, enabled`,
      [priceRwf, hoursIncluded, code],
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'Plan not found.' });
    await writeVideoProcessingAudit({
      action: 'plan_config',
      decision: 'updated',
      details: { plan: code, priceRwf, hoursIncluded },
      actor: req.admin.username,
    });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(`[video-studio] plan update failed for ${code}:`, error.message);
    return res.status(500).json({ success: false, message: 'Could not update this plan.' });
  }
};

exports.getPlans = async (_req, res) => {
  try {
    return res.json({ success: true, data: await getPlanRows() });
  } catch (error) {
    console.error('[video-studio] plan lookup failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load plan configuration.' });
  }
};
